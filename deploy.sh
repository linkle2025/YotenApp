#!/bin/bash

# デプロイスクリプト
# 使用方法: ./deploy.sh

set -e  # エラーが発生したら即座に終了

echo "=========================================="
echo "YotenApp デプロイスクリプト"
echo "=========================================="

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 環境変数ファイルの確認
if [ ! -f .env.prod ]; then
    echo -e "${RED}エラー: .env.prod ファイルが見つかりません${NC}"
    echo "サーバー上で .env.prod ファイルを作成してください"
    exit 1
fi

# 環境変数を読み込む
set -a
source .env.prod
set +a

echo -e "${GREEN}[1/6] Gitリポジトリから最新のコードを取得...${NC}"
# Gitリポジトリから最新のコードを取得（既にクローン済みの場合）
if [ -d .git ]; then
    git pull origin main || git pull origin master || echo "Git pull をスキップしました"
else
    echo "Gitリポジトリが見つかりません。手動でコードを配置してください"
fi

echo -e "${GREEN}[2/6] Dockerイメージをビルド...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

echo -e "${GREEN}[3/6] 既存のコンテナを停止・削除...${NC}"
docker-compose -f docker-compose.prod.yml down

echo -e "${GREEN}[4/6] コンテナを起動...${NC}"
docker-compose -f docker-compose.prod.yml up -d

echo -e "${GREEN}[5/6] データベースのマイグレーションを実行...${NC}"
# データベースが準備できるまで待機
sleep 5
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --noinput || echo "マイグレーションをスキップしました"

echo -e "${GREEN}[6/6] 静的ファイルを収集...${NC}"
docker-compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput || echo "静的ファイルの収集をスキップしました"

echo ""
echo -e "${GREEN}=========================================="
echo "デプロイが完了しました！"
echo "==========================================${NC}"
echo ""
echo "コンテナの状態を確認:"
docker-compose -f docker-compose.prod.yml ps
echo ""
echo "ログを確認:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "コンテナを停止:"
echo "  docker-compose -f docker-compose.prod.yml down"
echo ""
