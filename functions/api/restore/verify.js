import { publicOrigin } from "../../lib/http.js";
import { createSession, hashToken } from "../../lib/session.js";

export async function onRequestGet({ request, env }) {
  const origin = publicOrigin(request, env);
  if (!env.DB) return Response.redirect(`${origin}/?restore=configuration-error`, 303);
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.redirect(`${origin}/?restore=invalid`, 303);

  const tokenHash = await hashToken(token);
  const now = Math.floor(Date.now() / 1000);
  const match = await env.DB.prepare(`
    SELECT login_tokens.email, customers.id AS customer_id
    FROM login_tokens
    JOIN customers ON customers.email = login_tokens.email
    JOIN entitlements ON entitlements.customer_id = customers.id
    WHERE login_tokens.token_hash = ?
      AND login_tokens.used_at IS NULL
      AND login_tokens.expires_at > ?
      AND entitlements.product_key = 'premium_lifetime'
      AND entitlements.status = 'active'
    LIMIT 1
  `).bind(tokenHash, now).first();
  if (!match) return Response.redirect(`${origin}/?restore=invalid`, 303);

  await env.DB.prepare("UPDATE login_tokens SET used_at = ? WHERE token_hash = ?")
    .bind(now, tokenHash).run();
  const session = await createSession(env.DB, match.customer_id);
  return new Response(null, {
    status: 303,
    headers: {
      location: `${origin}/?restore=success`,
      "set-cookie": session.cookie,
      "cache-control": "no-store",
    },
  });
}
