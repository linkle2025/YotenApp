-- 関数の実行権限を絞る
-- PostgreSQL は新しい関数に PUBLIC（全員）への EXECUTE を自動で付けるため、
-- ログインしていない人（anon）でも /rest/v1/rpc/ から呼べてしまう。必要なロールだけに付け直す。

-- is_admin()：RLS のポリシーの中で使うので、ログイン中の利用者には実行権限が要る（返すのは自分が管理者かどうかだけ）
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 管理者用の関数：中で is_admin() を確かめて、管理者以外はエラーにしている
revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_update_user(uuid, text, text) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_update_user(uuid, text, text) to authenticated;

-- トリガー専用の関数：誰も直接呼ぶ必要がない（トリガーの実行に EXECUTE 権限は要らない）
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
