export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export async function grantPremium(db, checkoutSession) {
  const email = normalizeEmail(
    checkoutSession.customer_details?.email || checkoutSession.customer_email,
  );
  if (!email) throw new Error("checkout_session_missing_email");

  const stripeCustomerId = typeof checkoutSession.customer === "string"
    ? checkoutSession.customer
    : checkoutSession.customer?.id || null;
  const paymentIntentId = typeof checkoutSession.payment_intent === "string"
    ? checkoutSession.payment_intent
    : checkoutSession.payment_intent?.id || null;
  const now = Math.floor(Date.now() / 1000);

  await db.prepare(`
    INSERT INTO customers (email, stripe_customer_id, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      stripe_customer_id = COALESCE(excluded.stripe_customer_id, customers.stripe_customer_id),
      updated_at = excluded.updated_at
  `).bind(email, stripeCustomerId, now, now).run();

  const customer = await db.prepare("SELECT id FROM customers WHERE email = ? LIMIT 1")
    .bind(email).first();
  if (!customer) throw new Error("customer_upsert_failed");

  await db.prepare(`
    INSERT INTO entitlements (
      customer_id, product_key, status, stripe_checkout_session_id,
      stripe_payment_intent_id, purchased_at, updated_at
    ) VALUES (?, 'premium_lifetime', 'active', ?, ?, ?, ?)
    ON CONFLICT(customer_id, product_key) DO UPDATE SET
      status = 'active',
      stripe_checkout_session_id = excluded.stripe_checkout_session_id,
      stripe_payment_intent_id = excluded.stripe_payment_intent_id,
      updated_at = excluded.updated_at
  `).bind(customer.id, checkoutSession.id, paymentIntentId, now, now).run();

  return { customerId: customer.id, email };
}

export async function revokeByPaymentIntent(db, paymentIntentId) {
  if (!paymentIntentId) return;
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    UPDATE entitlements SET status = 'revoked', updated_at = ?
    WHERE stripe_payment_intent_id = ?
  `).bind(now, paymentIntentId).run();
}
