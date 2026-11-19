import type { InsightContent, SkillSheet } from "@yoten/meishiki";
import { ChevronDown, Info } from "lucide-react";
import { formatScore } from "./elements";

/** ランクの印（S〜D）。上位ほど濃い色にし、文字でも示す */
function rankClass(rank: string) {
  if (rank === "S") return "bg-rank-s text-on-primary";
  if (rank.startsWith("A")) return "bg-primary text-on-primary";
  if (rank.startsWith("B")) return "bg-rank-b text-text";
  if (rank.startsWith("C")) return "bg-rank-c text-text";
  return "bg-rank-d text-muted";
}

export function RankBadge({ rank }: { rank: string }) {
  return (
    <span
      className={`inline-flex h-7 min-w-10 items-center justify-center rounded-[8px] px-1.5 text-[13px] font-bold ${rankClass(rank)}`}
      aria-label={`ランク ${rank}`}
    >
      {rank}
    </span>
  );
}

function Bar({ score, thin = false }: { score: number; thin?: boolean }) {
  return (
    <span className={`block overflow-hidden rounded-full bg-subtle ${thin ? "h-1" : "h-1.5"}`} aria-hidden>
      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
    </span>
  );
}

/** 鑑定スキル表（F-05）：職種・能力を点数の高い順に。能力は内訳を開ける */
export function SkillSheetView({ sheet, insight }: { sheet: SkillSheet; insight?: InsightContent | null }) {
  const jobText = new Map(insight?.jobs.map((j) => [j.key, j.text]));
  const abilityText = new Map(insight?.abilities.map((a) => [a.key, a.text]));
  const jobs = [...sheet.jobs].sort((a, b) => b.score - a.score);
  const abilities = [...sheet.abilities].sort((a, b) => b.score - a.score);
  const abilityName = new Map(sheet.abilities.map((a) => [a.key, a.name]));

  return (
    <div className="space-y-8">
      {sheet.isReference && (
        <p className="well flex gap-2 px-4 py-3 text-sm">
          <Info size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
          <span>出生時刻がわからないため、時柱を除いて計算した<strong>参考値</strong>です。</span>
        </p>
      )}

      <section aria-labelledby="jobs-title">
        <div className="flex items-baseline justify-between">
          <h3 id="jobs-title" className="text-base font-bold">
            向いている職種
          </h3>
          <span className="text-xs text-muted">点数の高い順</span>
        </div>
        <ol className="mt-4 space-y-4">
          {jobs.map((job) => (
            <li key={job.key}>
              <div className="flex items-center gap-3">
                <RankBadge rank={job.rank} />
                <span className="font-bold">{job.name}</span>
                <span className="ml-auto text-xl font-bold tabular-nums">{job.score}</span>
              </div>
              <div className="mt-1.5 pl-[52px]">
                <Bar score={job.score} />
                <p className="mt-1 text-xs text-muted">
                  {job.meaning}（
                  {Object.entries(job.weights)
                    .map(([k, w]) => `${abilityName.get(k as never) ?? k}×${w}`)
                    .join("＋")}
                  ）
                </p>
                {jobText.get(job.key) && (
                  <p className="well mt-2 px-3 py-2 text-sm leading-relaxed">{jobText.get(job.key)}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="abilities-title">
        <div className="flex items-baseline justify-between">
          <h3 id="abilities-title" className="text-base font-bold">
            9つの能力
          </h3>
          <span className="text-xs text-muted">押すと内訳が開きます</span>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {abilities.map((a) => (
            <li key={a.key}>
              <details className="group well h-full p-3 open:bg-surface open:shadow-[inset_0_0_0_1px_var(--border)]">
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-baseline justify-between gap-1">
                    <span className="text-sm font-bold text-muted">{a.name}</span>
                    <ChevronDown size={14} aria-hidden className="text-muted transition-transform group-open:rotate-180" />
                  </span>
                  <span className="my-1 block text-[26px] leading-none font-bold tabular-nums">{a.score}</span>
                  <Bar score={a.score} thin />
                  <span className="mt-1 block text-xs text-muted">{a.meaning}</span>
                  {abilityText.get(a.key) && <span className="mt-2 block text-xs leading-relaxed">{abilityText.get(a.key)}</span>}
                </summary>
                <table className="mt-2 w-full text-xs">
                  <caption className="sr-only">{a.name}の内訳</caption>
                  <tbody>
                    {a.breakdown.map((b, i) => (
                      <tr key={i} className="border-t border-subtle">
                        <td className="py-1">{b.factor}</td>
                        <td className="py-1 text-right tabular-nums">{i > 0 && b.value > 0 ? "+" : ""}
                          {formatScore(b.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {sheet.appliedRules.length > 0 && (
        <section aria-labelledby="rules-title">
          <h3 id="rules-title" className="text-base font-bold">
            読み解きのポイント
          </h3>
          <ul className="mt-3 space-y-3">
            {sheet.appliedRules.map((r) => (
              <li key={r.id} className="well p-4">
                <p className="font-bold">{r.title}</p>
                <p className="mt-1 text-sm">{r.interpretation}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
