import { json } from "../lib/http.js";
import { getSession } from "../lib/session.js";
import { premiumOils } from "../lib/premium-content.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const localPreview = ["localhost", "127.0.0.1"].includes(url.hostname)
    && url.searchParams.get("preview") === "premium";
  if (!localPreview && !env.DB) return json({ error: "service_not_configured" }, 503);
  const session = localPreview ? { plan: "premium" } : await getSession(env.DB, request);
  if (session?.plan !== "premium") return json({ error: "premium_required" }, 403);

  return json({ oils: premiumOils });
}
