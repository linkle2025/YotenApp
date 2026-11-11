import type { Metadata } from "next";
import { Suspense } from "react";
import {
  calculateKimonDay,
  calculateKimonTonkou,
  KimonInputError,
  KYOKUSU_YEARS,
  PREFECTURES,
  type KimonResult,
} from "@yoten/meishiki";
import { requireAdmin } from "@/lib/auth";
import { japanNow } from "@/lib/birth";
import { KimonBoard } from "./kimon-board";

export const metadata: Metadata = { title: "奇門遁甲" };

type Mode = "hour" | "day" | "daily";
const MODES: { value: Mode; label: string }[] = [
  { value: "hour", label: "時盤" },
  { value: "day", label: "日盤" },
  { value: "daily", label: "1日分の時盤" },
];

/** 奇門遁甲（管理者のみ：02_要件 F-10）。入力は URL に持たせ、作った盤をそのまま共有・再表示できるようにする */
export default function KimonPage({ searchParams }: PageProps<"/admin/kimon">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-md)] bg-surface" aria-hidden />}>
      <KimonContent searchParams={searchParams} />
    </Suspense>
  );
}

async function KimonContent({ searchParams }: { searchParams: PageProps<"/admin/kimon">["searchParams"] }) {
  await requireAdmin("/admin/kimon");
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");

  // 既定は今の日本時間
  const now = japanNow();
  const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const mode = (["hour", "day", "daily"].includes(str("mode")) ? str("mode") : "hour") as Mode;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str("date")) ? str("date") : today;
  const hour = str("hour") !== "" ? Number(str("hour")) : now.getUTCHours();
  const minute = str("minute") !== "" ? Number(str("minute")) : 0;
  const place = PREFECTURES.some((p) => p.code === str("place")) ? str("place") : "13";
  const yinYang = str("yy") === "陰" || str("yy") === "陽" ? (str("yy") as "陰" | "陽") : undefined;
  const kyokusu = /^[1-9]$/.test(str("k")) ? Number(str("k")) : undefined;
  const submitted = str("date") !== "";
  const [year, month, day] = date.split("-").map(Number);

  let board: KimonResult | null = null;
  let daily: ReturnType<typeof calculateKimonDay> | null = null;
  let error = "";
  if (submitted) {
    try {
      if (mode === "daily") daily = calculateKimonDay({ year, month, day, place, yinYang, kyokusu });
      else board = calculateKimonTonkou({ type: mode === "day" ? "日盤" : "時盤", year, month, day, hour, minute, place, yinYang, kyokusu });
    } catch (e) {
      if (e instanceof KimonInputError) error = e.message;
      else throw e;
    }
  }

  const field = "mt-1 block min-h-11 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-2";
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
      <form action="/admin/kimon" className="space-y-4 rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <fieldset>
          <legend className="text-sm font-bold">種類</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {MODES.map((m) => (
              <label key={m.value} className="flex items-center gap-1">
                <input type="radio" name="mode" value={m.value} defaultChecked={mode === m.value} className="size-4 accent-[var(--primary)]" />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="text-sm font-bold">日付</span>
          <input type="date" name="date" defaultValue={date} required className={field} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm font-bold">時</span>
            <select name="hour" defaultValue={String(hour)} className={field}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h}時
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold">分</span>
            <select name="minute" defaultValue={String(minute)} className={field}>
              {Array.from({ length: 60 }, (_, m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}分
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="-mt-2 text-xs text-muted">時刻は時盤だけで使います（1日分は0時から2時間ごと）。</p>
        <label className="block">
          <span className="text-sm font-bold">場所</span>
          <select name="place" defaultValue={place} className={field}>
            {PREFECTURES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">時盤の時刻の補正（経度・均時差）に使います。</span>
        </label>
        <details open={Boolean(yinYang || kyokusu)}>
          <summary className="cursor-pointer text-sm text-accent">陰陽・局数を指定する</summary>
          <p className="mt-2 text-xs text-muted">
            局数データは {KYOKUSU_YEARS.join("・")}年分だけです。それ以外の日は、陰陽と局数を両方指定すると作盤できます。
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-sm">陰陽</span>
              <select name="yy" defaultValue={yinYang ?? ""} className={field}>
                <option value="">データから</option>
                <option value="陽">陽遁</option>
                <option value="陰">陰遁</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm">局数</span>
              <select name="k" defaultValue={kyokusu ? String(kyokusu) : ""} className={field}>
                <option value="">データから</option>
                {Array.from({ length: 9 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}局
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
        <button type="submit" className="min-h-12 w-full rounded-[var(--radius-md)] bg-primary font-bold text-on-primary hover:bg-primary-hover">
          作盤する
        </button>
      </form>

      <div className="min-w-0 space-y-4">
        {!submitted && <p className="text-muted">日付などを選んで「作盤する」を押してください。</p>}
        {error && (
          <p role="alert" className="rounded-[var(--radius-md)] border border-danger bg-surface p-4">
            {error}
          </p>
        )}
        {board && (
          <section className="space-y-3">
            <BoardHeader board={board} />
            <div className="max-w-[640px]">
              <KimonBoard board={board} />
            </div>
          </section>
        )}
        {daily && (
          <section className="space-y-4">
            <h2 className="font-bold">
              {year}年{month}月{day}日 1日分の時盤（{PREFECTURES.find((p) => p.code === place)?.name}）
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {daily.slots.map((slot) => (
                <li key={slot.hour} className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
                  <p className="mb-2 text-sm font-bold">
                    {slot.hour}時
                    {slot.ok && (
                      <span className="ml-2 font-normal text-muted">
                        {slot.result.usedPillar.stem}
                        {slot.result.usedPillar.branch}・{slot.result.yinYang}遁{slot.result.kyokusu}局
                      </span>
                    )}
                  </p>
                  {slot.ok ? (
                    <KimonBoard board={slot.result} compact showGuides={false} />
                  ) : (
                    <p role="alert" className="text-sm text-danger">
                      この時刻の盤は作れませんでした：{slot.error.message}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function BoardHeader({ board }: { board: KimonResult }) {
  const p = board.pillars;
  const pillar = (x: { stem: string; branch: string } | null) => (x ? `${x.stem}${x.branch}` : "—");
  const i = board.input;
  const c = board.correction;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-bold">
        {board.type}　{i.year}年{i.month}月{i.day}日{i.hour !== null && ` ${i.hour}:${pad(i.minute ?? 0)}`}
        {c && <span className="ml-2 text-sm font-normal text-muted">{c.placeName}</span>}
      </h2>
      {c && (
        <p className="text-sm text-muted">
          補正後（自然時）：{c.adjusted.year}年{c.adjusted.month}月{c.adjusted.day}日 {c.adjusted.hour}:{pad(c.adjusted.minute)}
          （経度 {c.longitudeMinutes >= 0 ? "+" : ""}
          {c.longitudeMinutes}分、均時差 {c.equationOfTimeMinutes >= 0 ? "+" : ""}
          {c.equationOfTimeMinutes}分）
        </p>
      )}
      <p className="text-sm">
        年 {pillar(p.year)}　月 {pillar(p.month)}　日 {pillar(p.day)}　時 {pillar(p.hour)}
      </p>
      <p className="text-sm">
        {board.yinYang}遁{board.kyokusu}局
        {board.kyokusuSource !== "data" && <span className="text-muted">（指定）</span>}
        {board.kyokusuAlternative && (
          <span className="text-muted">
            （データ上のもう1つの値：{board.kyokusuAlternative.yinYang}遁{board.kyokusuAlternative.kyokusu}局）
          </span>
        )}
        　旬首 {board.junshu}
        {board.chugan && `　中宮 ${board.chugan}`}
        {board.gobuuji && <span className="ml-2 font-bold text-danger">五不遇時</span>}
      </p>
    </div>
  );
}
