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
      <ol className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:px-6" aria-label="大運の一覧">
        {periods.map((p) => {
          const current = age >= p.ageStart && age <= p.ageEnd;
          return (
            <li
              key={p.ageStart}
              aria-current={current ? "true" : undefined}
              className={`flex w-[76px] shrink-0 snap-start flex-col items-center gap-1 rounded-[16px] px-2 py-2.5 text-center ${
                current ? "bg-primary-tint shadow-[inset_0_0_0_2px_var(--primary)]" : "bg-bg"
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
              {current && <span className="tag bg-primary px-2 text-[11px] text-on-primary">いま</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
