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

現行版（`frontend/`）も docker compose で 3000 番を使うため、同時に動かすときは `pnpm dev -p 3100` のように番号を変えてください。

## デプロイ

Vercel のプロジェクトの起点（Root Directory）を `web` にします。`master` へのプッシュで本番、プルリクエストでプレビューが作られます（設定前）。
