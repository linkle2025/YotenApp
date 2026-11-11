import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "general" | "fortuneteller" | "admin";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  selfReadingId: string | null;
};

/**
 * ログイン中の会員（いなければ null）
 * Cookie を読むので、呼ぶ画面の部品は <Suspense> の内側に置く。
 * 利用停止中の会員は、ログインしていない扱いにする。
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, status, self_reading_id")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!profile || profile.status !== "active") return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    displayName: profile.display_name,
    role: profile.role as Role,
    selfReadingId: profile.self_reading_id,
  };
}

/** 会員の画面用：ログインしていなければログイン画面へ（戻り先付き） */
export async function requireUser(currentPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  return user;
}
