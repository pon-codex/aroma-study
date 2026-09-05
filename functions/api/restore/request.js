import { normalizeEmail } from "../../lib/entitlements.js";
import { json, publicOrigin, requireSameOrigin } from "../../lib/http.js";
import { hashToken } from "../../lib/session.js";

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  if (!requireSameOrigin(request)) return json({ error: "invalid_origin" }, 403);
  if (!env.DB || !env.RESEND_API_KEY || !env.AROMA_FROM_EMAIL) {
    return json({ error: "restore_not_configured" }, 503);
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "invalid_email" }, 400);

  const entitlement = await env.DB.prepare(`
    SELECT customers.email
    FROM customers
    JOIN entitlements ON entitlements.customer_id = customers.id
    WHERE customers.email = ?
      AND entitlements.product_key = 'premium_lifetime'
      AND entitlements.status = 'active'
    LIMIT 1
  `).bind(email).first();

  if (entitlement) {
    const now = Math.floor(Date.now() / 1000);
    const recent = await env.DB.prepare(`
      SELECT token_hash FROM login_tokens
      WHERE email = ? AND created_at > ? LIMIT 1
    `).bind(email, now - 60).first();
    if (recent) return json({ ok: true });

    const token = randomToken();
    const tokenHash = await hashToken(token);
    const expiresAt = now + 15 * 60;
    await env.DB.prepare(
      "INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)",
    ).bind(tokenHash, email, expiresAt).run();
    const link = `${publicOrigin(request, env)}/api/restore/verify?token=${token}`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.AROMA_FROM_EMAIL,
        to: [email],
        subject: "香りのノート｜購入済みアクセスの復元",
        html: `<p>次のリンクから有料版へのアクセスを復元できます。</p><p><a href="${link}">有料版を開く</a></p><p>このリンクは15分間有効です。</p>`,
      }),
    });
    if (!response.ok) console.error("restore_email_delivery_failed", response.status);
  }

  return json({ ok: true });
}
