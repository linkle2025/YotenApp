"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; message: string };

const ROLES = ["general", "fortuneteller", "admin"] as const;
const STATUSES = ["active", "suspended"] as const;

/** 役割・利用状態の変更。データベースの関数（admin_update_user）が、管理者か・自分自身でないかを確かめる */
export async function updateMember(target: string, role: string, status: string): Promise<Result> {
  const me = await getCurrentUser();
  if (me?.role !== "admin") return { ok: false, message: "管理者としてログインしてください。" };
  if (!ROLES.includes(role as never) || !STATUSES.includes(status as never)) {
    return { ok: false, message: "役割または状態の値が正しくありません。" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_user", { target, new_role: role, new_status: status });
  if (error) {
    return {
      ok: false,
      message: error.code === "42501" ? "自分自身の役割や利用状態は変えられません。" : "変更できませんでした。もう一度お試しください。",
    };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

/** 会員の削除：認証ユーザーを消すと、プロフィール・鑑定記録・判定の要点も連鎖して消える。自分自身は不可 */
export async function deleteMember(target: string): Promise<Result> {
  const me = await getCurrentUser();
  if (me?.role !== "admin") return { ok: false, message: "管理者としてログインしてください。" };
  if (target === me.id) return { ok: false, message: "自分自身のアカウントは削除できません。" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(target);
  if (error) return { ok: false, message: "削除できませんでした。もう一度お試しください。" };
  revalidatePath("/admin/users");
  return { ok: true };
}
