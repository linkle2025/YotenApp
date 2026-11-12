import type { MeishikiResult } from "@yoten/meishiki";
import { ELEMENT_INFO, branchElement, stemElement } from "./elements";
import { ExplainTrigger } from "./explain-panel";

/**
 * 大運（10年ごとの運の流れ）。立運の年齢から10年ずつ並べる。
 * 今の年齢（満年齢）が入る運を「いま」として強調する。
 * お手本サイトと立運・干支が一致することを確かめてある（付録D D.5）。
 */
export function TaiunView({ result, age }: { result: MeishikiResult; age: number }) {
  const taiun = result.taiun;
  if (!taiun) {
    return <p className="text-sm text-muted">2040年より後の節入りのデータがないため、大運を出せません。</p>;
  }
  const periods = taiun.periods.filter((p) => p.ageStart >= taiun.ritsuun);

  return (
    <div className="space-y-3">
      <p className="text-sm">
        {taiun.direction}・立運 {taiun.ritsuun}歳
        <span className="ml-2 text-xs text-muted">（年齢は満年齢。いまは {age}歳）</span>
      </p>
      <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" aria-label="大運の一覧">
        {periods.map((p) => {
          const current = age >= p.ageStart && age <= p.ageEnd;
          return (
            <li
              key={p.ageStart}
              aria-current={current ? "true" : undefined}
              className={`flex min-w-16 shrink-0 flex-col items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-2 text-center ${
                current ? "border-primary bg-primary/10" : "border-border bg-surface"
              }`}
            >
              <span className="text-xs text-muted">
                {p.ageStart}〜{p.ageEnd}
              </span>
              <span className="flex flex-col font-serif text-xl leading-tight font-bold">
                <span className={ELEMENT_INFO[stemElement(p.stem)].text}>{p.stem}</span>
                <span className={ELEMENT_INFO[branchElement(p.branch)].text}>{p.branch}</span>
              </span>
              <ExplainTrigger kind="star" name={p.stemStar}>
                <span className="text-xs">{p.stemStar}</span>
              </ExplainTrigger>
              {current && <span className="text-xs font-bold text-primary">いま</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
