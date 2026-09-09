# 精油の栞 運用手順

## 毎週の確認

1. `https://seiyu-shiori.com/api/health` が `204` を返すことを確認する。
2. Cloudflare Pagesの最新Production deploymentが成功していることを確認する。
3. Stripe WorkbenchのWebhook送信先で、失敗した配信がないことを確認する。
4. Resend Logsで購入完了メール・復元メールの配信失敗がないことを確認する。
5. `support@seiyu-shiori.com` の受信と返信ができることを確認する。

ヘルスチェックは秘密情報や設定値を本文へ出さない。正常時は `204`、設定不足またはD1接続エラー時は `503` のみを返す。

## 購入後に有料版が開かない場合

1. Stripeで該当する支払いが成功しているか確認する。
2. `checkout.session.completed` のWebhookが `200 OK` か確認する。
3. D1の `entitlements` で購入者の権限が `active` か確認する。
4. 購入者へ「購入を復元」から購入時のメールアドレスを入力してもらう。
5. Resendで復元メールの配信状態を確認する。

購入者へカード番号、CVC、Stripeの秘密鍵を尋ねない。

## 返金時

1. Stripeの支払い詳細から、対象取引と金額を再確認する。
2. 全額返金を実行する。
3. `charge.refunded` のWebhookが `200 OK` になったことを確認する。
4. D1の該当権限が `revoked` になり、アプリが無料版へ戻ることを確認する。
5. カード会社への反映に時間がかかる場合があることを購入者へ案内する。

## Webhook失敗時

1. Stripe WorkbenchでHTTPステータスとイベント内容を確認する。
2. Cloudflare PagesのFunctionsログで同時刻のエラーを確認する。
3. D1、Stripe、Resendの設定名が欠けていないか確認する。値そのものはログや画面共有へ出さない。
4. 原因を修正してデプロイ後、Stripeから対象イベントを再送する。
5. 再送後に権限とメール送信履歴を確認する。

## 秘密情報の管理

- Stripeは必要最小限の制限付きキーを使用する。
- Stripeキー、Webhook署名シークレット、Resend APIキーはCloudflareの暗号化された変数だけに保存する。
- GitHub、ソースコード、問い合わせメール、ログへ秘密情報を貼らない。
- 漏えいの疑いがある場合は直ちに対象キーを失効・再発行し、WorkbenchとCloudflareログを確認する。
- 本番と検証環境でキーを共有しない。

## 変更前後の確認

1. D1のスキーマ変更前にTime Travelの復元可能期間を確認する。
2. `npm test` と `npm run check` を実行する。
3. GitHubの `main` へ反映し、CloudflareのProduction deployment完了を確認する。
4. 無料版10種、購入モーダル、法務ページ、復元フォームを確認する。
5. 決済関連を変更した場合は、小額の本番購入・復元・全額返金まで再確認する。
