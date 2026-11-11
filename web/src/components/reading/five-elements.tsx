import { ELEMENT_CYCLE, type Element, type ElementGroup, type MeishikiResult } from "@yoten/meishiki";
import { ELEMENT_INFO, branchElement, formatScore, stemElement } from "./elements";

/**
 * 五行バランス（F-04-4・5）
 * 日干の五行を上に置き、生じる順（木→火→土→金→水）に時計回りで並べた五角形。
 * 点数・日干から見たグループ（比劫・食傷・財・官・印）・該当する干支を表でも示す（図が見えなくても読める）。
 */
export function FiveElements({ result }: { result: MeishikiResult }) {
  const dayElement = stemElement(result.dayStem);
  const start = ELEMENT_CYCLE.indexOf(dayElement);
  const order = ELEMENT_CYCLE.map((_, i) => ELEMENT_CYCLE[(start + i) % 5]);

  const groupOf = new Map<Element, ElementGroup>();
  for (const [group, v] of Object.entries(result.elementGroups) as [ElementGroup, { element: Element }][]) {
    groupOf.set(v.element, group);
  }

  const chars = new Map<Element, string[]>(ELEMENT_CYCLE.map((e) => [e, []]));
  for (const p of [result.pillars.hour, result.pillars.day, result.pillars.month, result.pillars.year]) {
    if (!p) continue;
    chars.get(stemElement(p.stem))!.push(p.stem);
    chars.get(branchElement(p.branch))!.push(p.branch);
  }

  const max = Math.max(20, ...ELEMENT_CYCLE.map((e) => result.fiveElements[e]));
  const size = 260;
  const c = size / 2;
  const radius = 88;
  const point = (i: number, r: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [c + r * Math.cos(angle), c + r * Math.sin(angle)] as const;
  };
  const polygon = (r: (i: number) => number) => order.map((_, i) => point(i, r(i)).join(",")).join(" ");

  const g = result.elementGroups;
  const own = g["比劫"].score + g["印"].score;
  const other = g["食傷"].score + g["財"].score + g["官"].score;

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[280px]" role="img" aria-labelledby="gogyo-title">
        <title id="gogyo-title">{`五行バランスの図。${order
          .map((e) => `${ELEMENT_INFO[e].label} ${formatScore(result.fiveElements[e])}点`)
          .join("、")}`}</title>
        {[0.25, 0.5, 0.75, 1].map((s) => (
          <polygon key={s} points={polygon(() => radius * s)} fill="none" stroke="var(--border)" strokeWidth="1" />
        ))}
        <polygon
          points={polygon((i) => (radius * result.fiveElements[order[i]]) / max)}
          fill="var(--primary)"
          fillOpacity="0.18"
          stroke="var(--primary)"
          strokeWidth="2"
        />
        {order.map((e, i) => {
          const [x, y] = point(i, radius + 24);
          return (
            <g key={e}>
              <text x={x} y={y - 4} textAnchor="middle" fontSize="18" fontWeight="700" fill={ELEMENT_INFO[e].stroke}>
                {ELEMENT_INFO[e].label}
              </text>
              <text x={x} y={y + 13} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
                {groupOf.get(e)} {formatScore(result.fiveElements[e])}
              </text>
            </g>
          );
        })}
      </svg>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">五行の点数</caption>
        <thead>
          <tr className="text-xs text-muted">
            <th scope="col" className="py-1 text-left font-normal">五行</th>
            <th scope="col" className="py-1 text-left font-normal">日干から見て</th>
            <th scope="col" className="py-1 text-right font-normal">点数</th>
            <th scope="col" className="py-1 pl-3 text-left font-normal">該当する干支</th>
          </tr>
        </thead>
        <tbody>
          {order.map((e) => (
            <tr key={e} className="border-t border-border">
              <td className="py-1.5">
                <span className={`inline-flex size-7 items-center justify-center rounded-full font-bold ${ELEMENT_INFO[e].tint} ${ELEMENT_INFO[e].text}`}>
                  {ELEMENT_INFO[e].label}
                </span>
              </td>
              <td className="py-1.5">{groupOf.get(e)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatScore(result.fiveElements[e])}</td>
              <td className="py-1.5 pl-3 font-serif">{chars.get(e)!.join(" ") || <span className="text-muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-[var(--radius-sm)] bg-bg p-3 text-sm">
        <dt className="font-bold">身旺・身弱</dt>
        <dd>
          <span className="font-bold">{result.strength.label}</span>
          <span className="block text-muted">
            比劫＋印 {formatScore(own)} ／ 食傷＋財＋官 {formatScore(other)}
          </span>
        </dd>
        <dt className="font-bold">格局</dt>
        <dd>{result.kakukyoku || <span className="text-muted">格なし</span>}</dd>
        <dt className="font-bold">干合</dt>
        <dd>
          {result.kangou.length ? (
            <ul>
              {result.kangou.map((k) => (
                <li key={k.pillars.join("-")}>{k.label}</li>
              ))}
            </ul>
          ) : (
            <span className="text-muted">なし</span>
          )}
        </dd>
      </dl>
    </div>
  );
}
