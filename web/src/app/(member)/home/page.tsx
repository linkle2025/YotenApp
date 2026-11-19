import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Suspense } from "react";
import type { MeishikiResult } from "@yoten/meishiki";
import { Notice } from "@/components/notice";
import { ELEMENT_INFO, branchElement, stemElement } from "@/components/reading/elements";
import { StemTile } from "@/components/reading/stem-tile";
import { japanNow } from "@/lib/birth";
import { requireUser } from "@/lib/auth";
import { getStems } from "@/lib/master";
import { currentResult } from "@/lib/readings";
import { createClient } from "@/lib/supabase/server";
import { DailyAdvice } from "./daily-advice";

export const metadata: Metadata = { title: "ホーム" };

const NOTICES: Record<string, string> = {
  "profile-saved": "プロフィールを保存し、あなたの命式をつくりました。",
  "password-updated": "パスワードを変更しました。",
  "reading-deleted": "鑑定記録を削除しました。",
};

const COLUMNS = [
  { key: "hour", label: "時柱" },
  { key: "day", label: "日柱" },
  { key: "month", label: "月柱" },
  { key: "year", label: "年柱" },
] as const;

export default function HomePage({ searchParams }: PageProps<"/home">) {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-8">
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function HomeContent({ searchParams }: { searchParams: PageProps<"/home">["searchParams"] }) {
  const user = await requireUser("/home");
  const { notice } = await searchParams;

  // 本人の命式と最近の記録は同時に取る（順番に待たない）
  const supabase = await createClient();
  const [{ data: self }, { data: recent }, stems] = await Promise.all([
    user.selfReadingId
      ? supabase
          .from("readings")
          .select("id, result, birth_date, birth_time, hour_unknown, birth_place, gender")
          .eq("id", user.selfReadingId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("readings")
      .select("id, name, created_at, result->>dayStem")
      .eq("is_self", false)
      .order("created_at", { ascending: false })
      .limit(5),
    getStems(),
  ]);
  const result: MeishikiResult | undefined = self ? await currentResult(self) : undefined;
  const stem = result ? stems.find((s) => s.name === result.dayStem) : undefined;

  const today = japanNow();
  const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div className="space-y-5">
      {typeof notice === "string" && NOTICES[notice] && <Notice>{NOTICES[notice]}</Notice>}
      <div>
        <p className="text-sm text-muted">
          {today.getUTCMonth() + 1}月{today.getUTCDate()}日（{WEEK[today.getUTCDay()]}）
        </p>
        <h1 className="text-[26px] leading-snug font-bold tracking-tight">こんにちは、{user.displayName || "会員"}さん</h1>
      </div>

      <section className="card p-5 sm:p-6" aria-labelledby="self-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="self-title" className="text-sm font-bold text-muted">
            あなたの命式
          </h2>
          {result && (
            <Link href={`/readings/${self!.id}`} className="link flex items-center gap-0.5 text-sm">
              鑑定表を見る
              <ChevronRight size={16} aria-hidden />
            </Link>
          )}
        </div>
        {result ? (
          <>
            <div className="mt-4 flex items-center gap-4">
              <StemTile stem={result.dayStem} size="lg" />
              <div>
                <p className="text-lg font-bold">
                  {result.dayStem}
                  {stem && `（${stem.reading}）・${stem.element_type}`}
                </p>
                <p className="text-sm text-muted">
                  {result.strength.label}
                  {result.kakukyoku ? `・${result.kakukyoku}` : ""}
                </p>
              </div>
            </div>
            <table className="mt-5 w-full table-fixed border-separate border-spacing-x-1.5 text-center">
              <caption className="sr-only">あなたの四柱</caption>
              <thead>
                <tr className="text-xs">
                  {COLUMNS.map((c) => (
                    <th key={c.key} scope="col" className={`pb-1 ${c.key === "day" ? "font-bold" : "font-normal text-muted"}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-serif text-xl leading-snug font-bold">
                <tr>
                  {COLUMNS.map((c) => {
                    const p = result.pillars[c.key];
                    return (
                      <td
                        key={c.key}
                        className="rounded-[12px] bg-bg py-1.5"
                        style={c.key === "day" ? { boxShadow: `inset 0 0 0 2px ${ELEMENT_INFO[stemElement(result.dayStem)].stroke}` } : undefined}
                      >
                        {p ? (
                          <>
                            <span className={`block ${ELEMENT_INFO[stemElement(p.stem)].text}`}>{p.stem}</span>
                            <span className={`block ${ELEMENT_INFO[branchElement(p.branch)].text}`}>{p.branch}</span>
                          </>
                        ) : (
                          <span className="block text-muted" aria-label="なし">
                            —<br />—
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
            <Link href="/me/profile" className="link mt-4 inline-block text-sm">
              生年月日などを直す
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2">生年月日を入れると、あなたの命式ができます。</p>
            <Link href="/me/profile" className="btn btn-primary mt-4 w-full">
              入力する
            </Link>
          </>
        )}
      </section>

      {/* 管理者だけのテスト機能。呼び出し側（daily-actions.ts）でも管理者かどうかを確かめている */}
      {user.role === "admin" && <DailyAdvice canGenerate={Boolean(result)} />}

      <Link href="/readings/new" className={`btn w-full ${result ? "btn-primary" : "btn-secondary"}`}>
        <Plus size={20} aria-hidden strokeWidth={2.2} />
        新しい命式をつくる
      </Link>

      <section aria-labelledby="recent-title" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 id="recent-title" className="text-lg font-bold">
            最近の記録
          </h2>
          <Link href="/readings" className="link flex min-h-11 items-center text-sm">
            すべて見る
          </Link>
        </div>
        {recent && recent.length > 0 ? (
          <ul className="space-y-2">
            {recent.map((r) => {
              const row = r as unknown as { id: string; name: string | null; created_at: string; dayStem: string };
              return (
                <li key={row.id}>
                  <Link
                    href={`/readings/${row.id}`}
                    className="flex min-h-16 items-center gap-3 rounded-[18px] bg-surface px-4 shadow-[0_1px_2px_rgba(31,27,22,.04)] transition-shadow hover:shadow-[var(--shadow-card)]"
                  >
                    <StemTile stem={row.dayStem} size="sm" />
                    <span className="flex-1 truncate font-bold">{row.name ? `${row.name}さん` : "無題の鑑定"}</span>
                    <ChevronRight size={18} aria-hidden className="text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="well p-4 text-sm text-muted">まだ記録がありません。家族や社員の命式をつくってみましょう。</p>
        )}
      </section>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="h-8 w-56 animate-pulse rounded bg-subtle" />
      <div className="h-72 animate-pulse rounded-[var(--radius-xl)] bg-surface" />
    </div>
  );
}
