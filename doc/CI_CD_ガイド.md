# CI/CD ガイド

## 概要

このプロジェクトでは GitHub Actions を使用して、継続的インテグレーション（CI）と継続的デリバリー（CD）を実装しています。

## ワークフロー構成

### 1. Backend Tests

**ファイル**: `.github/workflows/backend-test.yml`

**目的**: バックエンドのコード品質とテストを自動実行

**トリガー条件**:
- `main`または`develop`ブランチへのpush
- `main`または`develop`ブランチへのPull Request作成
- `backend/`配下のファイル変更時のみ実行

**実行内容**:
1. PostgreSQL 15のサービスコンテナを起動
2. Python 3.9環境をセットアップ
3. pipキャッシュを利用して依存関係をインストール
4. データベースマイグレーションを実行
5. テストスイート全体を実行
6. カバレッジレポートを生成
7. HTMLカバレッジレポートをアーティファクトとしてアップロード

**環境変数**:
- `SECRET_KEY`: テスト用の秘密鍵
- `DEBUG`: True
- `DATABASE_NAME`: test_yotenapp
- `DATABASE_HOST`: localhost

**実行時間**: 約3-5分

---

### 2. Frontend Tests

**ファイル**: `.github/workflows/frontend-test.yml`

**目的**: フロントエンドのテストとビルドを自動実行

**トリガー条件**:
- `main`または`develop`ブランチへのpush
- `main`または`develop`ブランチへのPull Request作成
- `frontend/`配下のファイル変更時のみ実行

**実行内容**:
1. Node.js 18環境をセットアップ
2. npmキャッシュを利用して依存関係をインストール
3. Jestテストを実行（カバレッジ計測付き）
4. カバレッジレポートをアーティファクトとしてアップロード
5. プロダクションビルドを実行
6. ビルド成果物をアーティファクトとしてアップロード

**実行時間**: 約4-6分

---

### 3. Docker Build Test

**ファイル**: `.github/workflows/docker-build.yml`

**目的**: Dockerイメージのビルドとdocker-compose.ymlの検証

**トリガー条件**:
- Dockerfile、docker-compose.yml、ワークフローファイルの変更時

**実行内容**:
1. Docker Buildxをセットアップ
2. バックエンドDockerイメージをビルド
3. フロントエンドDockerイメージをビルド
4. GitHub Actionsキャッシュを利用して高速化
5. docker-compose.ymlの構文チェック

**実行時間**: 約5-8分（キャッシュ利用時）

---

### 4. Linting

**ファイル**: `.github/workflows/lint.yml`

**目的**: コード品質とスタイルのチェック

**トリガー条件**:
- 全ブランチへのpush
- 全ブランチへのPull Request作成

**実行内容**:

#### バックエンド
- **flake8**: Pythonコードの構文エラーをチェック
- **black**: コードフォーマットの一貫性をチェック
- **isort**: importの並び順をチェック

#### フロントエンド
- **ESLint**: JavaScriptコードの構文とベストプラクティスをチェック
- **Prettier**: コードフォーマットの一貫性をチェック

**実行時間**: 約2-3分

---

## ワークフローの確認方法

### GitHub UIでの確認

1. GitHubリポジトリにアクセス
2. 「Actions」タブをクリック
3. 左サイドバーでワークフローを選択
4. 実行履歴とステータスを確認

### ステータスバッジ

README.mdに以下のバッジを追加して、ビルドステータスを表示できます：

```markdown
![Backend Tests](https://github.com/USERNAME/REPO/workflows/Backend%20Tests/badge.svg)
![Frontend Tests](https://github.com/USERNAME/REPO/workflows/Frontend%20Tests/badge.svg)
```

---

## Pull Requestワークフロー

### 1. ブランチ作成

```bash
# 機能開発用ブランチを作成
git checkout -b feature/new-feature

# バグ修正用ブランチを作成
git checkout -b fix/bug-description
```

### 2. コード変更とコミット

```bash
git add .
git commit -m "feat: 新機能の実装"
git push origin feature/new-feature
```

### 3. Pull Request作成

1. GitHubでPull Requestを作成
2. 自動的にCI/CDワークフローが実行される
3. 全てのチェックが緑色（成功）になることを確認
4. コードレビューを依頼

### 4. マージ

- 全てのチェックが成功
- レビューが承認済み
- コンフリクトが解決済み

上記条件を満たしたら、Pull Requestをマージ

---

## ローカルでのCI環境再現

### バックエンドテスト

```bash
# Docker環境でテストを実行
docker-compose exec backend python manage.py test

# カバレッジを生成
docker-compose exec backend coverage run --source='.' manage.py test
docker-compose exec backend coverage report
```

### フロントエンドテスト

```bash
# Docker環境でテストを実行
docker-compose exec frontend npm test -- --watchAll=false --coverage

# ビルドテスト
docker-compose exec frontend npm run build
```

### Linting

```bash
# バックエンド
docker-compose exec backend flake8 .
docker-compose exec backend black --check .
docker-compose exec backend isort --check-only .

# フロントエンド
docker-compose exec frontend npm run lint
docker-compose exec frontend npx prettier --check "src/**/*.{js,jsx,json,css}"
```

---

## アーティファクトの取得

GitHub Actionsで生成されたアーティファクトをダウンロード：

1. 「Actions」タブに移動
2. 該当するワークフロー実行を選択
3. ページ下部の「Artifacts」セクションからダウンロード

**利用可能なアーティファクト**:
- `coverage-report`: テストカバレッジレポート（HTML）
- `build`: フロントエンドのビルド成果物

**保存期間**: 90日間（デフォルト）

---

## 環境変数とシークレット

### GitHub Secretsの設定

機密情報はGitHub Secretsで管理：

1. リポジトリの「Settings」→「Secrets and variables」→「Actions」
2. 「New repository secret」をクリック
3. 以下のシークレットを追加：

| 名前 | 説明 | 例 |
|------|------|-----|
| `PRODUCTION_SECRET_KEY` | 本番環境のDjango秘密鍵 | ランダムな50文字の文字列 |
| `DATABASE_PASSWORD` | 本番データベースのパスワード | 強力なパスワード |
| `DOCKER_HUB_USERNAME` | Docker Hubユーザー名 | your_username |
| `DOCKER_HUB_TOKEN` | Docker Hubアクセストークン | dckr_pat_xxx |

### ワークフローでの使用

```yaml
env:
  SECRET_KEY: ${{ secrets.PRODUCTION_SECRET_KEY }}
  DATABASE_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
```

---

## デプロイワークフロー（今後の拡張）

### ステージング環境へのデプロイ

```yaml
name: Deploy to Staging

on:
  push:
    branches: [ develop ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to staging server
        run: |
          # デプロイスクリプトを実行
```

### 本番環境へのデプロイ

```yaml
name: Deploy to Production

on:
  release:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production server
        run: |
          # 本番デプロイスクリプトを実行
```

---

## トラブルシューティング

### ワークフローが失敗した場合

1. **ログを確認**
   - 失敗したステップのログを展開
   - エラーメッセージを確認

2. **ローカルで再現**
   ```bash
   # 該当するテストをローカルで実行
   python manage.py test apps.accounts.tests.UserRegistrationTests
   ```

3. **依存関係の問題**
   ```bash
   # キャッシュをクリアして再実行
   # GitHubの該当ワークフロー → "Re-run all jobs"
   ```

### よくあるエラー

**エラー**: `ModuleNotFoundError`
- **原因**: 依存関係がインストールされていない
- **解決**: requirements.txt または package.json を確認

**エラー**: `DatabaseError`
- **原因**: データベース接続の問題
- **解決**: 環境変数とサービス設定を確認

**エラー**: `Timeout`
- **原因**: テストが長時間実行されている
- **解決**: テストを最適化するか、タイムアウトを延長

---

## ベストプラクティス

### 1. コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/)を推奨：

```
feat: 新機能を追加
fix: バグ修正
docs: ドキュメント更新
test: テスト追加・修正
refactor: リファクタリング
chore: ビルドプロセスやツールの変更
```

### 2. ブランチ戦略

- `main`: 本番環境
- `develop`: 開発環境
- `feature/*`: 新機能開発
- `fix/*`: バグ修正
- `hotfix/*`: 緊急修正

### 3. Pull Request

- 適切なタイトルと説明を付ける
- 関連するIssueをリンク
- レビュアーを指定
- 全てのチェックが成功してからマージ

### 4. テストカバレッジ

- 最低80%のカバレッジを目標
- 重要な機能は必ずテストを書く
- エッジケースも考慮

---

## 参考リンク

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)

