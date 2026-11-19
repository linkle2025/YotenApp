import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { calculateKimonTonkou, KICHI_HOUI_MIN_SCORE, KimonInputError, kichiHouiMark, PREFECTURES, type KimonResult } from "@yoten/meishiki";
import { KimonBoard } from "@/components/kimon/kimon-board";
import { requireUser } from "@/lib/auth";
import { KIMON_PLACE_DEFAULT, pad2 } from "@/lib/kimon/kichi";

export const metadata: Metadata = { title: "時盤" };

/** 吉方位の時間の時盤（「時盤を表示」の行き先）。日時と場所は URL から読む */
export default function KimonBoardPage({ searchParams }: PageProps<"/kimon/board">) {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-6">
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-[var(--radius-xl)] bg-surface" aria-hidden />}>
        <BoardContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function BoardContent({ searchParams }: { searchParams: PageProps<"/kimon/board">["searchParams"] }) {
  await requireUser("/kimon");
  const params = await searchParams;
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const place = PREFECTURES.some((p) => p.code === str("place")) ? str("place") : KIMON_PLACE_DEFAULT;
  const back = `/kimon?place=${place}`;

  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str("date"));
  const time = /^(\d{2}):(\d{2})$/.exec(str("time"));
  let board: KimonResult | null = null;
  let error = "日時が正しくありません。";
  if (date && time) {
    try {
      board = calculateKimonTonkou({
        type: "時盤",
        year: Number(date[1]),
        month: Number(date[2]),
        day: Number(date[3]),
        hour: Number(time[1]),
        minute: Number(time[2]),
        place,
      });
    } catch (e) {
      if (e instanceof KimonInputError) error = e.message;
      else throw e;
    }
  }

  const backLink = (
    <Link href={back} className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-full pr-3 pl-1 font-medium hover:bg-subtle print:hidden">
      <ChevronLeft size={20} aria-hidden />
      今週の吉方位
    </Link>
  );

  if (!board) {
    return (
      <div className="space-y-4">
        {backLink}
        <p role="alert" className="rounded-[var(--radius-xl)] bg-danger-tint p-5">
          {error}
        </p>
      </div>
    );
  }

  const i = board.input;
  const sei = board.palaces.find((p) => p.hachimon === "生");
  const isKichi =
    !board.gobuuji && sei !== undefined && sei.score !== null && sei.score >= KICHI_HOUI_MIN_SCORE && sei.kyokaku.length === 0;
  const mark = sei && isKichi ? kichiHouiMark(sei.position) : null;

  return (
    <div className="space-y-4">
      {backLink}
      <header className="card space-y-3 p-5">
        <h1 className="text-[22px] leading-snug font-bold tracking-tight">
          {i.year}年{i.month}月{i.day}日 {i.hour}:{pad2(i.minute ?? 0)}ごろの時盤
        </h1>
        <p className="text-sm text-muted">
          {board.correction?.placeName}・{board.usedPillar.stem}
          {board.usedPillar.branch}の刻・{board.yinYang}遁{board.kyokusu}局
        </p>
        {sei && (
          <p className={`rounded-[14px] px-4 py-3 text-sm ${isKichi ? "bg-primary-tint" : "bg-bg"}`}>
            {mark && <span className="mr-1 font-bold text-primary">{mark}</span>}
            生門は<span className="font-bold">{sei.direction}</span>
            {sei.score !== null && `（${sei.score}点）`}
            {isKichi ? "。この時間の吉方位です。" : "。この時間は吉方位の条件を満たしていません。"}
          </p>
        )}
      </header>
      <section className="card p-4 sm:p-5" aria-label="時盤">
        <KimonBoard board={board} />
      </section>
    </div>
  );
}
