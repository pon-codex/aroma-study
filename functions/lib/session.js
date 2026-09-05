const COOKIE_NAME = "aroma_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(bytes);
}

export async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

export function readCookie(request, name = COOKIE_NAME) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function createSession(db, customerId) {
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SECONDS;
  await db.prepare(
    "INSERT INTO sessions (token_hash, customer_id, expires_at) VALUES (?, ?, ?)",
  ).bind(tokenHash, customerId, expiresAt).run();
  return {
    token,
    cookie: `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
  };
}

export async function getSession(db, request) {
  const token = readCookie(request);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const now = Math.floor(Date.now() / 1000);
  return db.prepare(`
    SELECT customers.id AS customer_id, customers.email,
      CASE WHEN entitlements.status = 'active' THEN 'premium' ELSE 'free' END AS plan
    FROM sessions
    JOIN customers ON customers.id = sessions.customer_id
    LEFT JOIN entitlements
      ON entitlements.customer_id = customers.id
      AND entitlements.product_key = 'premium_lifetime'
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    LIMIT 1
  `).bind(tokenHash, now).first();
}

export async function deleteSession(db, request) {
  const token = readCookie(request);
  if (token) {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(await hashToken(token)).run();
  }
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
