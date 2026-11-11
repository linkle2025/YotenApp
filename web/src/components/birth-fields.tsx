"use client";

import { useId, useState } from "react";
import { FieldFooter, inputClass } from "@/components/form";

export type PrefectureOption = { code: string; name: string };

export type BirthValues = {
  year?: string;
  month?: string;
  day?: string;
  hour?: string;
  minute?: string;
  hourUnknown?: boolean;
  birthPlace?: string;
  gender?: string;
};

/** 選べる最初の年（節入りのデータがある範囲：付録A） */
const FIRST_YEAR = 1901;

/** 地方ごとの区切り（JIS の都道府県コードの範囲） */
const REGIONS: { label: string; from: number; to: number }[] = [
  { label: "北海道・東北", from: 1, to: 7 },
  { label: "関東", from: 8, to: 14 },
  { label: "中部", from: 15, to: 23 },
  { label: "近畿", from: 24, to: 30 },
  { label: "中国", from: 31, to: 35 },
  { label: "四国", from: 36, to: 39 },
  { label: "九州・沖縄", from: 40, to: 47 },
];

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * 生年月日・出生時刻・出生地・性別の入力（04_骨格 4.2・4.4）
 * - 年・月・日をまとめた部品。存在しない日付（2月31日など）は選べない
 * - 時間がわからない場合は、時刻の欄を閉じる
 */
export function BirthFields({
  prefectures,
  defaults = {},
  errors = {},
  maxYear,
}: {
  prefectures: PrefectureOption[];
  /** 選べる最後の年（来年まで。サーバーで決めて渡す：lib/birth.ts の maxBirthYear） */
  maxYear: number;
  defaults?: BirthValues;
  errors?: Record<string, string>;
}) {
  const id = useId();
  const [year, setYear] = useState(defaults.year ?? "");
  const [month, setMonth] = useState(defaults.month ?? "");
  const [day, setDay] = useState(defaults.day ?? "");
  const [hourUnknown, setHourUnknown] = useState(defaults.hourUnknown ?? false);

  const maxDay = year && month ? daysInMonth(Number(year), Number(month)) : 31;
  // 1901年1月1日〜5日は、前年の節入りのデータがないため計算できない（付録B B.1-5）
  const minDay = year === String(FIRST_YEAR) && month === "1" ? 6 : 1;
  const dayValue = day && (Number(day) > maxDay || Number(day) < minDay) ? "" : day;

  const select = (invalid: boolean) => `${inputClass(invalid)} appearance-auto`;

  return (
    <div className="space-y-5">
      <fieldset aria-describedby={errors.date ? `${id}-date-error` : `${id}-date-hint`}>
        <legend className="text-sm font-bold">生年月日</legend>
        <div className="mt-1 grid grid-cols-[1.4fr_1fr_1fr] gap-2">
          <label className="block">
            <span className="sr-only">年</span>
            <select
              name="year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
              className={select(Boolean(errors.date))}
            >
              <option value="">年</option>
              {range(FIRST_YEAR, maxYear)
                .reverse()
                .map((y) => (
                  <option key={y} value={y}>
                    {y}年
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">月</span>
            <select
              name="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
              className={select(Boolean(errors.date))}
            >
              <option value="">月</option>
              {range(1, 12).map((m) => (
                <option key={m} value={m}>
                  {m}月
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">日</span>
            <select
              name="day"
              value={dayValue}
              onChange={(e) => setDay(e.target.value)}
              required
              className={select(Boolean(errors.date))}
            >
              <option value="">日</option>
              {range(minDay, maxDay).map((d) => (
                <option key={d} value={d}>
                  {d}日
                </option>
              ))}
            </select>
          </label>
        </div>
        <FieldFooter id={`${id}-date`} hint={`${FIRST_YEAR}年1月6日〜${maxYear}年12月31日の間で選べます。`} error={errors.date} />
      </fieldset>

      <fieldset>
        <legend className="text-sm font-bold">出生時刻</legend>
        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            name="hourUnknown"
            checked={hourUnknown}
            onChange={(e) => setHourUnknown(e.target.checked)}
            className="size-5 accent-[var(--primary)]"
          />
          <span>時間がわからない</span>
        </label>
        {!hourUnknown && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="sr-only">時</span>
              <select name="hour" defaultValue={defaults.hour ?? ""} className={select(Boolean(errors.time))}>
                <option value="">時</option>
                {range(0, 23).map((h) => (
                  <option key={h} value={h}>
                    {h}時
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">分</span>
              <select name="minute" defaultValue={defaults.minute ?? ""} className={select(Boolean(errors.time))}>
                <option value="">分</option>
                {range(0, 59).map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}分
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <FieldFooter
          id={`${id}-time`}
          hint={hourUnknown ? "時柱を出さずに計算します。" : "わかる範囲で構いません。母子手帳などに書かれています。"}
          error={errors.time}
        />
      </fieldset>

      <div>
        <label htmlFor={`${id}-place`} className="block text-sm font-bold">
          出生地（都道府県）
        </label>
        <select
          id={`${id}-place`}
          name="birthPlace"
          defaultValue={defaults.birthPlace ?? ""}
          required
          aria-invalid={errors.birthPlace ? true : undefined}
          className={select(Boolean(errors.birthPlace))}
        >
          <option value="">選んでください</option>
          {REGIONS.map((r) => (
            <optgroup key={r.label} label={r.label}>
              {prefectures
                .filter((p) => Number(p.code) >= r.from && Number(p.code) <= r.to)
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <FieldFooter
          id={`${id}-place`}
          hint="生まれた場所の経度で、時刻を補正します。海外の場合は、いちばん近い都道府県を選んでください。"
          error={errors.birthPlace}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-bold">性別</legend>
        <div className="mt-2 flex gap-6">
          {[
            { value: "female", label: "女性" },
            { value: "male", label: "男性" },
          ].map((g) => (
            <label key={g.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="gender"
                value={g.value}
                defaultChecked={defaults.gender === g.value}
                required
                className="size-5 accent-[var(--primary)]"
              />
              <span>{g.label}</span>
            </label>
          ))}
        </div>
        <FieldFooter id={`${id}-gender`} hint="大運（10年ごとの流れ）の向きの計算に使います。" error={errors.gender} />
      </fieldset>
    </div>
  );
}
