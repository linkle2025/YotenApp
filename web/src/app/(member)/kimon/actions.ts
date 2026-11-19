"use server";

import { revalidatePath } from "next/cache";
import { findKichiHoui, isValidDate, PREFECTURES, toMinutes } from "@yoten/meishiki";
import { getCurrentUser } from "@/lib/auth";
import { japanNow } from "@/lib/birth";
import { slotKey } from "@/lib/kimon/kichi";
import { createAdminClient } from "@/lib/supabase/admin";

export type PracticeResult = { ok: true } | { ok: false; message: string };

const KINDS = ["生門", "風遁", "玉女守門"];

/**
 * 吉方位を「実践した」として履歴に残す
 * 画面から送られた値は信用せず、その場所・時間・方角が本当に吉方位かをサーバーで計算し直して確かめる。
 * まだ始まっていない時間は実践にできない。同じものを二度押しても1件のまま。
 */
export async function recordPractice(input: { place: string; start: string; kind: string; position: number }): Promise<PracticeResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "ログインの有効期限が切れました。もう一度ログインしてください。" };

  const { place, start, kind, position } = input;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(start);
  if (!m || !PREFECTURES.some((p) => p.code === place) || !KINDS.includes(kind) || !Number.isInteger(position)) {
    return { ok: false, message: "実践を記録できませんでした。画面を読み込み直してください。" };
  }
  const [year, month, day, hour, minute] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (!isValidDate({ year, month, day })) return { ok: false, message: "日付が正しくありません。" };

  // 時間の始まりの日から1日分を計算し直し、同じ時間・理由・方角が吉方位として出るかを確かめる
  const result = findKichiHoui({ start: { year, month, day }, days: 1, place });
  const slot = result.days[0]?.slots.find((s) => slotKey(s.start) === start);
  const hit = slot?.hits.find((h) => h.kind === kind && h.position === position && (h.kind !== "生門" || h.mark !== null));
  if (!slot || !hit) return { ok: false, message: "この時間と方角は、吉方位として確かめられませんでした。" };

  const now = japanNow();
  const nowMinutes = toMinutes({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
    hour: now.getUTCHours(),
    minute: now.getUTCMinutes(),
  });
  if (toMinutes({ year, month, day, hour, minute }) > nowMinutes) {
    return { ok: false, message: "まだ始まっていない時間は、実践にできません。" };
  }

  const iso = (t: { year: number; month: number; day: number; hour: number; minute: number }) =>
    `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}T${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}:00`;
  const { error } = await createAdminClient()
    .from("kimon_practices")
    .insert({
      owner_id: user.id,
      place,
      slot_start: iso(slot.start),
      slot_end: iso(slot.end),
      hour_pillar: slot.hourPillar,
      kind: hit.kind,
      position: hit.position,
      direction: hit.direction,
      mark: hit.mark,
      score: hit.kind === "生門" ? hit.score : null,
    });
  // 23505：すでに実践済み（二度押し）。そのまま成功として扱う
  if (error && error.code !== "23505") {
    return { ok: false, message: "記録できませんでした。時間をおいて、もう一度お試しください。" };
  }
  revalidatePath("/kimon");
  revalidatePath("/me/practices");
  return { ok: true };
}
