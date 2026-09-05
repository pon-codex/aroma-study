import Stripe from "stripe";
import { json, publicOrigin, requireSameOrigin } from "../lib/http.js";

export async function onRequestPost({ request, env }) {
  if (!requireSameOrigin(request)) return json({ error: "invalid_origin" }, 403);
  if (!env.DB || !env.STRIPE_RESTRICTED_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: "payments_not_configured" }, 503);
  }

  const stripeClient = new Stripe(env.STRIPE_RESTRICTED_KEY, {
    apiVersion: "2026-07-29.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
  });
  const origin = publicOrigin(request, env);
  const session = await stripeClient.checkout.sessions.create({
    mode: "payment",
    customer_creation: "always",
    locale: "ja",
    integration_identifier: "aroma_web_qjmfznrx",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "jpy",
        unit_amount: 1480,
        product_data: {
          name: "香りのノート 有料版",
          description: "精油カード30種・全4分野のクイズ・5/10/20問モード",
        },
      },
    }],
    metadata: { product_key: "premium_lifetime" },
    success_url: `${origin}/api/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?checkout=cancelled`,
  });

  return json({ url: session.url });
}

export function onRequest() {
  return json({ error: "method_not_allowed" }, 405, { allow: "POST" });
}
