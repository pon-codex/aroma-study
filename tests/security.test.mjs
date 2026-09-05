import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../app.js", import.meta.url), "utf8");
const premium = await readFile(new URL("../functions/lib/premium-content.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const manifest = await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8");

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

test("API calls never embed a Stripe secret in client-side code", () => {
  assert.doesNotMatch(client, /[sr]k_(?:test|live)_/);
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
  assert.match(html, /オープニング限定/);
  assert.match(html, /¥550/);
  assert.match(html, /追加料金なし/);
  assert.match(html, /追加後は ¥880 を予定/);
  assert.doesNotMatch(html, /¥1,480/);
});
