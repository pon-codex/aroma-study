import { json } from "../lib/http.js";

const allowedEvents = new Set([
  "app_view",
  "quiz_start",
  "upgrade_view",
  "checkout_start",
  "checkout_error",
  "purchase_success",
  "restore_request",
  "restore_success",
]);

function clean(value, maxLength = 80) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return normalized ? normalized.slice(0, maxLength) : null;
}

export async function onRequestPost({ request, env }) {
  const expectedOrigin = new URL(request.url).origin;
  if (request.headers.get("origin") !== expectedOrigin) {
    return json({ error: "invalid_origin" }, 403);
  }
  if (!env.DB) return json({ error: "analytics_not_configured" }, 503);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 4096) return json({ error: "payload_too_large" }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const eventId = clean(payload?.eventId, 64);
  const sessionId = clean(payload?.sessionId, 64);
  const eventName = clean(payload?.eventName, 40);
  if (!eventId || !sessionId || !allowedEvents.has(eventName)
    || !/^[a-f0-9-]{20,64}$/i.test(eventId)
    || !/^[a-f0-9-]{20,64}$/i.test(sessionId)) {
    return json({ error: "invalid_event" }, 400);
  }

  const path = clean(payload?.path, 120);
  if (path && !path.startsWith("/")) return json({ error: "invalid_path" }, 400);

  await env.DB.prepare(`
    INSERT OR IGNORE INTO analytics_events
      (event_id, session_id, event_name, event_context, event_value,
       source, medium, campaign, path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    eventId,
    sessionId,
    eventName,
    clean(payload?.context, 80),
    clean(payload?.value, 80),
    clean(payload?.source, 80),
    clean(payload?.medium, 80),
    clean(payload?.campaign, 120),
    path,
  ).run();

  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}

export function onRequest() {
  return json({ error: "method_not_allowed" }, 405, { allow: "POST" });
}
