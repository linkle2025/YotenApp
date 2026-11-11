import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";

export const metadata: Metadata = { title: "確認メールを送りました" };

export default function SignUpSentPage({ searchParams }: PageProps<"/signup/sent">) {
  return (
    <AuthCard title="確認メールを送りました">
      <div className="space-y-4">
        <Suspense fallback={<p>確認のメールを送りました。</p>}>
          <SentTo searchParams={searchParams} />
        </Suspense>
        <p>メールに書かれたリンクを開くと、登録が完了します。そのあと、生年月日などのプロフィールを入力できます。</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>リンクは、登録したのと同じブラウザで開くと、そのままログインした状態になります。</li>
          <li>数分たっても届かないときは、迷惑メールのフォルダもご確認ください。</li>
        </ul>
        <Link href="/login" className="inline-block text-accent underline">
          ログイン画面へ
        </Link>
      </div>
    </AuthCard>
  );
}

async function SentTo({ searchParams }: { searchParams: PageProps<"/signup/sent">["searchParams"] }) {
  const { email } = await searchParams;
  if (typeof email !== "string" || !email) return <p>確認のメールを送りました。</p>;
  return (
    <p>
      <span className="font-bold break-all">{email}</span> あてに、確認のメールを送りました。
    </p>
  );
}
