import type { Metadata } from "next";
import { Suspense } from "react";
import { PREFECTURES } from "@yoten/meishiki";
import { requireUser } from "@/lib/auth";
import { fromReadingColumns } from "@/lib/birth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "プロフィール" };

const PREFECTURE_OPTIONS = PREFECTURES.map((p) => ({ code: p.code, name: p.name }));

export default function ProfilePage({ searchParams }: PageProps<"/me/profile">) {
  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-10">
      <Suspense fallback={<div className="h-[36rem] animate-pulse rounded-[var(--radius-md)] bg-surface" aria-hidden />}>
        <ProfileContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ProfileContent({ searchParams }: { searchParams: PageProps<"/me/profile">["searchParams"] }) {
  const user = await requireUser("/me/profile");
  const { welcome } = await searchParams;
  const isWelcome = welcome === "1" && !user.selfReadingId;

  const supabase = await createClient();
  const { data: self } = await supabase
    .from("readings")
    .select("birth_date, birth_time, hour_unknown, birth_place, gender")
    .eq("owner_id", user.id)
    .eq("is_self", true)
    .maybeSingle();

  return (
    <>
      <h1 className="font-serif text-2xl font-bold">{isWelcome ? "ようこそ、陽てん塾へ" : "プロフィール"}</h1>
      <p className="mt-2 text-muted">
        {isWelcome
          ? "登録が完了しました。生年月日などを入れると、あなたの命式ができます。"
          : "生年月日などを変えると、あなたの命式を計算し直します。"}
      </p>
      <div className="mt-6 rounded-[var(--radius-md)] border border-border bg-surface p-5 shadow-sm">
        <ProfileForm
          prefectures={PREFECTURE_OPTIONS}
          displayName={user.displayName}
          birth={self ? fromReadingColumns(self) : undefined}
          allowSkip={isWelcome}
        />
      </div>
      <p className="mt-4 text-sm text-muted">
        生年月日・出生時刻・出生地は、あなただけが見られます。判定の要点の文章を作るときも、氏名や生年月日は AI に送りません。
      </p>
    </>
  );
}
