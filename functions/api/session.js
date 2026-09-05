import { json } from "../lib/http.js";
import { getSession } from "../lib/session.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const localPreview = ["localhost", "127.0.0.1"].includes(url.hostname)
    && url.searchParams.get("preview") === "premium";
  if (localPreview) {
    return json({ plan: "premium", preview: true, configured: true });
  }

  if (!env.DB) return json({ plan: "free", configured: false });

  const session = await getSession(env.DB, request);
  return json({
    plan: session?.plan === "premium" ? "premium" : "free",
    email: session?.email || null,
    configured: Boolean(
      env.STRIPE_RESTRICTED_KEY && env.STRIPE_WEBHOOK_SECRET
      && env.STRIPE_PRICE_ID && env.DB,
    ),
  });
}
