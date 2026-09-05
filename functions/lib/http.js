export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

export function methodNotAllowed() {
  return json({ error: "method_not_allowed" }, 405, { allow: "POST" });
}

export function requireSameOrigin(request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  return !origin || origin === expected;
}

export function publicOrigin(request, env) {
  return env.PUBLIC_APP_URL || new URL(request.url).origin;
}
