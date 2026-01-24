# 四柱推命アプリケーション

Webブラウザおよびスマートフォンアプリで動作する四柱推命アプリケーションです。

## プロジェクト構成

```
YotenApp/
├── backend/          # Django + Django REST Framework (API)
├── frontend/         # React.js (Web UI)
├── mobile/          # React Native (将来実装)
└── doc/             # プロジェクトドキュメント
```

## 📚 ドキュメント

このプロジェクトの詳細なドキュメントは **[doc/](./doc/)** ディレクトリに集約されています。

- **[doc/README.md](./doc/README.md)** - ドキュメント目次（全ドキュメント一覧）
- **[doc/バックエンド構成.md](./doc/バックエンド構成.md)** - バックエンドAPI仕様
- **[doc/フロントエンド構成.md](./doc/フロントエンド構成.md)** - フロントエンド構成
- **[doc/四柱推命計算ロジック.md](./doc/四柱推命計算ロジック.md)** - 計算ロジック詳細
- **[doc/サーバー運用ガイド.md](./doc/サーバー運用ガイド.md)** - Docker運用方法

その他、機能説明、開発支援、テストドキュメントなど多数のドキュメントが含まれています。詳しくは [doc/README.md](./doc/README.md) をご覧ください。

## 技術スタック

### バックエンド
- Django 4.2.7
- Django REST Framework 3.14.0
- PostgreSQL
- JWT認証 (djangorestframework-simplejwt)

### フロントエンド
- React.js 18.2.0
- React Router 6.20.0
- Axios 1.6.2

## セットアップ手順

### Dockerを使用する場合（推奨）

最も簡単な方法です。Docker Desktopがインストールされている必要があります。

```bash
# リポジトリのルートディレクトリで実行
docker-compose up --build -d

# ログを確認
docker-compose logs -f

# 停止
docker-compose down
```

アクセス：
- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:8000
- 管理画面: http://localhost:8000/admin/

### ローカル環境で実行する場合

#### バックエンド

1. PostgreSQLデータベースを作成
2. `backend/`ディレクトリに移動
3. 仮想環境を作成・有効化
4. 依存パッケージをインストール
5. `.env`ファイルを作成して環境変数を設定
6. マイグレーションを実行

詳細は `backend/README.md` を参照してください。

#### フロントエンド

1. `frontend/`ディレクトリに移動
2. 依存パッケージをインストール (`npm install`)
3. 開発サーバーを起動 (`npm start`)

詳細は `frontend/README.md` を参照してください。

## 機能

- ユーザー登録・ログイン
- 四柱推命計算（生年月日時から四柱を計算）
- 計算履歴の保存・閲覧
- お気に入り登録
- 計算結果の共有

## 開発

### Dockerを使用する場合

```bash
# 全てのサービスを起動
docker-compose up -d

# ログを表示
docker-compose logs -f

# バックエンドのみのログ
docker-compose logs -f backend

# コンテナ内でコマンド実行
docker-compose exec backend python manage.py createsuperuser
docker-compose exec backend python manage.py shell

# 停止
docker-compose down
```

### ローカル環境の場合

バックエンドとフロントエンドを別々のターミナルで起動してください。

```bash
# バックエンド (ポート8000)
cd backend
python manage.py runserver

# フロントエンド (ポート3000)
cd frontend
npm start
```

## Docker コマンド

```bash
# ビルドして起動
docker-compose up --build -d

# 停止
docker-compose stop

# 停止して削除
docker-compose down

# ログ確認
docker-compose logs -f

# コンテナの状態確認
docker-compose ps

# データベースも含めて完全削除
docker-compose down -v
```

