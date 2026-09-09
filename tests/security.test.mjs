import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../app.js", import.meta.url), "utf8");
const premium = await readFile(new URL("../functions/lib/premium-content.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const manifest = await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8");
const terms = await readFile(new URL("../legal/terms.html", import.meta.url), "utf8");
const privacy = await readFile(new URL("../legal/privacy.html", import.meta.url), "utf8");
const commercial = await readFile(new URL("../legal/commercial.html", import.meta.url), "utf8");
const expandedStyles = await readFile(new URL("../cards-expanded.css", import.meta.url), "utf8");
const robots = await readFile(new URL("../robots.txt", import.meta.url), "utf8");
const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");

test("premium study details are not shipped in the public client bundle", () => {
  assert.equal(client.includes("緊張による動悸感・寝つきの悪さ"), false);
  assert.equal(client.includes("アンゲリカ酸エステル類"), false);
  assert.equal(premium.includes("緊張による動悸感・寝つきの悪さ"), true);
  assert.equal(premium.includes("アンゲリカ酸エステル類"), true);
});

test("developer preview is restricted to a local hostname", () => {
  assert.match(client, /\['localhost','127\.0\.0\.1'\]\.includes\(location\.hostname\)/);
  assert.doesNotMatch(client, /accessPlan=new URLSearchParams/);
});

test("legal pages are linked and cover the paid service", () => {
  assert.match(html, /legal\/terms\.html/);
  assert.match(html, /legal\/privacy\.html/);
  assert.match(html, /legal\/commercial\.html/);
  assert.match(terms, /医師等による診断、治療/);
  assert.match(privacy, /Stripe/);
  assert.match(privacy, /Cloudflare/);
  assert.match(privacy, /Resend/);
  assert.match(commercial, /550円/);
  assert.match(commercial, /買い切り|継続課金ではありません/);
  assert.match(commercial, /申込期間/);
  assert.match(terms, /全額返金/);
  assert.match(privacy, /広告メールを送信することはありません/);
});

test("API calls never embed a Stripe secret in client-side code", () => {
  assert.doesNotMatch(client, /[sr]k_(?:test|live)_/);
  assert.match(client, /escapeHtml\(email\)/);
});

test("Checkout uses a server-side Stripe Price and dynamic payment methods", async () => {
  const checkout = await readFile(new URL("../functions/api/checkout.js", import.meta.url), "utf8");
  assert.match(checkout, /price: env\.STRIPE_PRICE_ID/);
  assert.doesNotMatch(checkout, /payment_method_types|price_data|unit_amount/);
  assert.match(checkout, /integration_identifier/);
});

test("exam levels are not used in the learning app", () => {
  const appContent = [client, premium, html, manifest].join("\n");
  assert.doesNotMatch(appContent, /(?:アロマテラピー)?\u691c\u5b9a|[\uff11\uff1212]\u7d1a|level-badge|[".]level/);
});

test("the free and premium oil ranges stay at 10 and 30", () => {
  assert.equal((client.match(/"name":"/g) ?? []).length, 30);
  assert.equal((premium.match(/^    "name":/gm) ?? []).length, 20);
});

test("opening offer clearly states its price and upgrade policy", () => {
  assert.match(html, /機能追加までの限定価格/);
  assert.match(html, /¥550/);
  assert.match(html, /追加料金なし/);
  assert.match(html, /購入により.*利用規約/);
  assert.match(html, /追加後は ¥880 を予定/);
  assert.doesNotMatch(html, /¥1,480/);
  assert.match(html, /無料で試して、必要になったら30種へ/);
  assert.match(html, /購入時のメールアドレスで別端末でも復元/);
  assert.match(html, /よくある質問/);
  assert.match(client, /showUpgrade\('quiz_result'\)/);
  assert.match(client, /showUpgrade\('comparison'\)/);
});

test("transactional emails include support and safe purchase guidance", async () => {
  const email = await readFile(new URL("../functions/lib/email.js", import.meta.url), "utf8");
  const webhook = await readFile(new URL("../functions/api/stripe-webhook.js", import.meta.url), "utf8");
  assert.match(email, /support@seiyu-shiori\.com/);
  assert.match(email, /15分/);
  assert.match(email, /買い切り/);
  assert.match(email, /email_deliveries/);
  assert.match(webhook, /sendPurchaseEmailOnce/);
  assert.doesNotMatch(email, /[sr]k_(?:test|live)_/);
});

test("mobile layout keeps account recovery controls available", () => {
  assert.match(expandedStyles, /\.header-actions \.ghost \{ display: inline-block/);
  assert.match(expandedStyles, /\.header-actions #resetBtn \{ display: none/);
  assert.match(expandedStyles, /\.header-actions \.ghost\[hidden\] \{ display: none/);
});

test("mobile users receive platform-specific home screen guidance", () => {
  assert.match(html, /ホーム画面から、アプリのように使えます/);
  assert.match(client, /Safariの共有ボタン/);
  assert.match(client, /アプリをインストール/);
  assert.match(client, /display-mode: standalone/);
  assert.match(expandedStyles, /\.install-hint\.is-visible/);
  assert.match(html, /cards-expanded\.css\?v=install-hint-20260909/);
  assert.match(html, /app\.js\?v=install-hint-20260909/);
});

test("health check exposes status codes without configuration details", async () => {
  const health = await readFile(new URL("../functions/api/health.js", import.meta.url), "utf8");
  assert.match(health, /status: 204/);
  assert.match(health, /status: 503/);
  assert.match(health, /SELECT 1 AS ok/);
  assert.doesNotMatch(health, /JSON\.stringify|env\[[^\]]+\]|Object\.keys\(env\)/);
});

test("social sharing metadata uses the production domain and preview image", () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/seiyu-shiori\.com\/"/);
  assert.match(html, /property="og:image" content="https:\/\/seiyu-shiori\.com\/social-preview\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
});

test("search metadata exposes the app without indexing private APIs", () => {
  assert.match(html, /"@type": "SoftwareApplication"/);
  assert.match(html, /"price": "550"/);
  assert.match(html, /"priceCurrency": "JPY"/);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /https:\/\/seiyu-shiori\.com\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/seiyu-shiori\.com\/legal\/privacy/);
});

test("anonymous funnel analytics excludes personal and study-answer data", async () => {
  const analytics = await readFile(new URL("../functions/api/analytics.js", import.meta.url), "utf8");
  assert.match(client, /trackEvent\('checkout_start'/);
  assert.match(client, /trackEventOnce\('purchase_success'/);
  assert.match(analytics, /allowedEvents/);
  assert.match(analytics, /invalid_origin/);
  assert.doesNotMatch(analytics, /email|quiz_answer|search_query/i);
  assert.match(privacy, /匿名のセッション識別子/);
  assert.match(privacy, /クイズで選んだ回答.*サーバーへ送信しません/);
});

test("analytics API accepts only same-origin whitelisted anonymous events", async () => {
  const { onRequestPost } = await import("../functions/api/analytics.js");
  const writes = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return { run: async () => writes.push({ sql, values }) };
          },
        };
      },
    },
  };
  const payload = {
    eventId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    sessionId: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
    eventName: "quiz_start",
    context: "component",
    value: "5",
    path: "/",
  };
  const accepted = await onRequestPost({
    env,
    request: new Request("https://seiyu-shiori.com/api/analytics", {
      method: "POST",
      headers: { origin: "https://seiyu-shiori.com", "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  });
  assert.equal(accepted.status, 204);
  assert.equal(writes.length, 1);

  const rejected = await onRequestPost({
    env,
    request: new Request("https://seiyu-shiori.com/api/analytics", {
      method: "POST",
      headers: { origin: "https://example.com", "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  });
  assert.equal(rejected.status, 403);
  assert.equal(writes.length, 1);
});
