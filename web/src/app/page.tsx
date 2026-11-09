import { calculateMeishiki } from "@yoten/meishiki";

/**
 * 仮のトップページ（新版の準備中）
 * 計算ロジック（@yoten/meishiki）が Next.js から動くことを、基準ケースの命式で確かめる。
 * 正式なトップページは 04_骨格.md 4.3 のとおりに作る。
 */
const SAMPLE = calculateMeishiki({
  year: 1985,
  month: 5,
  day: 10,
  hour: 11,
  minute: 30,
  birthPlace: "21",
  gender: "male",
});

const COLUMNS = [
  { key: "hour", label: "時柱" },
  { key: "day", label: "日柱" },
  { key: "month", label: "月柱" },
  { key: "year", label: "年柱" },
] as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
      <p className="text-sm text-muted">新版 準備中</p>
      <h1 className="mt-2 font-serif text-3xl font-bold leading-snug">
        生年月日から、
        <br />
        あなたの強みと活かし方を。
      </h1>
      <p className="mt-4 text-muted">陽てん塾の四柱推命アプリを、より使いやすく作り直しています。</p>

      <section className="mt-10 rounded-[var(--radius-md)] border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-lg font-bold">計算ロジックの動作確認（基準ケース）</h2>
        <p className="mt-1 text-sm text-muted">1985年5月10日 11時30分 岐阜県 男性</p>
        <table className="mt-4 w-full table-fixed text-center">
          <thead>
            <tr className="text-sm text-muted">
              {COLUMNS.map((c) => (
                <th key={c.key} className="font-normal">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-serif text-2xl">
            <tr>
              {COLUMNS.map((c) => (
                <td key={c.key}>{SAMPLE.pillars[c.key]?.stem ?? "—"}</td>
              ))}
            </tr>
            <tr>
              {COLUMNS.map((c) => (
                <td key={c.key}>{SAMPLE.pillars[c.key]?.branch ?? "—"}</td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="mt-4 text-sm">
          日干：{SAMPLE.dayStem}　{SAMPLE.strength.label}　{SAMPLE.kakukyoku || "格なし"}
        </p>
      </section>
    </main>
  );
}
