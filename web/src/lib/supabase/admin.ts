import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * サーバーだけで使う管理用クライアント（Secret key。RLS を通らない）
 * 使う場面を限る：鑑定記録の書き込み（計算結果の改ざん防止）と退会（認証ユーザーの削除）。
 * 呼ぶ前に、必ずログイン中の会員本人であることを確かめること。
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("環境変数 SUPABASE_SECRET_KEY が設定されていません（web/.env.example を参照）");
  return createClient(supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
