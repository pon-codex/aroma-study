import Stripe from "stripe";
import { json, publicOrigin, requireSameOrigin } from "../lib/http.js";

export async function onRequestPost({ request, env }) {
  if (!requireSameOrigin(request)) return json({ error: "invalid_origin" }, 403);
  if (!env.DB || !env.STRIPE_RESTRICTED_KEY || !env.STRIPE_WEBHOOK_SECRET
    || !env.STRIPE_PRICE_ID) {
    return json({ error: "payments_not_configured" }, 503);
  }

  const stripeClient = new Stripe(env.STRIPE_RESTRICTED_KEY, {
    apiVersion: "2026-07-29.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
  });
  const origin = publicOrigin(request, env);
  let session;
  try {
    session = await stripeClient.checkout.sessions.create({
      mode: "payment",
      customer_creation: "always",
      locale: "ja",
      integration_identifier: "aroma_web_qjmfznrx",
      line_items: [{ quantity: 1, price: env.STRIPE_PRICE_ID }],
      metadata: { product_key: "premium_lifetime" },
      success_url: `${origin}/api/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
    });
  } catch (error) {
    console.error("stripe_checkout_create_failed", error?.type || "unknown");
    return json({ error: "checkout_unavailable" }, 502);
  }

  return json({ url: session.url });
}

export function onRequest() {
  return json({ error: "method_not_allowed" }, 405, { allow: "POST" });
}
