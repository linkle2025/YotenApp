# web（新版の画面：Next.js）

陽てん塾 命式作成アプリの新版です。仕様は [新仕様書/](../新仕様書/) を正とします。

- Next.js 16（App Router、Turbopack、Cache Components）
- Tailwind CSS 4。色・書体はデザイントークン（`src/app/globals.css`、仕様: `新仕様書/05_表層.md`）だけを使う
- 計算ロジックは workspace のパッケージ `@yoten/meishiki`（`../packages/meishiki`）

> この版の Next.js は、以前の版から API や決まりが変わっています。コードを書く前に `node_modules/next/dist/docs/` の該当ページを確認してください（`AGENTS.md`）。

## 開発

リポジトリのルートで依存を入れてから、このフォルダで起動します。

```bash
pnpm install          # ルートで
cd web
pnpm dev              # http://localhost:3000
pnpm build            # 本番ビルドの確認
pnpm lint
```

現行版（`frontend/`）も docker compose で 3000 番を使うため、同時に動かすときは `pnpm dev -p 3100` のように番号を変えてください（手元の Supabase が戻り先として許可しているのは 3000 と 3100 です）。

### 環境変数

`.env.example` を `.env.local` にコピーし、手元の Supabase（ルートで `supabase start`）の値を入れます。値は `supabase status` で確認できます。

| 名前 | 中身 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase の API の URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key（ブラウザに出てもよい） |
| `SUPABASE_SECRET_KEY` | Secret key（サーバー専用。鑑定記録の書き込みと退会だけに使う） |

確認メールは、手元では Mailpit（http://127.0.0.1:56424）に届きます。

## 会員まわりの作り

| 画面 | 内容 |
|---|---|
| `/signup` → `/signup/sent` | 表示名・メール・パスワードで登録。確認メールのリンクで `/auth/confirm` を経て `/me/profile?welcome=1` へ |
| `/login` | `?next=` の戻り先へ戻す（サイト内のパスだけ：`src/lib/redirect.ts`） |
| `/forgot-password` → `/reset-password` | 再設定メールのリンクで `/auth/confirm` を経て新しいパスワードを設定 |
| `/home` | 本人の命式の要約。未入力ならプロフィール入力へ誘導 |
| `/me`・`/me/profile`・`/me/password`・`/me/delete` | マイページ・プロフィール（本人の命式を計算して保存）・パスワード変更（今のパスワードを確認）・退会（データをすべて削除） |

### 鑑定・解説・管理の画面

| 画面 | 内容 |
|---|---|
| `/readings/new` | 命式をつくる（氏名は任意）。サーバーで計算して保存し、鑑定表へ |
| `/readings` | 鑑定記録の一覧。氏名検索・お気に入り・並べ替え・続きを表示。削除は5秒間「元に戻す」 |
| `/readings/[id]` | 鑑定表（命式・五行バランス・鑑定スキル表）。天干・通変星を押すと解説のパネル |
| `/jikkan`・`/tsuhensei`（と各 `/[slug]`） | 十干・通変星の解説。ログイン不要・事前生成（`src/lib/master.ts` で1日キャッシュ） |
| `/admin/users` | 管理者だけ。会員の一覧・ロール変更・利用停止・削除（自分自身は不可） |
| `/admin/kimon` | 管理者だけ。奇門遁甲の時盤・日盤・1日分（計算は `@yoten/meishiki` の `calculateKimonTonkou`） |

- 管理者でない人が `/admin` を開くと「見つからない」になる（`requireAdmin()`）。最初の管理者は、Supabase の SQL で `profiles.role` を `admin` にする。
- 十干の画像は旧版から引き継いだもの（`public/img/stems/{slug}.png`）。

- ログインの判定：`src/proxy.ts` がログインの期限を延ばし、未ログインで会員の画面を開いたらログインへ送る。各画面でも `requireUser()`（`src/lib/auth.ts`）で確かめる。
- 計算結果は画面から書き込めない（RLS）。サーバーで `@yoten/meishiki` で計算し、Secret key で保存する（`src/app/(member)/actions.ts`）。
- メールのリンクは `token_hash` 方式と `code` 方式の両方に対応（`src/app/auth/confirm/route.ts`）。Supabase の標準の文面は `code` 方式で、申し込んだのと同じブラウザで開く必要がある。

## デプロイ

Vercel のプロジェクト（`yoten-app`）の起点（Root Directory）を `web` にしています。

- `develop` へのプッシュ → 検証用 https://yoten-app.vercel.app/
- `master` へのプッシュ → 本番 https://app.yoten.org/

Supabase は検証用・本番用で同じプロジェクトを使っています（α版のため）。
