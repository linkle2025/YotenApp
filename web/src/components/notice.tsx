import { CircleCheck } from "lucide-react";

/** 画面上部の短い知らせ（保存しました など） */
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2 rounded-[14px] bg-success-tint px-4 py-3 text-sm font-bold text-success">
      <CircleCheck size={18} aria-hidden className="shrink-0" />
      {children}
    </p>
  );
}
