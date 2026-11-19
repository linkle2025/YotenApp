import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { findKichiHoui, KICHI_HOUI_MIN_SCORE, PREFECTURES, toMinutes, type CivilDateTime, type KichiHouiSlot } from "@yoten/meishiki";
import { requireUser } from "@/lib/auth";
import { japanNow } from "@/lib/birth";
import { KIMON_PLACE_DEFAULT, kimonBoardHref, pad2 } from "@/lib/kimon/kichi";
import { PlaceSelect } from "./place-select";

export const metadata: Metadata = { title: "今週の吉方位" };

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
const PLACE_OPTIONS = PREFECTURES.map((p) => ({ code: p.code, name: p.name }));

/**
 * 今週の吉方位（会員なら誰でも）
 * 時盤で、生門の宮が70点以上・その宮に凶格なし・五不遇時でない時間を、今日から7日分並べる。
 * 盤そのものは出さず、「時盤を表示」で別の画面に開く。
 */
export default function KimonPage({ searchParams }: PageProps<"/kimon">) {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-8">
      <h1 className="text-[26px] font-bold tracking-tight">今週の吉方位</h1>
      <p className="mt-1 text-sm text-muted">奇門遁甲の時盤から、今日から7日間の吉方位の時間と方角をお知らせします。</p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-[var(--radius-xl)] bg-surface" aria-hidden />}>
        <KimonContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function KimonContent({ searchParams }: { searchParams: PageProps<"/kimon">["searchParams"] }) {
  await requireUser("/kimon");
  const params = await searchParams;
  const place =
    typeof params.place === "string" && PREFECTURES.some((p) => p.code === params.place) ? params.place : KIMON_PLACE_DEFAULT;

  const now = japanNow();
  const nowMinutes = toMinutes({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
    hour: now.getUTCHours(),
    minute: now.getUTCMinutes(),
  });
  const result = findKichiHoui({
    start: { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() },
    days: 7,
    place,
  });
  // 終わった時間は出さない
  const days = result.days.map((d) => ({ ...d, slots: d.slots.filter((s) => toMinutes(s.end) > nowMinutes) }));
  const total = days.reduce((n, d) => n + d.slots.length, 0);

  return (
    <div className="mt-6 space-y-5">
      <div className="card space-y-4 p-5">
        <PlaceSelect places={PLACE_OPTIONS} value={place} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt>
            <span className="tag bg-primary text-on-primary">◎</span>
          </dt>
          <dd>生門が南にある時間</dd>
          <dt>
            <span className="tag bg-primary-tint text-primary">◯</span>
          </dt>
          <dd>生門が北東・南西にある時間</dd>
        </dl>
        <p className="text-xs text-muted">
          吉方位：生門のある方位の点数が{KICHI_HOUI_MIN_SCORE}点以上で、その方位に凶格がなく、五不遇時でもない時間です。時刻は{result.placeName}
          の時計の時刻です（場所の経度と季節による時刻のずれを補正しています）。
        </p>
      </div>

      {total === 0 && days.every((d) => !d.unavailable) && (
        <p className="well p-5 text-center text-sm text-muted">この7日間に吉方位の時間はありません。</p>
      )}

      <ol className="space-y-5">
        {days.map((d, i) => {
          const weekday = WEEK[new Date(Date.UTC(d.date.year, d.date.month - 1, d.date.day)).getUTCDay()];
          return (
            <li key={`${d.date.month}-${d.date.day}`} aria-labelledby={`day-${i}`}>
              <h2 id={`day-${i}`} className="flex items-baseline gap-2">
                <span className="text-lg font-bold">
                  {d.date.month}月{d.date.day}日（{weekday}）
                </span>
                {i === 0 && <span className="tag">今日</span>}
                <span className="ml-auto text-xs text-muted">{d.slots.length}件</span>
              </h2>
              {d.unavailable && (
                <p className="mt-2 text-sm text-muted">
                  {d.date.year}年の局数データがまだないため、この日は一部またはすべての時間を判定できません。
                </p>
              )}
              {d.slots.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {d.slots.map((s) => (
                    <SlotRow key={toMinutes(s.start)} slot={s} place={place} />
                  ))}
                </ul>
              ) : (
                !d.unavailable && <p className="mt-2 text-sm text-muted">吉方位の時間はありません。</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SlotRow({ slot, place }: { slot: KichiHouiSlot; place: string }) {
  return (
    <li className="flex items-center gap-3 rounded-[18px] bg-surface py-3 pr-2 pl-4 shadow-[0_1px_2px_rgba(31,27,22,.04)]">
      <span
        aria-label={slot.mark === "◎" ? "とくに良い（南）" : slot.mark === "◯" ? "良い（北東・南西）" : undefined}
        className={`flex size-11 shrink-0 items-center justify-center rounded-[13px] text-lg font-bold ${
          slot.mark === "◎" ? "bg-primary text-on-primary" : slot.mark === "◯" ? "bg-primary-tint text-primary" : "bg-subtle text-muted"
        }`}
      >
        {slot.mark ?? <span aria-hidden>・</span>}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold tabular-nums">
          {time(slot.start)}〜{time(slot.end)}
        </p>
        <p className="text-sm">
          <span className="font-bold">{slot.direction}</span>
          <span className="ml-2 text-muted">
            {slot.score}点・{slot.hourPillar}の刻
          </span>
        </p>
      </div>
      <Link href={kimonBoardHref(slot.boardTime, place)} className="link flex min-h-11 shrink-0 items-center gap-0.5 rounded-full px-3 text-sm hover:bg-subtle">
        時盤を表示
        <ChevronRight size={16} aria-hidden />
      </Link>
    </li>
  );
}

const time = (t: CivilDateTime) => `${t.hour}:${pad2(t.minute)}`;
