import type { ReactNode } from "react";

/** 認証まわりの画面の外枠（フォームの最大幅 560px：04_骨格 4.1） */
export function AuthCard({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[480px] flex-1 px-4 py-10">
      <h1 className="text-[26px] leading-snug font-bold tracking-tight">{title}</h1>
      {lead && <div className="mt-2 text-muted">{lead}</div>}
      <div className="card mt-6 p-5 sm:p-6">{children}</div>
    </main>
  );
}
