"use client";

import { useEffect, useState, useTransition } from "react";
import type { DailyAdviceView } from "@/lib/daily/service";
import { createDailyAdvice } from "./daily-actions";

/** 今日の干支アドバイス（管理者のテスト機能）。表示するかどうかは、呼ぶ側（ホーム）で管理者に限る */
export function DailyAdvice({ canGenerate }: { canGenerate: boolean }) {
  const [pending, startTransition] = useTransition();
  const [advice, setAdvice] = useState<DailyAdviceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

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
      const result = await createDailyAdvice();
      if (result.ok) setAdvice(result.advice);
      else setError(result.message);
    });

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="daily-title">
      <div className="flex items-center gap-2">
        <h2 id="daily-title" className="text-sm font-bold text-muted">
          今日の干支とあなたの命式
        </h2>
        <span className="tag">管理者テスト</span>
      </div>

      {advice ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted">
            {advice.today.label}　年：{advice.today.year}　月：{advice.today.month}　日：<b className="text-text">{advice.today.day}</b>
          </p>
          <p className="text-[17px] leading-relaxed font-medium">{advice.content.summary}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[14px] bg-bg p-4">
              <p className="text-sm font-bold">注意するとよいこと</p>
              <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                {advice.content.cautions.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-[14px] bg-bg p-4">
              <p className="text-sm font-bold">冴えること</p>
              <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                {advice.content.strengths.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold">読んだ角度</p>
            <dl className="mt-1.5 space-y-2 text-sm leading-relaxed">
              {advice.content.angles.map((a) => (
                <div key={a.angle}>
                  <dt className="font-bold text-primary">{a.angle}</dt>
                  <dd>{a.text}</dd>
                </div>
              ))}
            </dl>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-muted">洗い出した関係（{advice.relations.length}件）</summary>
            {advice.relations.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {advice.relations.map((r) => (
                  <li key={`${r.today}-${r.natal}-${r.kind}-${r.detail}`}>
                    <span className="tag mr-2">{r.kind}</span>
                    今日の{r.today}柱 × 命式の{r.natal}：{r.detail}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-muted">今日の干支と命式のあいだに、目立つ合・冲・刑・害・破はありません。</p>
            )}
          </details>

          <p className="text-xs text-muted">AI（{advice.modelName}）による読みで、断定ではありません。保存はされません。</p>
          <button type="button" onClick={generate} disabled={pending} className="btn btn-secondary w-full">
            {pending ? `つくっています…（${elapsed}秒）` : "もう一度つくる"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted">
            今日の干支（年・月・日）が、あなたの命式にどう働くかを、日干との関係・五行・天干と地支の関係など、いくつかの角度から AI が読み、注意点と冴えることをアドバイスします。
          </p>
          {error && (
            <p role="alert" className="text-sm font-bold text-danger">
              {error}
            </p>
          )}
          {pending ? (
            <p role="status" aria-live="polite" className="text-sm font-bold">
              命式と今日の干支を読んでいます…（{elapsed}秒経過・目安は約30秒）
            </p>
          ) : (
            <button type="button" onClick={generate} disabled={!canGenerate} className="btn btn-primary w-full">
              今日のアドバイスをつくる
            </button>
          )}
          {!canGenerate && <p className="text-xs text-muted">先にプロフィールで生年月日を入力すると使えます。</p>}
        </div>
      )}
    </section>
  );
}
