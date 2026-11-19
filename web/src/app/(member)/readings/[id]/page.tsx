import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { calculateSkillSheet, getPrefecture } from "@yoten/meishiki";
import { Notice } from "@/components/notice";
import { ELEMENT_INFO, stemElement } from "@/components/reading/elements";
import { FiveElements } from "@/components/reading/five-elements";
import { PillarTable } from "@/components/reading/pillar-table";
import { ExplainProvider, ExplainTrigger } from "@/components/reading/explain-panel";
import { InsightPanel } from "@/components/reading/insight-panel";
import { ReadingActions } from "@/components/reading/reading-actions";
import { SkillSheetView } from "@/components/reading/skill-sheet";
import { TaiunView } from "@/components/reading/taiun";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { japanNow } from "@/lib/birth";
import { isInsightAvailable, insightConfig } from "@/lib/insight/config";
import { countTodayGenerations, getCurrentInsight } from "@/lib/insight/service";
import { getStars, getStems, stemImage } from "@/lib/master";
import { currentResult } from "@/lib/readings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "鑑定表" };

/** 判定の要点の生成（Server Action）は、AI の応答を待つので長めにする（再試行を含めて最大80秒ほど） */
export const maxDuration = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOTICES: Record<string, string> = {
  "profile-saved": "プロフィールを保存し、あなたの命式をつくりました。",
};

/** 鑑定表（04_骨格 4.5、02_要件 F-04・F-05） */
export default function ReadingPage({ params, searchParams }: PageProps<"/readings/[id]">) {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6">
      <Suspense fallback={<ReadingSkeleton />}>
        <ReadingContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ReadingContent({
  params,
  searchParams,
}: {
  params: PageProps<"/readings/[id]">["params"];
  searchParams: PageProps<"/readings/[id]">["searchParams"];
}) {
  const { id } = await params;
  const user = await requireUser(`/readings/${id}`);
  if (!UUID_RE.test(id)) notFound();
  const { notice } = await searchParams;

  // RLS により、本人の記録しか取れない（他人の記録は「見つからない」になる）
  const supabase = await createClient();
  const { data: reading } = await supabase
    .from("readings")
    .select("id, name, is_self, is_favorite, birth_date, birth_time, hour_unknown, birth_place, gender, result")
    .eq("id", id)
    .maybeSingle();
  if (!reading) notFound();

  const result = await currentResult({ ...reading, id: reading.id });
  const sheet = calculateSkillSheet(result);
  const available = isInsightAvailable();
  const [stems, stars, insight, used] = await Promise.all([
    getStems(),
    getStars(),
    getCurrentInsight(reading.id, result, sheet),
    available ? countTodayGenerations(user.id) : Promise.resolve(0),
  ]);
  const remaining = Math.max(0, insightConfig().dailyLimit - used);
  const stem = stems.find((s) => s.name === result.dayStem);

  const title = reading.name ? `${reading.name}さん` : "無題の鑑定";
  const [y, m, d] = reading.birth_date.split("-").map(Number);
  const time = reading.hour_unknown ? "時刻不明" : reading.birth_time?.slice(0, 5);
  const now = japanNow();
  const age =
    now.getUTCFullYear() - y - (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d) ? 1 : 0);
  const place = getPrefecture(reading.birth_place).name;
  const gender = reading.gender === "female" ? "女性" : "男性";
  const correction = result.correction.applied
    ? result.correction.longitudeMinutes + result.correction.equationOfTimeMinutes
    : null;

  const sectionTitle = "text-lg font-bold";
  const card = "card p-5 sm:p-6";
  const element = stemElement(result.dayStem);

  return (
    <ExplainProvider stems={stems} stars={stars}>
    <div className="space-y-4">
      {typeof notice === "string" && NOTICES[notice] && <Notice>{NOTICES[notice]}</Notice>}

      <Link href="/readings" className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-full pr-3 pl-1 font-medium hover:bg-subtle print:hidden">
        <ChevronLeft size={20} aria-hidden />
        記録
      </Link>

      {/* 見出し（F-04-1）：日干を主役にする */}
      <header className={`${card} space-y-4`}>
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className={`flex size-20 shrink-0 items-center justify-center rounded-[22px] sm:size-24 ${ELEMENT_INFO[element].tint}`}
          >
            {stem ? (
              <Image src={stemImage(stem.slug)} alt="" width={64} height={64} className="size-14 sm:size-16" priority />
            ) : (
              <span className={`font-serif text-4xl font-bold ${ELEMENT_INFO[element].text}`}>{result.dayStem}</span>
            )}
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="text-[22px] leading-snug font-bold tracking-tight sm:text-2xl">
              {title}
              {reading.is_self && <span className="tag ml-2 align-middle">あなた</span>}
            </h1>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <ExplainTrigger kind="stem" name={result.dayStem}>
                <span className={`font-serif text-3xl leading-none font-bold ${ELEMENT_INFO[element].text}`}>{result.dayStem}</span>
              </ExplainTrigger>
              {stem && (
                <span className="text-sm text-muted">
                  {stem.reading}・{stem.element_type}
                </span>
              )}
            </p>
            <p className="flex flex-wrap gap-1.5">
              <span className="tag bg-accent text-on-primary">{result.strength.label}</span>
              {result.kakukyoku && <span className="tag">{result.kakukyoku}</span>}
            </p>
          </div>
        </div>
        <dl className="well grid grid-cols-3 gap-2 p-3 text-sm">
          <div>
            <dt className="text-xs text-muted">生年月日</dt>
            <dd className="font-bold">
              {y}年{m}月{d}日
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">時刻・場所</dt>
            <dd className="font-bold">
              {time} {place}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">性別・年齢</dt>
            <dd className="font-bold">
              {gender} {Math.max(0, age)}歳
            </dd>
          </div>
        </dl>
        {correction !== null && (
          <p className="text-xs text-muted">
            出生地と季節による時刻の補正：{correction >= 0 ? "+" : ""}
            {correction}分
          </p>
        )}
        <ReadingActions readingId={reading.id} isFavorite={reading.is_favorite} isSelf={reading.is_self} title={title} />
      </header>

      {/* 区切りへ移動するタブ（内容は1ページに全部並べる） */}
      <nav
        aria-label="鑑定表の区切り"
        className="sticky top-14 z-10 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur lg:hidden print:hidden"
      >
        <div className="flex gap-1 rounded-full bg-subtle p-1">
          {[
            { href: "#skill", label: "スキル" },
            { href: "#meishiki", label: "命式" },
            { href: "#gogyo", label: "五行" },
            { href: "#taiun", label: "大運" },
          ].map((t) => (
            <a
              key={t.href}
              href={t.href}
              className="flex min-h-9 flex-1 items-center justify-center rounded-full text-sm font-bold text-muted transition-colors hover:bg-surface hover:text-text"
            >
              {t.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        {/* 右（パソコン）／上（スマートフォン）：結果と説明 */}
        <div className="space-y-4 lg:order-2">
          <section className="rounded-[var(--radius-xl)] bg-text p-5 text-on-ink sm:p-6 print:bg-surface print:text-text" aria-labelledby="summary-title">
            <h2 id="summary-title" className="text-sm font-bold tracking-widest text-on-ink-accent print:text-primary">
              ひとことで
            </h2>
            <div className="mt-3">
              <InsightPanel readingId={reading.id} available={available} insight={insight} remaining={remaining} />
            </div>
          </section>
          <section id="skill" className={`${card} scroll-mt-32 lg:scroll-mt-20`} aria-labelledby="skill-title">
            <h2 id="skill-title" className={sectionTitle}>
              鑑定スキル表
            </h2>
            <div className="mt-4">
              <SkillSheetView sheet={sheet} insight={insight} />
            </div>
          </section>
        </div>

        {/* 左（パソコン、上下に動かしても見える）／下（スマートフォン）：根拠 */}
        <div className="space-y-4 lg:sticky lg:top-[72px] lg:order-1">
          <section id="meishiki" className={`${card} scroll-mt-32 lg:scroll-mt-20`} aria-labelledby="meishiki-title">
            <h2 id="meishiki-title" className={sectionTitle}>
              命式
            </h2>
            <div className="mt-4">
              <PillarTable result={result} />
            </div>
          </section>
          <section id="gogyo" className={`${card} scroll-mt-32 lg:scroll-mt-20`} aria-labelledby="gogyo-section-title">
            <h2 id="gogyo-section-title" className={sectionTitle}>
              五行バランス
            </h2>
            <div className="mt-4">
              <FiveElements result={result} />
            </div>
          </section>
          <section id="taiun" className={`${card} scroll-mt-32 lg:scroll-mt-20`} aria-labelledby="taiun-title">
            <h2 id="taiun-title" className={sectionTitle}>
              大運
            </h2>
            <div className="mt-4">
              <TaiunView result={result} age={Math.max(0, age)} />
            </div>
          </section>
        </div>
      </div>

      <p className="text-center text-xs text-muted">
        計算ロジック {result.calcVersion}・スキル表 {sheet.version}・解釈ルール {sheet.rulesVersion}
      </p>
    </div>
    </ExplainProvider>
  );
}

function ReadingSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="h-6 w-24 animate-pulse rounded bg-subtle" />
      <div className="h-48 animate-pulse rounded-[var(--radius-xl)] bg-surface" />
      <div className="grid gap-4 lg:grid-cols-[5fr_7fr]">
        <div className="h-96 animate-pulse rounded-[var(--radius-xl)] bg-surface" />
        <div className="h-96 animate-pulse rounded-[var(--radius-xl)] bg-surface" />
      </div>
    </div>
  );
}
