import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Suspense } from "react";
import { PREFECTURES } from "@yoten/meishiki";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PracticeItem, type PracticeRow } from "./practice-item";

export const metadata: Metadata = { title: "吉方位の実践履歴" };

const PAGE_SIZE = 30;

export default function PracticesPage({ searchParams }: PageProps<"/me/practices">) {
  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-8">
      <Link href="/me" className="link flex min-h-11 items-center gap-0.5 text-sm">
        <ChevronLeft size={16} aria-hidden />
        マイページ
      </Link>
      <h1 className="text-[26px] font-bold tracking-tight">吉方位の実践履歴</h1>
      <p className="mt-1 text-sm text-muted">「今週の吉方位」で［実践］を押したものが並びます。あとで起きたことを、メモに残せます。</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-xl)] bg-surface" aria-hidden />}>
        <PracticesContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function PracticesContent({ searchParams }: { searchParams: PageProps<"/me/practices">["searchParams"] }) {
  await requireUser("/me/practices");
  const { page: pageParam } = await searchParams;
  const page = typeof pageParam === "string" && /^\d{1,4}$/.test(pageParam) ? Math.max(1, Number(pageParam)) : 1;

  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  // 1件多く取って、次のページがあるかを調べる
  const { data } = await supabase
    .from("kimon_practices")
    .select("id, place, slot_start, slot_end, hour_pillar, kind, position, direction, mark, score, memo, created_at")
    .order("slot_start", { ascending: false })
    .range(from, from + PAGE_SIZE);
  const rows = data ?? [];
  const hasNext = rows.length > PAGE_SIZE;
  const items: PracticeRow[] = rows.slice(0, PAGE_SIZE).map((r) => ({
    id: r.id,
    placeName: PREFECTURES.find((p) => p.code === r.place)?.name ?? "",
    slotStart: String(r.slot_start),
    slotEnd: String(r.slot_end),
    hourPillar: r.hour_pillar,
    kind: r.kind,
    direction: r.direction,
    mark: r.mark,
    score: r.score,
    memo: r.memo,
  }));

  if (items.length === 0) {
    return (
      <div className="mt-6 space-y-4">
        <p className="well p-5 text-center text-sm text-muted">{page > 1 ? "これより先の履歴はありません。" : "まだ実践した吉方位はありません。"}</p>
        <Link href="/kimon" className="btn btn-primary w-full">
          今週の吉方位を見る
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <ul className="space-y-3">
        {items.map((p) => (
          <li key={p.id}>
            <PracticeItem practice={p} />
          </li>
        ))}
      </ul>
      {(page > 1 || hasNext) && (
        <nav aria-label="ページの切り替え" className="flex items-center justify-between">
          {page > 1 ? (
            <Link href={page === 2 ? "/me/practices" : `/me/practices?page=${page - 1}`} className="chip">
              新しい履歴
            </Link>
          ) : (
            <span />
          )}
          {hasNext && (
            <Link href={`/me/practices?page=${page + 1}`} className="chip">
              前の履歴
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
