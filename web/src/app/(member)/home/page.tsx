import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { MeishikiResult } from "@yoten/meishiki";
import { Notice } from "@/components/notice";
import { requireUser } from "@/lib/auth";
import { getStems } from "@/lib/master";
import { currentResult } from "@/lib/readings";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="space-y-6">
      {typeof notice === "string" && NOTICES[notice] && <Notice>{NOTICES[notice]}</Notice>}
      <h1 className="font-serif text-2xl font-bold">こんにちは、{user.displayName || "会員"}さん</h1>

      <section className="rounded-[var(--radius-md)] border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-bold">あなたの命式</h2>
        {result ? (
          <>
            <p className="mt-2">
              <span className="font-serif text-3xl font-bold">{result.dayStem}</span>
              {stem?.element_type && <span className="ml-2 text-muted">（{stem.element_type}）</span>}
              <span className="ml-3">
                {result.strength.label}
                {result.kakukyoku ? `・${result.kakukyoku}` : ""}
              </span>
            </p>
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
                    <td key={c.key}>{result.pillars[c.key]?.stem ?? "—"}</td>
                  ))}
                </tr>
                <tr>
                  {COLUMNS.map((c) => (
                    <td key={c.key}>{result.pillars[c.key]?.branch ?? "—"}</td>
                  ))}
                </tr>
              </tbody>
            </table>
            <Link
              href={`/readings/${self!.id}`}
              className="mt-4 flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-primary font-bold text-on-primary hover:bg-primary-hover"
            >
              鑑定表を見る
            </Link>
            <Link href="/me/profile" className="mt-3 inline-block text-sm text-accent underline">
              生年月日などを直す
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2">生年月日を入れると、あなたの命式ができます。</p>
            <Link
              href="/me/profile"
              className="mt-4 flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-primary font-bold text-on-primary hover:bg-primary-hover"
            >
              入力する
            </Link>
          </>
        )}
      </section>

      <Link
        href="/readings/new"
        className="flex min-h-12 items-center justify-center rounded-[var(--radius-md)] border-2 border-primary bg-surface font-bold text-primary hover:bg-bg"
      >
        ＋ 新しい命式をつくる
      </Link>

      <section aria-labelledby="recent-title">
        <div className="flex items-baseline justify-between">
          <h2 id="recent-title" className="text-lg font-bold">
            最近の記録
          </h2>
          <Link href="/readings" className="text-sm text-accent underline">
            すべて見る
          </Link>
        </div>
        {recent && recent.length > 0 ? (
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface">
            {recent.map((r) => {
              const row = r as unknown as { id: string; name: string | null; created_at: string; dayStem: string };
              return (
                <li key={row.id}>
                  <Link href={`/readings/${row.id}`} className="flex min-h-12 items-center gap-3 px-4 hover:bg-bg">
                    <span className="font-serif text-lg font-bold">{row.dayStem}</span>
                    <span className="flex-1 truncate">{row.name ? `${row.name}さん` : "無題の鑑定"}</span>
                    <span aria-hidden>›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">まだ記録がありません。家族や社員の命式をつくってみましょう。</p>
        )}
      </section>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="h-8 w-56 animate-pulse rounded bg-border" />
      <div className="h-56 animate-pulse rounded-[var(--radius-md)] bg-surface" />
    </div>
  );
}
