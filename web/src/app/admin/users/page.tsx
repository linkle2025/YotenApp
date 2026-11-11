import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MemberTable, type Member } from "./member-table";

export const metadata: Metadata = { title: "ユーザー管理" };

/** ユーザー管理（04_骨格 4.10、02_要件 F-11） */
export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-md)] bg-surface" aria-hidden />}>
      <UsersContent />
    </Suspense>
  );
}

async function UsersContent() {
  const me = await requireAdmin("/admin/users");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) {
    return (
      <p role="alert" className="rounded-[var(--radius-md)] border border-danger bg-surface p-4">
        会員の一覧を読み込めませんでした。再読み込みしてください。
      </p>
    );
  }
  const members: Member[] = (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    email: r.email as string,
    displayName: r.display_name as string,
    role: r.role as Member["role"],
    status: r.status as Member["status"],
    createdAt: r.created_at as string,
    lastSignInAt: (r.last_sign_in_at as string | null) ?? null,
    readingCount: Number(r.reading_count),
    insightCount: Number(r.insight_count),
  }));
  const totals = {
    members: members.length,
    active: members.filter((m) => m.status === "active").length,
    readings: members.reduce((n, m) => n + m.readingCount, 0),
    insights: members.reduce((n, m) => n + m.insightCount, 0),
  };
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["会員", totals.members],
          ["利用中", totals.active],
          ["鑑定記録", totals.readings],
          ["判定の要点", totals.insights],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-2xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <MemberTable members={members} meId={me.id} />
    </div>
  );
}
