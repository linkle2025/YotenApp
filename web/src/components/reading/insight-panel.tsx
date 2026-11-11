"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createInsight } from "@/app/(member)/readings/[id]/insight-actions";
import type { InsightView } from "@/lib/insight/service";

/** 生成中に順に見せる段階（目安。実際の進み具合とは連動しない） */
const STEPS = [
  "命式を読み取っています",
  "日干の性質と五行の関係を整理しています",
  "職種ごとの説明を書いています",
  "能力ごとの説明を書いています",
  "活かし方をまとめています",
];
const ESTIMATE_SECONDS = 30;

/**
 * 判定の要点の「ひとことで」欄（04_骨格 4.5 の「判定の要点の状態」）
 * 未生成 → ボタン、生成中 → 進み具合、完了 → 要約と活かし方、上限・失敗・停止中 → 理由
 */
export function InsightPanel({
  readingId,
  available,
  insight,
  remaining,
}: {
  readingId: string;
  available: boolean;
  insight: InsightView | null;
  remaining: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null);

  useEffect(() => {
    if (!pending) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => {
      clearInterval(timer);
      setElapsed(0);
    };
  }, [pending]);

  const generate = () =>
    startTransition(async () => {
      setError(null);
      const result = await createInsight(readingId);
      if (result.ok) router.refresh();
      else setError({ message: result.message, retry: result.reason === "failed" });
    });

  if (insight) {
    return (
      <div className="space-y-3">
        <p className="leading-relaxed">{insight.summary}</p>
        <div className="rounded-[var(--radius-sm)] bg-bg p-3">
          <p className="text-sm font-bold">活かし方</p>
          <p className="mt-1 text-sm leading-relaxed">{insight.advice}</p>
        </div>
        <InsightFooter insight={insight} />
      </div>
    );
  }

  if (!available) return <p className="text-sm text-muted">現在、判定の要点はつくれません。</p>;

  if (pending) {
    const step = Math.min(STEPS.length - 1, Math.floor((elapsed / ESTIMATE_SECONDS) * STEPS.length));
    const percent = Math.min(95, Math.round((elapsed / ESTIMATE_SECONDS) * 100));
    return (
      <div role="status" aria-live="polite" className="space-y-3">
        <p className="font-bold">{STEPS[step]}…</p>
        <div className="h-2 overflow-hidden rounded-full bg-bg" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width] duration-1000" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-muted">
          {elapsed}秒経過（目安は約{ESTIMATE_SECONDS}秒）。この画面のままお待ちください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">点数とランクの根拠を、AI が日干を起点に説明します。職種・能力ごとの説明は、スキル表の各項目の下に表示します。</p>
      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error.message}
        </p>
      )}
      {remaining > 0 ? (
        <>
          <button
            type="button"
            onClick={generate}
            className="flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-primary font-bold text-on-primary hover:bg-primary-hover"
          >
            {error?.retry ? "もう一度試す" : "判定の要点をつくる"}
          </button>
          <p className="text-xs text-muted">今日あと{remaining}回つくれます。</p>
        </>
      ) : (
        <p className="text-sm text-muted">今日の生成回数の上限に達しました。明日またお試しください。</p>
      )}
    </div>
  );
}

function InsightFooter({ insight }: { insight: InsightView }) {
  const d = new Date(new Date(insight.createdAt).getTime() + 9 * 3600 * 1000);
  const when = `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return (
    <p className="text-xs text-muted">
      AI（{insight.modelName}）による解説で、断定ではありません。{when} 作成
    </p>
  );
}
