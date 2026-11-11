import type { MeishikiResult, Pillar } from "@yoten/meishiki";
import { ELEMENT_INFO, branchElement, stemElement } from "./elements";

const COLUMNS = [
  { key: "hour", label: "時柱" },
  { key: "day", label: "日柱" },
  { key: "month", label: "月柱" },
  { key: "year", label: "年柱" },
] as const;

/** 命式の表（F-04-2）：天干・通変星・地支・蔵干（本気・中気・余気）とその通変星。時間不明の時柱は「—」 */
export function PillarTable({ result }: { result: MeishikiResult }) {
  const pillars = COLUMNS.map((c) => ({ ...c, pillar: result.pillars[c.key] as Pillar | null }));
  const cell = "border border-border px-1 py-1.5 text-center";
  const head = `${cell} bg-bg text-xs font-normal text-muted`;

  return (
    <div>
      <table className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">命式の表</caption>
        <thead>
          <tr>
            <th scope="col" className={`${head} w-14`}>
              <span className="sr-only">項目</span>
            </th>
            {pillars.map((p) => (
              <th key={p.key} scope="col" className={head}>
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row label="通変星" pillars={pillars} cell={cell} head={head}>
            {(p, key) => (key === "day" ? <span className="text-muted">日干</span> : p.stemStar)}
          </Row>
          <Row label="天干" pillars={pillars} cell={cell} head={head}>
            {(p) => <Char value={p.stem} element={stemElement(p.stem)} />}
          </Row>
          <Row label="地支" pillars={pillars} cell={cell} head={head}>
            {(p) => <Char value={p.branch} element={branchElement(p.branch)} />}
          </Row>
          <Row label="蔵干" pillars={pillars} cell={cell} head={head}>
            {(p) => <Hidden stem={p.hidden.honki} star={p.hiddenStars.honki} />}
          </Row>
        </tbody>
      </table>

      <details className="mt-2 group">
        <summary className="cursor-pointer text-sm text-accent underline-offset-2 hover:underline">中気・余気も表示</summary>
        <table className="mt-2 w-full table-fixed border-collapse text-sm">
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
  children,
}: {
  label: string;
  pillars: { key: string; pillar: Pillar | null }[];
  cell: string;
  head: string;
  children: (p: Pillar, key: string) => React.ReactNode;
}) {
  return (
    <tr>
      <th scope="row" className={`${head} w-14`}>
        {label}
      </th>
      {pillars.map(({ key, pillar }) => (
        <td key={key} className={cell}>
          {pillar ? children(pillar, key) : <Dash />}
        </td>
      ))}
    </tr>
  );
}

function Char({ value, element }: { value: string; element: keyof typeof ELEMENT_INFO }) {
  const info = ELEMENT_INFO[element];
  return (
    <span className={`font-serif text-2xl font-bold ${info.text}`}>
      {value}
      <span className="sr-only">（{info.label}）</span>
    </span>
  );
}

function Hidden({ stem, star }: { stem: string; star: string | null }) {
  return (
    <span className="flex flex-col items-center leading-tight">
      <span className={`font-serif text-lg ${ELEMENT_INFO[stemElement(stem)].text}`}>{stem}</span>
      {star && <span className="text-xs text-muted">{star}</span>}
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
