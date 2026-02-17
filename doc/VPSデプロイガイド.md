# VPSデプロイガイド

さくらインターネットのUbuntu 24.04 VPSサーバー上にアプリケーションをデプロイする手順です。

## 前提条件

- Ubuntu 24.04 がインストールされたVPSサーバー
- ドメイン `app.yoten.org` がサーバーに設定済み
- SSL証明書が既に設定済み（または設定可能）
- SSHアクセス権限
- sudo権限を持つユーザー

## 1. サーバー環境の準備

### 1.1 システムの更新

```bash
sudo apt update
sudo apt upgrade -y
```

### 1.2 必要なパッケージのインストール

```bash
# 基本的なツール
sudo apt install -y curl wget git vim ufw

# Dockerのインストール
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Composeのインストール
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 現在のユーザーをdockerグループに追加
sudo usermod -aG docker $USER

# ログアウトして再ログインするか、以下を実行
newgrp docker
```

### 1.3 Nginxのインストール

```bash
sudo apt install -y nginx
```

### 1.4 ファイアウォールの設定

```bash
# UFWの有効化
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 2. アプリケーションコードの配置

### 2.1 プロジェクトディレクトリの作成

```bash
# ホームディレクトリにプロジェクトディレクトリを作成
mkdir -p ~/yotenapp
cd ~/yotenapp
```

### 2.2 Gitリポジトリからクローン（または手動でアップロード）

```bash
# Gitリポジトリからクローンする場合
git clone <your-repository-url> .

# または、手動でファイルをアップロードする場合
# scp や rsync を使用してファイルを転送
```

## 3. 環境変数の設定

### 3.1 `.env.prod` ファイルの作成

プロジェクトのルートディレクトリに `.env.prod` ファイルを作成します：

```bash
cd ~/yotenapp
vim .env.prod
```

以下の内容を設定してください：

```env
# Django設定
SECRET_KEY=your-very-secure-secret-key-here-change-this
DEBUG=False
ALLOWED_HOSTS=app.yoten.org
CORS_ALLOWED_ORIGINS=https://app.yoten.org

# データベース設定
DATABASE_NAME=yotenapp
DATABASE_USER=postgres
DATABASE_PASSWORD=your-secure-database-password-here

# フロントエンド設定
REACT_APP_API_URL=https://app.yoten.org/api

# SSL設定（オプション）
SECURE_SSL_REDIRECT=True
```

**重要**: `SECRET_KEY` は強力なランダム文字列に変更してください。以下のコマンドで生成できます：

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

## 4. Nginxリバースプロキシの設定

### 4.1 Nginx設定ファイルの作成

```bash
sudo cp ~/yotenapp/nginx-proxy.conf /etc/nginx/sites-available/yotenapp
```

### 4.2 SSL証明書のパスを設定

既存のSSL証明書のパスを確認し、`/etc/nginx/sites-available/yotenapp` を編集します：

```bash
sudo vim /etc/nginx/sites-available/yotenapp
```

SSL証明書のパスを適切に設定してください：

```nginx
ssl_certificate /path/to/your/certificate.crt;
ssl_certificate_key /path/to/your/private.key;
```

### 4.3 Nginx設定の有効化

```bash
# シンボリックリンクを作成
sudo ln -s /etc/nginx/sites-available/yotenapp /etc/nginx/sites-enabled/

# デフォルトの設定を無効化（必要に応じて）
sudo rm /etc/nginx/sites-enabled/default

# 設定ファイルの構文チェック
sudo nginx -t

# Nginxを再起動
sudo systemctl restart nginx
```

## 5. アプリケーションのデプロイ

### 5.1 デプロイスクリプトの実行

```bash
cd ~/yotenapp
./deploy.sh
```

### 5.2 手動デプロイ（スクリプトを使用しない場合）

```bash
cd ~/yotenapp

# 環境変数を読み込む
set -a
source .env.prod
set +a

# Dockerイメージをビルド
docker-compose -f docker-compose.prod.yml build

# コンテナを起動
docker-compose -f docker-compose.prod.yml up -d

# マイグレーションを実行
docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate

# 十干・通変星のマスタデータを投入（/stems・/stars ページ表示に必須）
docker-compose -f docker-compose.prod.yml exec backend python manage.py load_stems
docker-compose -f docker-compose.prod.yml exec backend python manage.py load_stars

# 静的ファイルを収集
docker-compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

## 6. スーパーユーザーの作成

Django管理画面にアクセスするためのスーパーユーザーを作成します：

```bash
docker-compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

## 7. 動作確認

### 7.1 コンテナの状態確認

```bash
docker-compose -f docker-compose.prod.yml ps
```

すべてのコンテナが `Up` 状態であることを確認してください。

### 7.2 ログの確認

```bash
# すべてのログ
docker-compose -f docker-compose.prod.yml logs -f

# バックエンドのログ
docker-compose -f docker-compose.prod.yml logs -f backend

# フロントエンドのログ
docker-compose -f docker-compose.prod.yml logs -f frontend

# データベースのログ
docker-compose -f docker-compose.prod.yml logs -f db
```

### 7.3 ブラウザでの確認

- フロントエンド: `https://app.yoten.org`
- バックエンドAPI: `https://app.yoten.org/api/`
- 管理画面: `https://app.yoten.org/api/admin/`

## 8. よくある操作

### 8.1 アプリケーションの再起動

```bash
cd ~/yotenapp
docker-compose -f docker-compose.prod.yml restart
```

### 8.2 アプリケーションの停止

```bash
cd ~/yotenapp
docker-compose -f docker-compose.prod.yml down
```

### 8.3 アプリケーションの更新

```bash
cd ~/yotenapp
git pull  # または最新のコードをアップロード
./deploy.sh
```

### 8.4 データベースのバックアップ

```bash
# バックアップの作成
docker-compose -f docker-compose.prod.yml exec db pg_dump -U postgres yotenapp > backup_$(date +%Y%m%d_%H%M%S).sql

# バックアップの復元
docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres yotenapp < backup_file.sql
```

### 8.5 データベースのマイグレーション

```bash
docker-compose -f docker-compose.prod.yml exec backend python manage.py makemigrations
docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

## 9. トラブルシューティング

### 9.1 コンテナが起動しない

```bash
# ログを確認
docker-compose -f docker-compose.prod.yml logs

# コンテナの状態を確認
docker-compose -f docker-compose.prod.yml ps -a

# コンテナを再ビルド
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### 9.2 データベース接続エラー

```bash
# データベースコンテナの状態を確認
docker-compose -f docker-compose.prod.yml ps db

# データベースのログを確認
docker-compose -f docker-compose.prod.yml logs db

# 環境変数を確認
cat .env.prod
```

### 9.3 Nginxのエラー

```bash
# Nginxの設定を確認
sudo nginx -t

# Nginxのログを確認
sudo tail -f /var/log/nginx/yotenapp_error.log
sudo tail -f /var/log/nginx/error.log
```

**bind() to 0.0.0.0:80/443 failed (98: Address already in use)**

ポート 80 または 443 を別のプロセスが使用しているため、Nginx が起動できていません。まず使用中のプロセスを確認し、必要なら停止してから Nginx を起動してください。

```bash
# 80 と 443 を使っているプロセスを確認
sudo ss -tlnp | grep -E ':80|:443'
# または
sudo lsof -i :80
sudo lsof -i :443
```

よくある原因は **Apache** です。Apache を止めて Nginx を使う場合の例です。

```bash
# Apache の状態確認
sudo systemctl status apache2

# Apache を停止し、自動起動も無効化（Nginx をリバースプロキシとして使う場合）
sudo systemctl stop apache2
sudo systemctl disable apache2

# Nginx を起動
sudo systemctl start nginx
sudo systemctl enable nginx
sudo nginx -t
```

別の Nginx が既に動いている場合は、重複した設定や古いプロセスを確認してください。

```bash
# Nginx プロセス一覧
ps aux | grep nginx

# 設定テスト後にリロード
sudo nginx -t && sudo systemctl reload nginx
```

### 9.4 ポートが既に使用されている

```bash
# ポートの使用状況を確認
sudo netstat -tulpn | grep :8000
sudo netstat -tulpn | grep :3001

# 必要に応じてポートを変更
# docker-compose.prod.yml を編集
```

**ポート5432 (address already in use) が出た場合**

本番サーバーで `docker compose up -d` のみ実行すると、開発用の `docker-compose.yml` が使われ、PostgreSQL がホストの 5432 をバインドしようとして、既存の PostgreSQL や他サービスと衝突します。**本番では必ず本番用 compose と .env.prod を使って起動してください。**

```bash
# 誤って作成されたコンテナ・ネットワークを削除（ボリュームは -v を付けない）
docker compose down

# 本番用で起動（postgres はホストに 5432 を公開しないため競合しない）
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### 9.5 502 Bad Gateway・ログが返ってこない

**502 の原因**  
Nginx は動いているが、アップストリーム（バックエンド 8000 またはフロント 3001）に接続できていません。コンテナが止まっているか、ポートがバインドされていない可能性があります。

**ログコマンドが応答しない場合**  
本番では **必ず本番用 compose を指定**してください。指定しないと別プロジェクトのコンテナを参照し、応答が返らないことがあります。

```bash
# 本番のログ（-f と --env-file を付ける）
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=100

# 特定サービスのみ
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=100 backend
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=100 frontend
```

**502 の確認手順（本番サーバー上で順に実行）**

```bash
# 1. 本番コンテナが動いているか
docker compose -f docker-compose.prod.yml --env-file .env.prod ps -a

# 2. バックエンド・フロントにローカルで応答するか（Nginx を経由しない）
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/

# 3. ポートがリッスンしているか
sudo ss -tlnp | grep -E '8000|3001'

# 4. Nginx のエラーログ（502 の理由が書いてあることが多い）
sudo tail -50 /var/log/nginx/error.log
sudo tail -50 /var/log/nginx/yotenapp_error.log
```

- `ps -a` で backend / frontend が **Up** でない場合は、`logs backend` や `logs frontend` でクラッシュ原因を確認する。
- `curl` が 000 や接続拒否のときは、コンテナが落ちているかポートが違う。
- Nginx の error.log に `connect() failed (111: Connection refused)` とあれば、127.0.0.1:8000 または 3001 に届いていません。

**対処の例**

```bash
# コンテナを再作成して起動
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate

# バックエンドだけ再起動
docker compose -f docker-compose.prod.yml --env-file .env.prod restart backend
```

### 9.6 十干・通変星が表示されない（/stems・/stars が空）

本番DBにマスタデータが入っていないと、十干・通変星のカードが表示されません。以下を実行してマスタを投入してください。

```bash
docker-compose -f docker-compose.prod.yml exec backend python manage.py load_stems
docker-compose -f docker-compose.prod.yml exec backend python manage.py load_stars
```

## 10. セキュリティチェックリスト

- [ ] `SECRET_KEY` が強力なランダム文字列に設定されている
- [ ] `DEBUG=False` が設定されている
- [ ] `ALLOWED_HOSTS` に正しいドメインが設定されている
- [ ] データベースパスワードが強力である
- [ ] ファイアウォールが適切に設定されている
- [ ] SSL証明書が正しく設定されている
- [ ] 定期的なバックアップが設定されている
- [ ] 一般公開前に [セキュリティテストチェックリスト](./セキュリティテストチェックリスト.md) に沿ってテストを実施し、結果を記録する
- [ ] 依存関係の脆弱性スキャン（[脆弱性スキャン手順](./脆弱性スキャン手順.md)）を実施し、重大・高危険は解消してから公開する

## 11. パフォーマンス最適化

### 11.1 Gunicornワーカーの調整

`docker-compose.prod.yml` のバックエンドサービスの `command` を編集して、ワーカー数を調整できます：

```yaml
command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4 --timeout 120
```

ワーカー数の目安: `(2 × CPUコア数) + 1`

### 11.2 静的ファイルのキャッシュ

Nginx設定で静的ファイルのキャッシュを有効化しています。必要に応じて調整してください。

## 12. ログローテーション

Dockerのログが大きくなりすぎないように、`/etc/docker/daemon.json` を設定：

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

設定後、Dockerを再起動：

```bash
sudo systemctl restart docker
```

## 13. 定期メンテナンス

### 13.1 システムの更新

```bash
sudo apt update
sudo apt upgrade -y
```

### 13.2 Dockerイメージのクリーンアップ

```bash
# 未使用のイメージを削除
docker image prune -a

# 未使用のボリュームを削除
docker volume prune
```

## 14. サポート

問題が発生した場合は、以下を確認してください：

1. ログファイル（`docker-compose logs`）
2. Nginxのログ（`/var/log/nginx/`）
3. システムログ（`journalctl -u nginx`）
4. 環境変数の設定（`.env.prod`）
