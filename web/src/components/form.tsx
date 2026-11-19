"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** フォームの結果（Server Action が返す） */
export type FormState = {
  /** 画面上部に出す、フォーム全体の知らせ */
  message?: string;
  /** 項目ごとの誤り */
  fieldErrors?: Record<string, string>;
  /** 送信した値（誤りがあったときに入力を残す。パスワードは入れない） */
  values?: Record<string, string>;
  ok?: boolean;
};

export const initialFormState: FormState = {};

/** 送信ボタン：送信中は押せなくし、くるくる回る印を出す（04_骨格 4.2） */
export function SubmitButton({
  children,
  variant = "primary",
  pendingLabel = "送信中…",
}: {
  children: ReactNode;
  variant?: "primary" | "danger";
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const color = variant === "danger" ? "btn-danger" : "btn-primary";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`btn w-full ${color}`}
    >
      {pending && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {pending ? pendingLabel : children}
    </button>
  );
}

type FieldProps = {
  label: string;
  name: string;
  hint?: ReactNode;
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name">;

/** 入力欄：ラベルは常に上、補足と誤りは下（04_骨格 4.2） */
export function Field({ label, name, hint, error, className, ...rest }: FieldProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={inputClass(Boolean(error))}
        {...rest}
      />
      <FieldFooter id={id} hint={hint} error={error} />
    </div>
  );
}

/** パスワード欄（表示の切り替え付き） */
export function PasswordField({ label, name, hint, error, autoComplete }: Omit<FieldProps, "type">) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`${inputClass(Boolean(error))} pr-20`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          className="link absolute inset-y-0 right-0 mt-1 px-4 text-sm"
        >
          {visible ? "隠す" : "表示"}
        </button>
      </div>
      <FieldFooter id={id} hint={hint} error={error} />
    </div>
  );
}

export function FieldFooter({ id, hint, error }: { id: string; hint?: ReactNode; error?: string }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </>
  );
}

export function inputClass(invalid: boolean) {
  return `mt-1.5 block min-h-12 w-full rounded-[12px] border-0 bg-surface px-3.5 text-base outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--primary),0_0_0_4px_rgba(180,68,31,.15)] ${
    invalid ? "shadow-[inset_0_0_0_2px_var(--danger)]" : "shadow-[inset_0_0_0_1px_var(--border)]"
  }`;
}

/** フォーム全体の知らせ（誤りは赤、成功は緑）。読み上げにも伝わるようにする */
export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`rounded-[12px] px-4 py-3 text-sm font-bold ${
        state.ok ? "bg-success-tint text-success" : "bg-danger-tint text-danger"
      }`}
    >
      {state.message}
    </p>
  );
}
