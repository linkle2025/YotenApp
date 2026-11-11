/**
 * 奇門遁甲（時盤・日盤）の計算
 *
 * 現行: backend/apps/fortune/views.py（calculate_kimon_tonkou）と
 *       backend/apps/fortune/calculators.py（calculate_kimon_tonkou_board ほか）
 *
 * 現行版と同じにしていること:
 * - 局数データは 2026 年分だけ（data/kimon/kyokusu.csv）。陰陽と局数の両方を指定したときだけ、
 *   データのない日でも作盤できる（現行の画面の「陰陽（任意）」「局数（任意）」と同じ）
 * - 局数は入力した日付で引く（時盤で補正によって日付が変わっても、入力日の局数を使う）
 * - 時盤：経度差と均時差で補正した時刻（自然時）で年柱・月柱・日柱・時柱を出す。均時差は入力した月で引く。
 *   補正後が23時台なら子の刻で、日柱は当日のまま（命式の lateNightRule 'sameDay' と同じ）
 * - 日盤：補正しない。年柱・月柱は入力日の0時で出す（立春・節入りの当日は、前の年・月の柱になる）
 * - 用事干支（盤を作る干支）は、時盤は時柱、日盤は日柱
 *
 * 現行版から変えたこと（不具合の修正）:
 * - 日盤が必ずエラー（「replace() argument 2 must be str, not None」）になっていた。凶格の判定で、
 *   日盤にはない時干（None）を条件の「(時干)」に置き換えようとしていたのが原因。日盤では時干を使う条件
 *   （天羅・地網）を判定しないようにした。あわせて、その先で五不遇時のフラグが未設定のまま返そうとして
 *   エラーになる箇所も、日盤では false にした
 * - 時盤の凶格の「(日干)」（日格・雲干）に、日干ではなく時干が使われていた（作盤用の干をそのまま渡していた）。
 *   日柱の天干を使うようにした。五不遇時も同じ理由で一度も成立しなかったのを直した
 * - 門迫：条件の「休門」と盤の「休」を比べていたため一度も成立しなかったのを直した
 * - 1月1日〜小寒前の月柱：命式と同じく前年12月（大雪）の月柱を使う（現行は前年1月の丑月を拾う不具合）
 * - 1日分の時盤（12枚）は、1枚が失敗しても他の盤は返す（現行の画面は1枚でも失敗すると全部消える）
 * - 都市名ではなく、都道府県コード（命式と同じ）で場所を指定する。補正値は現行の都市と同じ
 */
import type { Branch, Stem } from './constants';
import {
  FIRST_YEAR,
  LAST_YEAR,
  fromMinutes,
  isValidDate,
  toDayNumber,
  toMinutes,
  type CivilDate,
  type CivilDateTime,
} from './calendar';
import { MeishikiInputError, dayPillarOf, hourPillar, monthPillar, yearPillar } from './meishiki';
import { EQUATION_OF_TIME_MINUTES, getPrefecture, type Prefecture } from './places';
import { KYOKUSU_YEARS, kyokusuEntryOf, type KyokusuValue, type YinYang } from './kimonData';
import {
  PALACE_INFO,
  PALACE_POSITIONS,
  gobuujiOf,
  judgeKyokaku,
  layoutKimonBoard,
  palaceScore,
  type Hachimon,
  type Hasshin,
  type KimonBoardDetail,
  type KimonBoardType,
  type Kyusei,
  type PalacePosition,
} from './kimonBoard';

/** 奇門遁甲の計算ロジックの版。保存するときの再計算の目印 */
export const KIMON_CALC_VERSION = 'kimon-0.2.0';

/** 時盤の既定の場所（東京都。現行の既定「東京」と同じ） */
export const KIMON_DEFAULT_PLACE = '13';

export interface KimonInput {
  type: KimonBoardType;
  year: number;
  month: number;
  day: number;
  /** 時（0〜23）。時盤では必須、日盤では使わない */
  hour?: number;
  /** 分（0〜59、既定 0）。日盤では使わない */
  minute?: number;
  /** 場所の都道府県コード（01〜47、既定 '13' 東京都）。時盤の時刻補正に使う。日盤では使わない */
  place?: string;
  /** 陰陽を指定する（省略時は局数データから決める） */
  yinYang?: YinYang;
  /** 局数（1〜9）を指定する（省略時は局数データから決める） */
  kyokusu?: number;
}

export type KimonInputErrorCode =
  /** 入力の形が正しくない */
  | 'invalid'
  /** その日の局数データがない（今は 2026 年だけ） */
  | 'noKyokusuData';

export class KimonInputError extends Error {
  constructor(
    message: string,
    readonly field: 'type' | 'date' | 'time' | 'place' | 'yinYang' | 'kyokusu',
    readonly code: KimonInputErrorCode = 'invalid',
  ) {
    super(message);
    this.name = 'KimonInputError';
  }
}

/** 干支 */
export interface KimonPillar {
  stem: Stem;
  branch: Branch;
}

export interface KimonPalace {
  /** 宮の位置（洛書の数 1〜9） */
  position: PalacePosition;
  /** 宮の名前（坎宮など） */
  name: string;
  /** 方位（北など。上が南の盤面） */
  direction: string;
  /** 地盤干 */
  jibanKan: Stem;
  /**
   * 天盤干。中宮は空。ふつうは1つ。中宮の地盤干を複製して添えた宮だけ2つ（1つ目が本来の天盤干）。
   * 現行版の tenban_kan（文字列、または2つのときはリスト）に当たる
   */
  tenbanKan: Stem[];
  /** 九星（中宮は null） */
  kyusei: Kyusei | null;
  /** 八門（ふつう中宮は null。直使が中宮に来たときだけ中宮に入り、坤二宮が null になる＝現行版のまま） */
  hachimon: Hachimon | null;
  /** 八神（中宮は null） */
  hasshin: Hasshin | null;
  /** 中宮の干支。用事干が中宮にあるとき、離九宮（9）にだけ入る */
  chugan: string | null;
  /** 点数（八門・八神・九星・三奇の合計）。中宮は null */
  score: number | null;
  /** 凶格の名前（kyokaku.csv の行の順） */
  kyokaku: string[];
  /** 吉格の名前（風遁・玉女守門。judgeKichikaku を参照） */
  kichikaku: string[];
  /** 地盤干が旬首か（画面では括弧で囲む） */
  isJunshuJiban: boolean;
  /** 天盤干の1つ目が旬首か（画面では括弧で囲む） */
  isJunshuTenban: boolean;
}

/** 三吉門（休・生・開） */
const SANKICHIMON: readonly Hachimon[] = ['休', '生', '開'];

/**
 * 吉格の判定（陽てん塾の指定による。凶格の kyokaku.csv とは別に、ここで決める）
 * - 風遁：天盤に「乙」があり、三吉門（休・生・開）が巽宮（4）にある
 * - 玉女守門：天盤に「丁」があり、直使（八門の直使）と同じ宮にある
 * 天盤干が2つある宮（中宮の地盤干を添えた宮）は、どちらの干も天盤干として見る。
 */
export function judgeKichikaku(palace: {
  position: PalacePosition;
  tenbanKan: readonly string[];
  hachimon: Hachimon | null;
  chokushiPosition: PalacePosition;
}): string[] {
  const result: string[] = [];
  if (palace.position === 4 && palace.tenbanKan.includes('乙') && palace.hachimon && SANKICHIMON.includes(palace.hachimon)) {
    result.push('風遁');
  }
  if (palace.position === palace.chokushiPosition && palace.tenbanKan.includes('丁')) {
    result.push('玉女守門');
  }
  return result;
}

export interface KimonResult {
  calcVersion: string;
  type: KimonBoardType;
  input: {
    year: number;
    month: number;
    day: number;
    /** 日盤は null */
    hour: number | null;
    minute: number | null;
    /** 都道府県コード。日盤は null */
    place: string | null;
  };
  /** 時刻の補正（時盤のみ。日盤は null） */
  correction: {
    /** 場所の都道府県名 */
    placeName: string;
    longitudeMinutes: number;
    equationOfTimeMinutes: number;
    /** 補正後の日時（自然時） */
    adjusted: CivilDateTime;
  } | null;
  /** 四柱（日盤は時柱が null） */
  pillars: { year: KimonPillar; month: KimonPillar; day: KimonPillar; hour: KimonPillar | null };
  /** 盤を作った干支（時盤は時柱、日盤は日柱） */
  usedPillar: KimonPillar;
  yinYang: YinYang;
  /** 局数（1〜9） */
  kyokusu: number;
  /**
   * 陰陽・局数をどこから決めたか。
   * data＝局数データ、manual＝両方を指定、mixed＝片方だけ指定して残りをデータから
   */
  kyokusuSource: 'data' | 'manual' | 'mixed';
  /** 局数データに2つ書かれている日の2つ目（夏至・冬至の切り替わり）。参考表示用 */
  kyokusuAlternative: KyokusuValue | null;
  /** 旬首 */
  junshu: Stem;
  /** 地盤干で旬首がある宮（現行の junshu_jiban_pos） */
  junshuJibanPosition: PalacePosition;
  /** 天盤干で旬首を置いた宮（現行の junshu_tenban_pos） */
  junshuTenbanPosition: PalacePosition;
  /** 中宮の干支（用事干が中宮にあるとき。離九宮の chugan と同じ） */
  chugan: string | null;
  /** 9つの宮（位置 1〜9 の順。表示の並びは PALACE_GRID_ORDER） */
  palaces: KimonPalace[];
  /** 五不遇時（時盤のみ。日盤は false） */
  gobuuji: boolean;
  /** 作盤の途中経過（直使・大直符など。現行の debug に当たる要点） */
  detail: KimonBoardDetail;
}

function validate(input: KimonInput): void {
  if (input.type !== '時盤' && input.type !== '日盤') {
    throw new KimonInputError('盤の種類は「時盤」か「日盤」を指定してください。', 'type');
  }
  if (!isValidDate(input)) {
    throw new KimonInputError('存在しない日付です。', 'date');
  }
  if (input.year < FIRST_YEAR || input.year > LAST_YEAR) {
    throw new KimonInputError(`${FIRST_YEAR}年〜${LAST_YEAR}年の日付に対応しています。`, 'date');
  }
  if (input.type === '時盤') {
    const { hour, minute = 0 } = input;
    if (hour === undefined || !Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw new KimonInputError('時刻（時）が正しくありません。', 'time');
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new KimonInputError('時刻（分）が正しくありません。', 'time');
    }
  }
  if (input.yinYang !== undefined && input.yinYang !== '陰' && input.yinYang !== '陽') {
    throw new KimonInputError('陰陽は「陰」か「陽」を指定してください。', 'yinYang');
  }
  if (input.kyokusu !== undefined && (!Number.isInteger(input.kyokusu) || input.kyokusu < 1 || input.kyokusu > 9)) {
    throw new KimonInputError('局数は 1〜9 の整数で指定してください。', 'kyokusu');
  }
}

/** 陰陽と局数を決める（指定がなければ局数データから。入力した日付で引く） */
function resolveKyokusu(input: KimonInput): Pick<KimonResult, 'yinYang' | 'kyokusu' | 'kyokusuSource' | 'kyokusuAlternative'> {
  if (input.yinYang !== undefined && input.kyokusu !== undefined) {
    return { yinYang: input.yinYang, kyokusu: input.kyokusu, kyokusuSource: 'manual', kyokusuAlternative: null };
  }
  const entry = kyokusuEntryOf(input.year, input.month, input.day);
  if (!entry) {
    const years = KYOKUSU_YEARS.map((y) => `${y}年`).join('・');
    throw new KimonInputError(
      `${input.year}年${input.month}月${input.day}日の局数データがありません（局数データは${years}分だけです）。陰陽と局数を両方指定すれば作盤できます。`,
      'date',
      'noKyokusuData',
    );
  }
  const value = input.type === '日盤' ? entry.day : entry.hour;
  const alternative = input.type === '日盤' ? entry.dayAlternative : entry.hourAlternative;
  const manualCount = Number(input.yinYang !== undefined) + Number(input.kyokusu !== undefined);
  return {
    yinYang: input.yinYang ?? value.yinYang,
    kyokusu: input.kyokusu ?? value.kyokusu,
    kyokusuSource: manualCount === 0 ? 'data' : 'mixed',
    kyokusuAlternative: alternative,
  };
}

function pillarsOf(input: KimonInput): Pick<KimonResult, 'correction' | 'pillars'> {
  const date: CivilDate = { year: input.year, month: input.month, day: input.day };
  if (input.type === '日盤') {
    // 日盤：補正なし。年柱・月柱は入力日の0時で出す（現行と同じ）
    const midnight = { ...date, hour: 0, minute: 0 };
    return {
      correction: null,
      pillars: {
        year: yearPillar(midnight),
        month: monthPillar(midnight),
        day: dayPillarOf(toDayNumber(date)),
        hour: null,
      },
    };
  }
  let prefecture: Prefecture;
  try {
    prefecture = getPrefecture(input.place ?? KIMON_DEFAULT_PLACE);
  } catch {
    throw new KimonInputError('場所（都道府県）が正しくありません。', 'place');
  }
  const longitudeMinutes = prefecture.longitudeOffsetMinutes;
  const equationOfTimeMinutes = EQUATION_OF_TIME_MINUTES[input.month] ?? 0; // 入力した月で引く
  const adjusted = fromMinutes(
    toMinutes({ ...date, hour: input.hour!, minute: input.minute ?? 0 }) + longitudeMinutes + equationOfTimeMinutes,
  );
  const day = dayPillarOf(toDayNumber(adjusted));
  return {
    correction: { placeName: prefecture.name, longitudeMinutes, equationOfTimeMinutes, adjusted },
    pillars: {
      year: yearPillar(adjusted),
      month: monthPillar(adjusted),
      day,
      hour: hourPillar(day.stem, adjusted.hour),
    },
  };
}

/**
 * 奇門遁甲の盤（時盤・日盤）を計算する
 *
 * @throws KimonInputError 入力が正しくないとき。局数データのない日（code: 'noKyokusuData'）も含む
 */
export function calculateKimonTonkou(input: KimonInput): KimonResult {
  validate(input);
  const kyokusu = resolveKyokusu(input);
  let pillarPart: Pick<KimonResult, 'correction' | 'pillars'>;
  try {
    pillarPart = pillarsOf(input);
  } catch (error) {
    // 節入りデータの範囲外（1901年1月初めなど）
    if (error instanceof MeishikiInputError) {
      throw new KimonInputError('節入りデータの範囲外のため、干支を決められません。', 'date');
    }
    throw error;
  }
  const { pillars } = pillarPart;
  const used = input.type === '時盤' ? pillars.hour! : pillars.day;

  const layout = layoutKimonBoard(used.stem, used.branch, kyokusu.yinYang, kyokusu.kyokusu, input.type);
  const { detail } = layout;
  const kyokaku = judgeKyokaku(
    layout,
    {
      junshu: detail.junshu,
      year: pillars.year.stem,
      month: pillars.month.stem,
      day: pillars.day.stem,
      hour: pillars.hour?.stem ?? null,
    },
    input.type,
  );

  const palaces: KimonPalace[] = PALACE_POSITIONS.map((position) => ({
    position,
    name: PALACE_INFO[position].name,
    direction: PALACE_INFO[position].direction,
    jibanKan: layout.jiban[position],
    tenbanKan: layout.tenban[position],
    kyusei: layout.kyusei[position],
    hachimon: layout.hachimon[position],
    hasshin: layout.hasshin[position],
    chugan: position === 9 ? layout.chugan : null,
    score: palaceScore(layout, position),
    kyokaku: kyokaku[position],
    kichikaku: judgeKichikaku({
      position,
      tenbanKan: layout.tenban[position],
      hachimon: layout.hachimon[position],
      chokushiPosition: detail.chokushi.position,
    }),
    isJunshuJiban: position === detail.junshuJibanPosition,
    isJunshuTenban: position === detail.junshuTenbanPosition,
  }));

  const isJiban = input.type === '時盤';
  return {
    calcVersion: KIMON_CALC_VERSION,
    type: input.type,
    input: {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: isJiban ? input.hour! : null,
      minute: isJiban ? (input.minute ?? 0) : null,
      place: isJiban ? (input.place ?? KIMON_DEFAULT_PLACE) : null,
    },
    ...pillarPart,
    usedPillar: { stem: used.stem, branch: used.branch },
    ...kyokusu,
    junshu: detail.junshu,
    junshuJibanPosition: detail.junshuJibanPosition,
    junshuTenbanPosition: detail.junshuTenbanPosition,
    chugan: layout.chugan,
    palaces,
    gobuuji: isJiban ? gobuujiOf(pillars.day.stem, pillars.hour!.stem) : false,
    detail,
  };
}

// ---------------------------------------------------------------------------
// 1日分の時盤

/** 1日分の時盤を作る時刻（0時・2時 … 22時の0分。現行の画面と同じ） */
export const KIMON_DAY_HOURS: readonly number[] = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

export interface KimonDayInput {
  year: number;
  month: number;
  day: number;
  /** 都道府県コード（既定 '13' 東京都） */
  place?: string;
  yinYang?: YinYang;
  kyokusu?: number;
}

export type KimonDaySlot =
  | { hour: number; ok: true; result: KimonResult }
  | { hour: number; ok: false; error: { message: string; code: KimonInputErrorCode | 'unexpected' } };

export interface KimonDayResult {
  date: CivilDate;
  /** 12枚の時盤（時刻の順）。失敗した枠は ok: false で、ほかの枠はそのまま返す */
  slots: KimonDaySlot[];
}

/**
 * 1日分の時盤（2時間ごとに12枚）を計算する。1枚が失敗しても、ほかの盤は返す。
 * 日付・場所などの入力そのものが正しくないときも例外にせず、全部の枠を ok: false で返す
 */
export function calculateKimonDay(input: KimonDayInput): KimonDayResult {
  const slots = KIMON_DAY_HOURS.map((hour): KimonDaySlot => {
    try {
      return { hour, ok: true, result: calculateKimonTonkou({ ...input, type: '時盤', hour, minute: 0 }) };
    } catch (error) {
      if (error instanceof KimonInputError) {
        return { hour, ok: false, error: { message: error.message, code: error.code } };
      }
      return { hour, ok: false, error: { message: '計算中に予期しないエラーが起きました。', code: 'unexpected' } };
    }
  });
  return { date: { year: input.year, month: input.month, day: input.day }, slots };
}
