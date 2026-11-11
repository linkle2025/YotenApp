import type { SkillSheet } from "@yoten/meishiki";
import { formatScore } from "./elements";

/** ランクの印（S〜D）。上位ほど濃い色にし、文字でも示す */
function rankClass(rank: string) {
  if (rank === "S" || rank.startsWith("A")) return "bg-primary text-on-primary";
  if (rank.startsWith("B")) return "bg-accent text-on-primary";
  if (rank.startsWith("C")) return "bg-border text-text";
  return "bg-bg text-muted border border-border";
}

export function RankBadge({ rank }: { rank: string }) {
  return (
    <span
      className={`inline-flex h-7 min-w-9 items-center justify-center rounded-[var(--radius-sm)] px-1.5 text-sm font-bold ${rankClass(rank)}`}
      aria-label={`ランク ${rank}`}
    >
      {rank}
    </span>
  );
}

function Bar({ score }: { score: number }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-bg" aria-hidden>
      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
    </span>
  );
}

/** 鑑定スキル表（F-05）：職種・能力を点数の高い順に。能力は内訳を開ける */
export function SkillSheetView({ sheet }: { sheet: SkillSheet }) {
  const jobs = [...sheet.jobs].sort((a, b) => b.score - a.score);
  const abilities = [...sheet.abilities].sort((a, b) => b.score - a.score);
  const abilityName = new Map(sheet.abilities.map((a) => [a.key, a.name]));

  return (
    <div className="space-y-8">
      {sheet.isReference && (
        <p className="rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2 text-sm">
          ⓘ 出生時刻がわからないため、時柱を除いて計算した<strong>参考値</strong>です。
        </p>
      )}

      <section aria-labelledby="jobs-title">
        <h3 id="jobs-title" className="text-base font-bold">
          向いている職種
        </h3>
        <ol className="mt-3 space-y-3">
          {jobs.map((job) => (
            <li key={job.key}>
              <div className="flex items-center gap-3">
                <RankBadge rank={job.rank} />
                <span className="font-bold">{job.name}</span>
                <span className="ml-auto tabular-nums">{job.score}</span>
              </div>
              <div className="mt-1 pl-12">
                <Bar score={job.score} />
                <p className="mt-1 text-xs text-muted">
                  {job.meaning}（
                  {Object.entries(job.weights)
                    .map(([k, w]) => `${abilityName.get(k as never) ?? k}×${w}`)
                    .join("＋")}
                  ）
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="abilities-title">
        <h3 id="abilities-title" className="text-base font-bold">
          9つの能力
        </h3>
        <p className="mt-1 text-xs text-muted">カードを押すと、点数の内訳が開きます。</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {abilities.map((a) => (
            <li key={a.key}>
              <details className="group h-full rounded-[var(--radius-md)] border border-border bg-surface p-3">
                <summary className="cursor-pointer list-none">
                  <span className="flex items-baseline justify-between">
                    <span className="font-bold">{a.name}</span>
                    <span className="text-xl font-bold tabular-nums">{a.score}</span>
                  </span>
                  <Bar score={a.score} />
                  <span className="mt-1 block text-xs text-muted">{a.meaning}</span>
                </summary>
                <table className="mt-2 w-full text-xs">
                  <caption className="sr-only">{a.name}の内訳</caption>
                  <tbody>
                    {a.breakdown.map((b, i) => (
                      <tr key={i} className="border-t border-border">
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
              <li key={r.id} className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
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
