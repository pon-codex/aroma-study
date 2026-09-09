export async function onRequestGet({ env }) {
  const configured = Boolean(
    env.DB
    && env.STRIPE_RESTRICTED_KEY
    && env.STRIPE_WEBHOOK_SECRET
    && env.STRIPE_PRICE_ID
    && env.RESEND_API_KEY
    && env.AROMA_FROM_EMAIL
    && env.PUBLIC_APP_URL,
  );
  if (!configured) {
    return new Response(null, {
      status: 503,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  }

  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  }
}

export function onRequest() {
  return new Response(null, {
    status: 405,
    headers: { allow: "GET", "cache-control": "no-store" },
  });
}
