"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { inputClass } from "@/components/form";

/** 場所の選択。選んだらすぐに表示し直す（JavaScript がなくても［表示］で送れる） */
export function PlaceSelect({ places, value }: { places: { code: string; name: string }[]; value: string }) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <form action="/kimon" className="flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor={id} className="block text-sm font-bold">
          場所
        </label>
        <select
          id={id}
          name="place"
          defaultValue={value}
          onChange={(e) => startTransition(() => router.replace(`/kimon?place=${e.target.value}`, { scroll: false }))}
          className={`${inputClass(false)} appearance-auto`}
          aria-busy={pending}
        >
          {places.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <noscript>
        <button type="submit" className="btn btn-secondary">
          表示
        </button>
      </noscript>
      {pending && (
        <span role="status" className="mb-3 text-sm text-muted">
          計算しています…
        </span>
      )}
    </form>
  );
}
