"use client";

import { useOptimistic, useState, useTransition } from "react";
import { deleteReading, setFavorite } from "@/app/(member)/readings/actions";

/** お気に入りの切り替えと、削除（画面内の確認パネル：04_骨格 4.2） */
export function ReadingActions({
  readingId,
  isFavorite,
  isSelf,
  title,
}: {
  readingId: string;
  isFavorite: boolean;
  isSelf: boolean;
  title: string;
}) {
  const [favorite, setOptimisticFavorite] = useOptimistic(isFavorite);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const toggleFavorite = () =>
    startTransition(async () => {
      setOptimisticFavorite(!favorite);
      const { ok } = await setFavorite(readingId, !favorite);
      if (!ok) setMessage("お気に入りを変えられませんでした。もう一度お試しください。");
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteReading(readingId);
      if (result && !result.ok) setMessage(result.message);
    });

  const button =
    "inline-flex min-h-10 items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-sm hover:bg-bg disabled:opacity-60";

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={toggleFavorite} aria-pressed={favorite} className={button}>
          <span aria-hidden className={favorite ? "text-primary" : "text-muted"}>
            {favorite ? "★" : "☆"}
          </span>
          {favorite ? "お気に入り" : "お気に入りに追加"}
        </button>
        <button type="button" onClick={() => setConfirming(true)} className={`${button} text-danger`} disabled={pending}>
          削除
        </button>
      </div>
      {message && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {message}
        </p>
      )}
      {confirming && (
        <div role="alertdialog" aria-labelledby="delete-title" className="mt-3 rounded-[var(--radius-md)] border border-danger bg-surface p-4">
          <p id="delete-title" className="font-bold">
            「{title}」を削除しますか？
          </p>
          <p className="mt-1 text-sm text-muted">
            命式と判定の要点が消え、元に戻せません。
            {isSelf && "あなた本人の命式なので、ホームの「あなたの命式」も空になります（プロフィールから作り直せます）。"}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="min-h-10 rounded-[var(--radius-sm)] bg-danger px-4 text-sm font-bold text-on-primary disabled:opacity-60"
            >
              {pending ? "削除しています…" : "削除する"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={button}>
              やめる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
