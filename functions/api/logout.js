import { json, requireSameOrigin } from "../lib/http.js";
import { deleteSession } from "../lib/session.js";

export async function onRequestPost({ request, env }) {
  if (!requireSameOrigin(request)) return json({ error: "invalid_origin" }, 403);
  if (!env.DB) return json({ ok: true });
  const cookie = await deleteSession(env.DB, request);
  return json({ ok: true }, 200, { "set-cookie": cookie });
}
