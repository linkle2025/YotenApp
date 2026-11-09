# supabase（新版のデータベースと認証）

新版のテーブル定義・アクセス制御（RLS）・初期データ・テストです。仕様は [新仕様書/03_構造.md](../新仕様書/03_構造.md) の 3.5（権限）と 3.7（データの形）です。

| パス | 内容 |
|---|---|
| `config.toml` | 手元で動かす Supabase の設定（ポートは 56421〜。認証：メール確認あり、パスワード8文字以上で英字と数字、変更時は再認証） |
| `migrations/20261109000100_initial_schema.sql` | テーブル（profiles・readings・insights・stems・stars）、RLS、列ごとの権限、管理用の関数 |
| `migrations/20261109000200_master_data.sql` | 十干・通変星の解説（現行版のデータベースから書き出し） |
| `tests/database/rls.test.sql` | アクセス制御のテスト（pgTAP、25件） |

## アクセス制御の考え方

- 会員は自分のデータだけを読み書きできます。管理者でも、他人の鑑定記録は読みません（件数だけ）。
- 会員が直接変えられるのは、プロフィールの表示名・表示モードと、鑑定記録の氏名・お気に入りだけです。
- 鑑定記録の作成と計算結果、判定の要点の作成は、サーバー（Next.js のサーバー処理が service_role キーで）だけが行います。画面からの改ざんを防ぐためです。サーバー側では、書き込む記録の持ち主がログイン中の会員であることを必ず確かめてください。
- 役割（role）と利用状態（status）は、管理者だけが `admin_update_user()` で変えられます。自分自身の役割を下げたり、自分を停止したりはできません。
- 会員の一覧は `admin_list_users()`（管理者だけ）で取得します。メール・最終ログイン・鑑定記録の件数を含みます。
- 利用停止（status = suspended）にした会員のログインを止めるのは、サーバー側の処理で行います（Supabase Auth の ban を併用する想定）。

## 手元での使い方

Docker が必要です。

```bash
supabase start          # 起動（初回は数分）。表示される URL とキーは手元専用の共通値
supabase db reset       # データベースを作り直して、マイグレーションを最初から適用
supabase test db        # アクセス制御のテスト
supabase db advisors --local   # Supabase の検査（安全面・性能面）
supabase stop           # 停止
```

- 管理画面（Studio）：http://127.0.0.1:56423
- 送信されたメールの確認（Mailpit）：http://127.0.0.1:56424

## テーブル定義を変えるとき

1. `supabase migration new 変更内容の名前` で新しいファイルを作り、SQL を書く（既存のマイグレーションは書き換えない。本番に適用済みのため）
2. `supabase db reset` と `supabase test db` で確かめる
3. 本番への反映：`supabase db push`（本番プロジェクトとの紐付け後）
