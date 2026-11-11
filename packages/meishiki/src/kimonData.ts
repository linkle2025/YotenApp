/**
 * 奇門遁甲のデータ（局数・凶格）の読み込み
 *
 * 元データ: data/kimon/kyokusu.csv・kyokaku.csv（現行 backend/apps/fortune/data/ と同じ内容）
 * サーバーレス環境では実行時にファイルを読まないため、src/kimon.generated.ts に文字列として同梱し、
 * ここで表に直す。CSV を書き換えたら `pnpm --filter @yoten/meishiki generate:kimon` を実行する。
 *
 * 現行: backend/apps/fortune/calculators.py（load_kyokusu_data・get_kyokusu_for_date・load_kyokaku_data）
 */
import { KYOKAKU_CSV, KYOKUSU_CSV } from './kimon.generated';

export type YinYang = '陰' | '陽';

/** 陰遁・陽遁と局数の組 */
export interface KyokusuValue {
  yinYang: YinYang;
  /** 局数（1〜9） */
  kyokusu: number;
}

export interface KyokusuEntry {
  /** 日付（YYYYMMDD） */
  date: string;
  /** その日の日干支（データに書かれている値。計算には使わない） */
  dayGanzhi: string;
  /** 日盤の陰陽・局数 */
  day: KyokusuValue;
  /**
   * 日盤の2つ目の値。データに「陽/陰」「3/7」のように2つ書かれている日（夏至・冬至の切り替わり）だけ。
   * 現行版は1つ目の値だけを使うので、計算にも1つ目（day）を使う
   */
  dayAlternative: KyokusuValue | null;
  /** 時盤の陰陽・局数 */
  hour: KyokusuValue;
  /** 時盤の2つ目の値（day と同じ扱い。今のデータにはない） */
  hourAlternative: KyokusuValue | null;
}

/** 凶格の判定ルール（kyokaku.csv の1行） */
export interface KyokakuRule {
  /** 分類（天盤地盤・門迫・三奇入墓・六儀撃刑・五不遇時） */
  category: string;
  /** 条件の種類 */
  conditionType: 'tenban_jiban' | 'hachimon_position' | 'tenban_position' | 'day_hour';
  /** 条件（例: 「庚:(旬首)」「休門=離宮(九位)」「乙=坤宮(二位)」） */
  conditionValue: string;
  /** 格の名前 */
  name: string;
  /** 説明 */
  description: string;
}

/** 簡単な CSV の読み取り（引用符を使わないデータだけを想定。使っていたらエラーにする） */
function parseCsv(text: string, file: string): Record<string, string>[] {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  const header = (lines.shift() ?? '').split(',');
  return lines.map((line, i) => {
    if (line.includes('"')) {
      throw new Error(`${file} の ${i + 2} 行目: 引用符には対応していません`);
    }
    const cells = line.split(',');
    if (cells.length !== header.length) {
      throw new Error(`${file} の ${i + 2} 行目: 列の数が見出しと合いません`);
    }
    return Object.fromEntries(header.map((name, j) => [name, cells[j]!.trim()]));
  });
}

function parseYinYang(value: string, context: string): YinYang {
  if (value !== '陰' && value !== '陽') throw new Error(`kyokusu.csv（${context}）: 陰陽が不正です: ${value}`);
  return value;
}

function parseNumber(value: string, context: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 9) throw new Error(`kyokusu.csv（${context}）: 局数が不正です: ${value}`);
  return n;
}

/** 「陽/陰」「3/7」のような2つ書きを、1つ目と2つ目に分ける */
function parsePair(yinYang: string, number: string, context: string): [KyokusuValue, KyokusuValue | null] {
  const ys = yinYang.split('/');
  const ns = number.split('/');
  const first = { yinYang: parseYinYang(ys[0]!, context), kyokusu: parseNumber(ns[0]!, context) };
  if (ys.length === 1 && ns.length === 1) return [first, null];
  const second = {
    yinYang: parseYinYang(ys[1] ?? ys[0]!, context),
    kyokusu: parseNumber(ns[1] ?? ns[0]!, context),
  };
  return [first, second];
}

function loadKyokusu(): ReadonlyMap<string, KyokusuEntry> {
  const map = new Map<string, KyokusuEntry>();
  for (const row of parseCsv(KYOKUSU_CSV, 'kyokusu.csv')) {
    const date = row.date!;
    const [day, dayAlternative] = parsePair(row.day_yinyang!, row.day_number!, date);
    const [hour, hourAlternative] = parsePair(row.hour_yinyang!, row.hour_number!, date);
    map.set(date, { date, dayGanzhi: row.day_ganzhi!, day, dayAlternative, hour, hourAlternative });
  }
  return map;
}

const CONDITION_TYPES = new Set<string>(['tenban_jiban', 'hachimon_position', 'tenban_position', 'day_hour']);

function loadKyokaku(): readonly KyokakuRule[] {
  return parseCsv(KYOKAKU_CSV, 'kyokaku.csv').map((row) => {
    const conditionType = row.condition_type!;
    if (!CONDITION_TYPES.has(conditionType)) {
      throw new Error(`kyokaku.csv: 条件の種類が不正です: ${conditionType}`);
    }
    return {
      category: row.category!,
      conditionType: conditionType as KyokakuRule['conditionType'],
      conditionValue: row.condition_value!,
      name: row.kyokaku_name!,
      description: row.description ?? '',
    };
  });
}

/** 局数データ（日付 YYYYMMDD → 値） */
export const KYOKUSU_DATA: ReadonlyMap<string, KyokusuEntry> = loadKyokusu();

/** 凶格の判定ルール（CSV の行の順） */
export const KYOKAKU_RULES: readonly KyokakuRule[] = loadKyokaku();

/** 局数データがある年（今は 2026 年だけ） */
export const KYOKUSU_YEARS: readonly number[] = [
  ...new Set([...KYOKUSU_DATA.keys()].map((date) => Number(date.slice(0, 4)))),
].sort((a, b) => a - b);

/** 日付の局数データ。なければ null */
export function kyokusuEntryOf(year: number, month: number, day: number): KyokusuEntry | null {
  const key = `${String(year).padStart(4, '0')}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
  return KYOKUSU_DATA.get(key) ?? null;
}
