# Cloudflare販売基盤の設定

## 実装済み

- Stripe Checkoutによるオープニング限定550円の買い切り決済
- 継続学習機能の追加後は880円へ改定予定（既存購入者への追加料金なし）
- Stripe Webhookによる購入権限の付与と全額返金時の停止
- HttpOnly Cookieによる30日間のログインセッション
- D1での顧客・購入権限・セッション管理
- 購入済みメールアドレスへの復元リンク送信
- 有料精油データを認証必須APIへ分離
- 本番環境で `?preview=premium` を無効化

## Cloudflareに必要な設定

1. D1データベースを作成し、Pagesプロジェクトへ変数名 `DB` で接続する。
2. `migrations/0001_entitlements.sql` をD1へ適用する。
3. Pagesの暗号化された環境変数へ以下を登録する。
   - `STRIPE_RESTRICTED_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_ID`
   - `PUBLIC_APP_URL=https://aroma-study.pages.dev`
   - `RESEND_API_KEY`
   - `AROMA_FROM_EMAIL`
4. Stripe Webhookの送信先を `https://aroma-study.pages.dev/api/stripe-webhook` に設定する。
5. Webhookイベントとして `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`charge.refunded` を選ぶ。

StripeキーとWebhookシークレットは、ソースコードやGitHubへ保存しない。

## Stripe制限付きキーの最小権限

- Checkout Sessions: Write
- Customers: Write
- Prices: Read
- Products: Read

最初はStripeのテストモードで確認し、購入・購入復元・全額返金による権限停止を確認してから本番キーへ切り替える。

## メール復元

復元機能はResendのHTTPS APIを使用する。`AROMA_FROM_EMAIL` にはResendで認証済みの送信元を設定する。購入履歴の有無は画面上で区別せず、メールアドレスの照合結果が第三者へ漏れないようにしている。

## 開発者プレビュー

`?preview=premium` は `localhost` または `127.0.0.1` のときだけ有効。本番URLでは購入権限がなければ無料版になる。
