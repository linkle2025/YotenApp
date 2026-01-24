# 四柱推命アプリ - バックエンド

## セットアップ

1. 仮想環境の作成と有効化
```bash
python -m venv venv
# Windows
.\venv\Scripts\Activate.ps1
# Linux/Mac
source venv/bin/activate
```

2. 依存パッケージのインストール
```bash
pip install -r requirements.txt
```

3. PostgreSQLデータベースの作成
```sql
CREATE DATABASE yotenapp;
```

4. 環境変数の設定
`.env`ファイルを作成し、以下の内容を設定：
```
SECRET_KEY=your-secret-key-here
DEBUG=True
DATABASE_NAME=yotenapp
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
```

5. マイグレーションの実行
```bash
python manage.py makemigrations
python manage.py migrate
```

6. スーパーユーザーの作成（オプション）
```bash
python manage.py createsuperuser
```

7. 開発サーバーの起動
```bash
python manage.py runserver
```

## API エンドポイント

- `POST /api/auth/register/` - ユーザー登録
- `POST /api/token/` - ログイン（JWTトークン取得）
- `POST /api/token/refresh/` - トークンリフレッシュ
- `GET /api/auth/user/` - 現在のユーザー情報
- `POST /api/fortune/calculate/` - 四柱推命計算
- `GET /api/fortune/history/` - 計算履歴一覧
- `GET /api/fortune/history/{id}/` - 計算結果詳細
- `DELETE /api/fortune/history/{id}/delete/` - 履歴削除
- `PATCH /api/fortune/history/{id}/favorite/` - お気に入り登録/解除
- `GET /api/fortune/share/{id}/` - 共有用URL生成

