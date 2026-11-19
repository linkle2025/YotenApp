import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Star } from "lucide-react";
import { Suspense } from "react";
import { getPrefecture, type MeishikiResult } from "@yoten/meishiki";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReadingList, type ReadingListItem } from "./reading-list";

export const metadata: Metadata = { title: "鑑定記録" };

const PAGE_SIZE = 30;

/** 鑑定記録の一覧（04_骨格 4.6、02_要件 F-07） */
export default function ReadingsPage({ searchParams }: PageProps<"/readings">) {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-bold tracking-tight">鑑定記録</h1>
        <Link href="/readings/new" className="btn btn-primary min-h-11 px-4 text-sm">
          <Plus size={18} aria-hidden strokeWidth={2.2} />
          命式をつくる
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <ReadingsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ReadingsContent({ searchParams }: { searchParams: PageProps<"/readings">["searchParams"] }) {
  await requireUser("/readings");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 50) : "";
  const fav = params.fav === "1";
  const sort = params.sort === "old" || params.sort === "name" ? params.sort : "new";
  const limit = Math.min(Math.max(Number(params.limit) || PAGE_SIZE, PAGE_SIZE), 600);

  const supabase = await createClient();
  let query = supabase
    .from("readings")
    .select("id, name, is_self, is_favorite, birth_date, birth_time, hour_unknown, birth_place, created_at, result->>dayStem", {
      count: "exact",
    })
    // 本人の記録は先頭に固定する
    .order("is_self", { ascending: false });
  if (sort === "name") query = query.order("name", { ascending: true, nullsFirst: false });
  query = query.order("created_at", { ascending: sort === "old" });
  if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (fav) query = query.eq("is_favorite", true);
  const { data, count, error } = await query.range(0, limit - 1);

  const items: ReadingListItem[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    isSelf: r.is_self,
    isFavorite: r.is_favorite,
    birthDate: r.birth_date,
    birthTime: r.hour_unknown ? null : (r.birth_time?.slice(0, 5) ?? null),
    birthPlace: getPrefecture(r.birth_place).name,
    createdAt: r.created_at,
    dayStem: (r as unknown as { dayStem: MeishikiResult["dayStem"] }).dayStem,
  }));

  const filtered = Boolean(q || fav);
  const linkTo = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const merged = { q: q || null, fav: fav ? "1" : null, sort: sort === "new" ? null : sort, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/readings?${s}` : "/readings";
  };

  return (
    <div className="mt-5 space-y-4">
      <form action="/readings" className="relative" role="search">
        {fav && <input type="hidden" name="fav" value="1" />}
        {sort !== "new" && <input type="hidden" name="sort" value={sort} />}
        <label className="sr-only" htmlFor="q">
          氏名で検索
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="氏名で検索"
          className="min-h-12 w-full rounded-[14px] bg-surface pr-20 pl-11 shadow-[inset_0_0_0_1px_var(--border)] outline-none focus:shadow-[inset_0_0_0_2px_var(--primary),0_0_0_4px_rgba(180,68,31,.15)]"
        />
        <Search size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <button type="submit" className="link absolute inset-y-1 right-1 px-4 text-sm hover:bg-subtle">
          検索
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Chip href={linkTo({ fav: null })} active={!fav}>
          すべて
        </Chip>
        <Chip href={linkTo({ fav: "1" })} active={fav}>
          <Star size={14} aria-hidden fill={fav ? "currentColor" : "none"} />
          お気に入り
        </Chip>
        <span className="ml-auto flex items-center gap-1 text-muted">
          並び：
          <Chip href={linkTo({ sort: null })} active={sort === "new"}>
            新しい順
          </Chip>
          <Chip href={linkTo({ sort: "old" })} active={sort === "old"}>
            古い順
          </Chip>
          <Chip href={linkTo({ sort: "name" })} active={sort === "name"}>
            氏名
          </Chip>
        </span>
      </div>

      {error ? (
        <div role="alert" className="rounded-[var(--radius-xl)] bg-danger-tint p-5">
          <p className="font-bold">記録を読み込めませんでした。</p>
          <p className="mt-1 text-sm">通信の状態を確かめて、もう一度お試しください。</p>
          <Link href={linkTo({})} className="link mt-3 inline-block">
            再読み込み
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center">
          {filtered ? (
            <>
              <p>条件に合う記録はありません。</p>
              <Link href="/readings" className="link mt-3 inline-block">
                条件を外す
              </Link>
            </>
          ) : (
            <>
              <p className="font-bold">まだ記録がありません</p>
              <p className="mt-1 text-sm text-muted">家族や社員の生年月日から、命式をつくってみましょう。</p>
              <Link
                href="/readings/new"
                className="btn btn-primary mt-5 px-6"
              >
                命式をつくる
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">{count ?? items.length}件</p>
          <ReadingList items={items} />
          {count !== null && count > items.length && (
            <Link
              href={linkTo({ limit: String(limit + PAGE_SIZE) })}
              scroll={false}
              className="btn btn-secondary w-full"
            >
              続きを表示（残り {count - items.length}件）
            </Link>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className="chip"
    >
      {children}
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-6 space-y-3" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[76px] animate-pulse rounded-[18px] bg-surface" />
      ))}
    </div>
  );
}
