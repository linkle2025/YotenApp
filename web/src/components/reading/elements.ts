import { BRANCH_TO_ELEMENT, STEM_TO_ELEMENT, type Element } from "@yoten/meishiki";

/** 五行の表示：文字と色の両方で示す（色だけに頼らない：04_骨格 4.2） */
export const ELEMENT_INFO: Record<Element, { label: string; text: string; tint: string; stroke: string }> = {
  wood: { label: "木", text: "text-wood", tint: "bg-wood-tint", stroke: "var(--wood)" },
  fire: { label: "火", text: "text-fire", tint: "bg-fire-tint", stroke: "var(--fire)" },
  earth: { label: "土", text: "text-earth", tint: "bg-earth-tint", stroke: "var(--earth)" },
  metal: { label: "金", text: "text-metal", tint: "bg-metal-tint", stroke: "var(--metal)" },
  water: { label: "水", text: "text-water", tint: "bg-water-tint", stroke: "var(--water)" },
};

export const stemElement = (stem: string) => STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];
export const branchElement = (branch: string) => BRANCH_TO_ELEMENT[branch as keyof typeof BRANCH_TO_ELEMENT];

/** 点数の表示（割り算で小数になることがあるため、整数でなければ小数1桁） */
export function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
