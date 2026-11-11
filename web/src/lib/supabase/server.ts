import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * ログイン中の会員として Supabase を使うクライアント（Server Component・Server Action・Route Handler 用）
 * RLS により、本人のデータだけが読み書きできる。
 */
export async function createClient() {
  // Supabase のクライアントは内部で現在時刻を読む。事前描画（静的な外枠）に含めないよう、リクエスト時の処理だと明示する
  await connection();
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component からは Cookie を書けない。セッションの更新は proxy.ts が行うので無視してよい。
        }
      },
    },
  });
}
