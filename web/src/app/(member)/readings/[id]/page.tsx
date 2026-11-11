import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { calculateSkillSheet, getPrefecture } from "@yoten/meishiki";
import { Notice } from "@/components/notice";
import { FiveElements } from "@/components/reading/five-elements";
import { PillarTable } from "@/components/reading/pillar-table";
import { ExplainProvider, ExplainTrigger } from "@/components/reading/explain-panel";
import { InsightPanel } from "@/components/reading/insight-panel";
import { ReadingActions } from "@/components/reading/reading-actions";
import { SkillSheetView } from "@/components/reading/skill-sheet";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
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
  const place = getPrefecture(reading.birth_place).name;
  const gender = reading.gender === "female" ? "女性" : "男性";
  const correction = result.correction.applied
    ? result.correction.longitudeMinutes + result.correction.equationOfTimeMinutes
    : null;

  const sectionTitle = "font-serif text-xl font-bold";
  const card = "rounded-[var(--radius-md)] border border-border bg-surface p-4 shadow-sm sm:p-5";

  return (
    <ExplainProvider stems={stems} stars={stars}>
    <div className="space-y-5">
      {typeof notice === "string" && NOTICES[notice] && <Notice>{NOTICES[notice]}</Notice>}

      {/* 見出し（F-04-1） */}
      <header className="space-y-3">
        <Link href="/readings" className="text-sm text-accent underline-offset-2 hover:underline print:hidden">
          ← 記録
        </Link>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <h1 className="font-serif text-2xl font-bold">
            {title}
            {reading.is_self && <span className="ml-2 align-middle text-sm font-normal text-muted">（あなた）</span>}
          </h1>
        </div>
        <p className="flex flex-wrap items-center gap-x-2">
          {stem && <Image src={stemImage(stem.slug)} alt="" width={64} height={64} className="size-16" priority />}
          <ExplainTrigger kind="stem" name={result.dayStem}>
            <span className="font-serif text-4xl font-bold">{result.dayStem}</span>
          </ExplainTrigger>
          {stem && (
            <span className="text-muted">
              （{stem.reading}）・{stem.element_type}
            </span>
          )}
          <span className="ml-1">
            {result.strength.label}
            {result.kakukyoku && `・${result.kakukyoku}`}
          </span>
        </p>
        <p className="text-sm text-muted">
          {y}年{m}月{d}日 {time} {place} {gender}
          {correction !== null && (
            <span className="block text-xs">
              出生地と季節による時刻の補正：{correction >= 0 ? "+" : ""}
              {correction}分
            </span>
          )}
        </p>
        <ReadingActions readingId={reading.id} isFavorite={reading.is_favorite} isSelf={reading.is_self} title={title} />
      </header>

      {/* 区切りへ移動するタブ（内容は1ページに全部並べる） */}
      <nav
        aria-label="鑑定表の区切り"
        className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-border bg-bg/95 px-4 py-2 backdrop-blur lg:hidden print:hidden"
      >
        {[
          { href: "#skill", label: "スキル表" },
          { href: "#meishiki", label: "命式" },
          { href: "#gogyo", label: "五行" },
        ].map((t) => (
          <a key={t.href} href={t.href} className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm whitespace-nowrap">
            {t.label}
          </a>
        ))}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        {/* 右（パソコン）／上（スマートフォン）：結果と説明 */}
        <div className="space-y-5 lg:order-2">
          <section className={card} aria-labelledby="summary-title">
            <h2 id="summary-title" className={sectionTitle}>
              ひとことで
            </h2>
            <div className="mt-3">
              <InsightPanel readingId={reading.id} available={available} insight={insight} remaining={remaining} />
            </div>
          </section>
          <section id="skill" className={`${card} scroll-mt-16`} aria-labelledby="skill-title">
            <h2 id="skill-title" className={sectionTitle}>
              鑑定スキル表
            </h2>
            <div className="mt-4">
              <SkillSheetView sheet={sheet} insight={insight} />
            </div>
          </section>
        </div>

        {/* 左（パソコン、上下に動かしても見える）／下（スマートフォン）：根拠 */}
        <div className="space-y-5 lg:sticky lg:top-4 lg:order-1">
          <section id="meishiki" className={`${card} scroll-mt-16`} aria-labelledby="meishiki-title">
            <h2 id="meishiki-title" className={sectionTitle}>
              命式
            </h2>
            <div className="mt-4">
              <PillarTable result={result} />
            </div>
          </section>
          <section id="gogyo" className={`${card} scroll-mt-16`} aria-labelledby="gogyo-section-title">
            <h2 id="gogyo-section-title" className={sectionTitle}>
              五行バランス
            </h2>
            <div className="mt-4">
              <FiveElements result={result} />
            </div>
          </section>
        </div>
      </div>

      <p className="text-xs text-muted">
        計算ロジック {result.calcVersion}・スキル表 {sheet.version}・解釈ルール {sheet.rulesVersion}
      </p>
    </div>
    </ExplainProvider>
  );
}

function ReadingSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="h-6 w-24 animate-pulse rounded bg-border" />
      <div className="h-10 w-64 animate-pulse rounded bg-border" />
      <div className="grid gap-5 lg:grid-cols-[5fr_7fr]">
        <div className="h-96 animate-pulse rounded-[var(--radius-md)] bg-surface" />
        <div className="h-96 animate-pulse rounded-[var(--radius-md)] bg-surface" />
      </div>
    </div>
  );
}
