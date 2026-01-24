#!/bin/bash

# マイグレーションを適用するスクリプト

echo "=== マイグレーションを適用します ==="

# Dockerコンテナが起動しているか確認
if docker-compose ps | grep -q "backend.*Up"; then
    echo "✓ バックエンドコンテナが起動しています"
    
    # マイグレーションを適用
    echo "マイグレーションを実行中..."
    docker-compose exec backend python manage.py migrate fortune
    
    if [ $? -eq 0 ]; then
        echo "✓ マイグレーションが正常に完了しました"
    else
        echo "✗ マイグレーションに失敗しました"
        exit 1
    fi
else
    echo "✗ バックエンドコンテナが起動していません"
    echo "以下のコマンドでコンテナを起動してください："
    echo "  docker-compose up -d"
    exit 1
fi

echo ""
echo "=== 完了 ==="
echo "ブラウザをリロードして、命式作成を試してください。"

