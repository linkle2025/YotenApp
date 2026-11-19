"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { recordPractice } from "./actions";

/** 吉方位ごとの［実践］ボタン。押すと履歴に残り、押したあとは「実践済み」になる */
export function PracticeButton({
  place,
  start,
  kind,
  position,
  direction,
  practiced,
  started,
}: {
  place: string;
  start: string;
  kind: string;
  position: number;
  direction: string;
  practiced: boolean;
  /** 時間がもう始まっているか（始まる前は押せない） */
  started: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (practiced) {
    return (
      <span className="tag bg-primary-tint text-primary">
        <Check size={14} aria-hidden className="mr-1" />
        実践済み
      </span>
    );
  }
  if (!started) return <span className="text-xs text-muted">時間になったら押せます</span>;

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        aria-label={`${direction}の吉方位を実践した`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await recordPractice({ place, start, kind, position });
            if (result.ok) router.refresh();
            else setError(result.message);
          })
        }
        className="chip font-bold text-primary"
      >
        {pending ? "記録中…" : "実践"}
      </button>
      {error && (
        <span role="alert" className="text-xs font-bold text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
