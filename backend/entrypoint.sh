#!/bin/bash

# データベースが起動するまで待機
echo "Waiting for PostgreSQL..."
python << END
import sys
import time
import psycopg2

host = "$DATABASE_HOST"
port = "$DATABASE_PORT"
user = "$DATABASE_USER"
password = "$DATABASE_PASSWORD"
dbname = "$DATABASE_NAME"

for _ in range(30):
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname=dbname
        )
        conn.close()
        print("PostgreSQL is ready!")
        sys.exit(0)
    except psycopg2.OperationalError:
        print("PostgreSQL is unavailable - sleeping")
        time.sleep(1)

print("Could not connect to PostgreSQL")
sys.exit(1)
END

# マイグレーションを実行
echo "Running migrations..."
python manage.py makemigrations --noinput
python manage.py migrate --noinput

# 静的ファイルを収集（本番環境用）
# python manage.py collectstatic --noinput

echo "Starting server..."
exec "$@"

