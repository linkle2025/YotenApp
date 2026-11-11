import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DeleteAccountForm } from "./delete-account-form";

export const metadata: Metadata = { title: "退会" };

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-10">
      <h1 className="font-serif text-2xl font-bold">退会</h1>
      <Suspense fallback={<div className="mt-6 h-72 animate-pulse rounded-[var(--radius-md)] bg-surface" aria-hidden />}>
        <DeleteContent />
      </Suspense>
    </main>
  );
}

async function DeleteContent() {
  const user = await requireUser("/me/delete");
  const supabase = await createClient();
  const [{ count: readingCount }, { count: insightCount }] = await Promise.all([
    supabase.from("readings").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    supabase.from("insights").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="mt-6 rounded-[var(--radius-md)] border border-danger bg-surface p-5 shadow-sm">
      <p className="font-bold">退会すると、次のデータがすべて消え、元に戻せません。</p>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>プロフィール（表示名・生年月日など）</li>
        <li>鑑定記録 {readingCount ?? 0}件</li>
        <li>判定の要点 {insightCount ?? 0}件</li>
        <li>ログインに使うメールアドレスとパスワード</li>
      </ul>
      <div className="mt-6">
        <DeleteAccountForm />
      </div>
    </div>
  );
}
