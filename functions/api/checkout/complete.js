import Stripe from "stripe";
import { grantPremium } from "../../lib/entitlements.js";
import { publicOrigin } from "../../lib/http.js";
import { createSession } from "../../lib/session.js";

export async function onRequestGet({ request, env }) {
  const origin = publicOrigin(request, env);
  if (!env.DB || !env.STRIPE_RESTRICTED_KEY) {
    return Response.redirect(`${origin}/?checkout=configuration-error`, 303);
  }

  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return Response.redirect(`${origin}/?checkout=invalid`, 303);
  }

  const stripeClient = new Stripe(env.STRIPE_RESTRICTED_KEY, {
    apiVersion: "2026-07-29.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
  });
  let checkoutSession;
  try {
    checkoutSession = await stripeClient.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error("stripe_checkout_retrieve_failed", error?.type || "unknown");
    return Response.redirect(`${origin}/?checkout=invalid`, 303);
  }
  if (checkoutSession.payment_status === "unpaid") {
    return Response.redirect(`${origin}/?checkout=pending`, 303);
  }
  if (checkoutSession.payment_status !== "paid"
    || checkoutSession.metadata?.product_key !== "premium_lifetime") {
    return Response.redirect(`${origin}/?checkout=unpaid`, 303);
  }

  const customer = await grantPremium(env.DB, checkoutSession);
  const session = await createSession(env.DB, customer.customerId);
  return new Response(null, {
    status: 303,
    headers: {
      location: `${origin}/?checkout=success`,
      "set-cookie": session.cookie,
      "cache-control": "no-store",
    },
  });
}
