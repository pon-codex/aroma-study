import Stripe from "stripe";
import { grantPremium, revokeByPaymentIntent } from "../lib/entitlements.js";
import { sendPurchaseEmailOnce } from "../lib/email.js";
import { json } from "../lib/http.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: "webhook_not_configured" }, 503);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return json({ error: "missing_signature" }, 400);

  const stripeClient = new Stripe(env.STRIPE_RESTRICTED_KEY || "rk_not_used_for_signature_verification", {
    apiVersion: "2026-07-29.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
  });
  let event;
  try {
    event = await stripeClient.webhooks.constructEventAsync(
      await request.text(),
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return json({ error: "invalid_signature" }, 400);
  }

  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"]
    .includes(event.type)) {
    const session = event.data.object;
    if (session.payment_status === "paid"
      && session.metadata?.product_key === "premium_lifetime") {
      await grantPremium(env.DB, session);
      await sendPurchaseEmailOnce(
        env.DB,
        env,
        session,
        env.PUBLIC_APP_URL || new URL(request.url).origin,
      );
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    if (charge.amount_refunded >= charge.amount) {
      const paymentIntentId = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
      await revokeByPaymentIntent(env.DB, paymentIntentId);
    }
  }

  return json({ received: true });
}
