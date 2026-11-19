import { ELEMENT_INFO, stemElement } from "./elements";

const SIZES = {
  sm: "size-10 rounded-[12px] text-xl",
  md: "size-11 rounded-[13px] text-[22px]",
  lg: "size-16 rounded-[18px] text-4xl",
} as const;

/** 日干を五行の色の正方形で示す（一覧・ホームで、誰の命式かを見分けやすくする） */
export function StemTile({ stem, size = "md" }: { stem: string; size?: keyof typeof SIZES }) {
  const element = stemElement(stem);
  const info = element ? ELEMENT_INFO[element] : null;
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center font-serif font-bold ${SIZES[size]} ${info ? `${info.tint} ${info.text}` : "bg-subtle"}`}
    >
      {stem}
    </span>
  );
}
