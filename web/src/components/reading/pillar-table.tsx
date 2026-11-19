import type { MeishikiResult, Pillar } from "@yoten/meishiki";
import { ELEMENT_INFO, branchElement, stemElement } from "./elements";
import { ChevronDown } from "lucide-react";
import { ExplainTrigger } from "./explain-panel";

const COLUMNS = [
  { key: "hour", label: "時柱" },
  { key: "day", label: "日柱" },
  { key: "month", label: "月柱" },
  { key: "year", label: "年柱" },
] as const;

/** 命式の表（F-04-2）：天干・通変星・地支・蔵干（本気・中気・余気）とその通変星。時間不明の時柱は「—」 */
export function PillarTable({ result }: { result: MeishikiResult }) {
  const pillars = COLUMNS.map((c) => ({ ...c, pillar: result.pillars[c.key] as Pillar | null }));
  const cell = "px-0.5 py-1.5 text-center align-middle";
  const head = "px-0.5 py-1 text-center text-xs font-normal text-muted";

  return (
    <div>
      <table className="w-full table-fixed border-separate border-spacing-x-1.5 border-spacing-y-[3px] text-sm">
        <caption className="sr-only">命式の表</caption>
        <thead>
          <tr>
            <th scope="col" className={`${head} w-14`}>
              <span className="sr-only">項目</span>
            </th>
            {pillars.map((p) => (
              <th key={p.key} scope="col" className={`${head} ${p.key === "day" ? "font-bold text-text" : ""}`}>
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row label="通変星" pillars={pillars} cell={cell} head={head}>
            {(p, key) =>
              key === "day" ? (
                <span className="text-muted">日干</span>
              ) : (
                <ExplainTrigger kind="star" name={p.stemStar}>
                  {p.stemStar}
                </ExplainTrigger>
              )
            }
          </Row>
          <Row label="天干" pillars={pillars} cell={cell} head={head} tint={(p) => stemElement(p.stem)} position="top">
            {(p) => (
              <ExplainTrigger kind="stem" name={p.stem}>
                <Char value={p.stem} element={stemElement(p.stem)} />
              </ExplainTrigger>
            )}
          </Row>
          <Row label="地支" pillars={pillars} cell={cell} head={head} tint={(p) => branchElement(p.branch)} position="bottom">
            {(p) => <Char value={p.branch} element={branchElement(p.branch)} />}
          </Row>
          <Row label="蔵干" pillars={pillars} cell={cell} head={head}>
            {(p) => <Hidden stem={p.hidden.honki} star={p.hiddenStars.honki} />}
          </Row>
        </tbody>
      </table>

      <details className="group mt-3">
        <summary className="well flex min-h-11 cursor-pointer list-none items-center justify-center gap-1.5 text-sm font-bold hover:bg-subtle [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">中気・余気も表示</span>
          <span className="hidden group-open:inline">中気・余気を隠す</span>
          <ChevronDown size={16} aria-hidden className="transition-transform group-open:rotate-180" />
        </summary>
        <table className="mt-2 w-full table-fixed border-separate border-spacing-x-1.5 text-sm">
          <caption className="sr-only">蔵干の中気・余気</caption>
          <tbody>
            <Row label="中気" pillars={pillars} cell={cell} head={head}>
              {(p) => (p.hidden.chuki ? <Hidden stem={p.hidden.chuki} star={p.hiddenStars.chuki} /> : <Dash />)}
            </Row>
            <Row label="余気" pillars={pillars} cell={cell} head={head}>
              {(p) => (p.hidden.yoki ? <Hidden stem={p.hidden.yoki} star={p.hiddenStars.yoki} /> : <Dash />)}
            </Row>
          </tbody>
        </table>
      </details>
    </div>
  );
}

function Row({
  label,
  pillars,
  cell,
  head,
  tint,
  position,
  children,
}: {
  label: string;
  pillars: { key: string; pillar: Pillar | null }[];
  cell: string;
  head: string;
  /** 五行の淡い色を敷くときの、その干支の五行 */
  tint?: (p: Pillar) => keyof typeof ELEMENT_INFO;
  /** 天干（上）と地支（下）をひと続きの柱に見せるための角丸 */
  position?: "top" | "bottom";
  children: (p: Pillar, key: string) => React.ReactNode;
}) {
  const shape = position === "top" ? "rounded-t-[14px] rounded-b-[4px] pt-2.5" : position === "bottom" ? "rounded-b-[14px] rounded-t-[4px] pb-2.5" : "";
  return (
    <tr>
      <th scope="row" className={`${head} w-12 text-left`}>
        {label}
      </th>
      {pillars.map(({ key, pillar }) => {
        const bg = tint ? (pillar ? ELEMENT_INFO[tint(pillar)].tint : "bg-bg") : "";
        return (
          <td key={key} className={`${cell} ${bg} ${shape}`}>
            {pillar ? children(pillar, key) : <Dash />}
          </td>
        );
      })}
    </tr>
  );
}

function Char({ value, element }: { value: string; element: keyof typeof ELEMENT_INFO }) {
  const info = ELEMENT_INFO[element];
  return (
    <span className={`font-serif text-[28px] leading-tight font-bold ${info.text}`}>
      {value}
      <span className="sr-only">（{info.label}）</span>
    </span>
  );
}

function Hidden({ stem, star }: { stem: string; star: string | null }) {
  return (
    <span className="flex flex-col items-center leading-tight">
      <span className={`font-serif text-lg ${ELEMENT_INFO[stemElement(stem)].text}`}>{stem}</span>
      {star && (
        <ExplainTrigger kind="star" name={star} className="text-xs text-muted">
          {star}
        </ExplainTrigger>
      )}
    </span>
  );
}

function Dash() {
  return (
    <span className="text-muted" aria-label="なし">
      —
    </span>
  );
}
