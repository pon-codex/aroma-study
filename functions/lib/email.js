const SUPPORT_EMAIL = "support@seiyu-shiori.com";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailLayout({ preheader, heading, body, actionLabel, actionUrl, footer }) {
  const safeUrl = escapeHtml(actionUrl);
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;background:#f6f3ed;color:#26352d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f3ed;padding:28px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #ded8cc;border-radius:18px;overflow:hidden;">
      <tr><td style="padding:24px 28px;background:#315542;color:#fff;"><div style="font-size:20px;font-weight:700;">✦ 精油の栞</div><div style="margin-top:5px;font-size:13px;color:#dce9e1;">香りと植物を学ぶカード＆クイズ</div></td></tr>
      <tr><td style="padding:30px 28px;"><h1 style="margin:0 0 18px;font-size:23px;line-height:1.5;color:#26352d;">${escapeHtml(heading)}</h1>${body}
        <p style="margin:26px 0;text-align:center;"><a href="${safeUrl}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#315542;color:#fff;text-decoration:none;font-weight:700;">${escapeHtml(actionLabel)}</a></p>
        <p style="margin:0;font-size:12px;line-height:1.8;color:#6f786f;word-break:break-all;">ボタンを開けない場合：<br><a href="${safeUrl}" style="color:#315542;">${safeUrl}</a></p>
      </td></tr>
      <tr><td style="padding:20px 28px;background:#f0eee8;font-size:12px;line-height:1.8;color:#667068;">${footer}<br>お問い合わせ：<a href="mailto:${SUPPORT_EMAIL}" style="color:#315542;">${SUPPORT_EMAIL}</a></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

async function sendEmail(env, message) {
  if (!env.RESEND_API_KEY || !env.AROMA_FROM_EMAIL) {
    throw new Error("email_not_configured");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.AROMA_FROM_EMAIL,
      to: [message.to],
      subject: message.subject,
      html: message.html,
    }),
  });
  if (!response.ok) throw new Error(`email_delivery_failed_${response.status}`);
}

export async function sendPurchaseEmailOnce(db, env, checkoutSession, appUrl) {
  const email = checkoutSession.customer_details?.email || checkoutSession.customer_email;
  if (!email) throw new Error("purchase_email_missing_recipient");

  const deliveryKey = `purchase:${checkoutSession.id}`;
  const now = Math.floor(Date.now() / 1000);
  const reservation = await db.prepare(`
    INSERT OR IGNORE INTO email_deliveries
      (delivery_key, email_type, recipient, status, created_at, updated_at)
    VALUES (?, 'purchase', ?, 'sending', ?, ?)
  `).bind(deliveryKey, email, now, now).run();
  if (!reservation.meta?.changes) return { duplicate: true };

  const html = emailLayout({
    preheader: "精油の栞 有料版をご購入いただきありがとうございます。",
    heading: "ご購入ありがとうございます",
    body: `<p style="margin:0 0 16px;line-height:1.9;">「精油の栞 有料版」のご購入が完了し、30種の精油カードとすべてのクイズを利用できるようになりました。</p>
      <div style="padding:16px 18px;border-radius:12px;background:#f6f3ed;line-height:1.9;"><strong>お支払い</strong><br>550円（税込）・買い切り<br><strong>今後の追加機能</strong><br>継続学習機能も追加料金なしでご利用いただけます。</div>
      <p style="margin:18px 0 0;line-height:1.9;">別の端末では、アプリの「購入を復元」から購入時のメールアドレスを入力してください。</p>`,
    actionLabel: "精油の栞を開く",
    actionUrl: appUrl,
    footer: "このメールは有料版の購入完了をお知らせするために送信しています。お心当たりがない場合はお問い合わせください。",
  });

  try {
    await sendEmail(env, {
      to: email,
      subject: "精油の栞｜有料版のご購入ありがとうございます",
      html,
    });
    await db.prepare(`
      UPDATE email_deliveries SET status = 'delivered', updated_at = ?
      WHERE delivery_key = ?
    `).bind(Math.floor(Date.now() / 1000), deliveryKey).run();
    return { delivered: true };
  } catch (error) {
    await db.prepare("DELETE FROM email_deliveries WHERE delivery_key = ?")
      .bind(deliveryKey).run();
    throw error;
  }
}

export async function sendRestoreEmail(env, email, link) {
  const html = emailLayout({
    preheader: "購入済みの有料版アクセスを復元します。",
    heading: "有料版へのアクセスを復元",
    body: `<p style="margin:0 0 16px;line-height:1.9;">下のボタンを押すと、この端末で「精油の栞 有料版」を利用できます。</p>
      <div style="padding:16px 18px;border-radius:12px;background:#f6f3ed;line-height:1.9;"><strong>有効期限：15分</strong><br>このリンクは一度だけ使用できます。</div>
      <p style="margin:18px 0 0;line-height:1.9;">この操作を依頼していない場合は、メールを破棄してください。</p>`,
    actionLabel: "有料版を復元する",
    actionUrl: link,
    footer: "安全のため、復元リンクを第三者へ転送しないでください。",
  });
  return sendEmail(env, {
    to: email,
    subject: "精油の栞｜購入済みアクセスの復元",
    html,
  });
}
