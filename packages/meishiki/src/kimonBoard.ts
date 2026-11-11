/**
 * 奇門遁甲の作盤（地盤干・天盤干・八門・九星・八神・点数・凶格）
 *
 * 現行: backend/apps/fortune/calculators.py（place_jiban_kan・place_tenban_kan・place_hachimon・
 * place_kyusei・place_hasshin・calculate_palace_score・check_kyokaku・check_gobuuji・
 * calculate_kimon_tonkou_board）
 *
 * 宮の位置は洛書の数（1〜9）で表す。盤面の並びは次のとおり（上が南）。
 *
 *   4 9 2
 *   3 5 7
 *   8 1 6
 *
 * 配置の手順は現行版をそのまま移している（中宮の扱いなど、現行版の独特な決まりも含めて同じ結果になる）。
 * 凶格の判定だけは、現行版の不具合を直している（kimon.ts の冒頭の説明を参照）。
 */
import { BRANCHES, KEIKO_CYCLE, STEMS, STEM_TO_ELEMENT, YANG_STEMS, mod, type Branch, type Stem } from './constants';
import { KYOKAKU_RULES, type YinYang } from './kimonData';

export type KimonBoardType = '時盤' | '日盤';

/** 宮の位置（洛書の数） */
export type PalacePosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const PALACE_POSITIONS: readonly PalacePosition[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** 盤面の表示順（左上から右下へ） */
export const PALACE_GRID_ORDER: readonly PalacePosition[] = [4, 9, 2, 3, 5, 7, 8, 1, 6];

/** 宮の名前と方位 */
export const PALACE_INFO: Readonly<Record<PalacePosition, { name: string; direction: string }>> = {
  1: { name: '坎宮', direction: '北' },
  2: { name: '坤宮', direction: '南西' },
  3: { name: '震宮', direction: '東' },
  4: { name: '巽宮', direction: '南東' },
  5: { name: '中宮', direction: '中央' },
  6: { name: '乾宮', direction: '北西' },
  7: { name: '兌宮', direction: '西' },
  8: { name: '艮宮', direction: '北東' },
  9: { name: '離宮', direction: '南' },
};

/** 八門（1文字で表す。休＝休門） */
export type Hachimon = '休' | '生' | '傷' | '杜' | '景' | '死' | '驚' | '開';
/** 九星（1文字で表す。蓬＝天蓬星） */
export type Kyusei = '蓬' | '任' | '冲' | '輔' | '英' | '芮' | '柱' | '心';
/** 八神（1文字で表す。符＝直符、陳＝勾陳（白虎）、雀＝朱雀（玄武）） */
export type Hasshin = '符' | '蛇' | '陰' | '合' | '陳' | '雀' | '地' | '天';

/** 三奇六儀の順（地盤干を並べる順） */
const SANKI_ROKUGI: readonly Stem[] = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];

/** 八門の定位（中宮はなし） */
const HACHIMON_TEII: Readonly<Record<number, Hachimon>> = { 1: '休', 2: '死', 3: '傷', 4: '杜', 6: '開', 7: '驚', 8: '生', 9: '景' };

/** 九星の定位（中宮はなし） */
const KYUSEI_TEII: Readonly<Record<number, Kyusei>> = { 1: '蓬', 2: '芮', 3: '冲', 4: '輔', 6: '心', 7: '柱', 8: '任', 9: '英' };

/** 八門の順（外側の8宮を時計回り） */
const HACHIMON_ORDER: readonly Hachimon[] = ['休', '生', '傷', '杜', '景', '死', '驚', '開'];
/** 九星の順（外側の8宮を時計回り） */
const KYUSEI_ORDER: readonly Kyusei[] = ['蓬', '任', '冲', '輔', '英', '芮', '柱', '心'];
/** 八神の順 */
const HASSHIN_ORDER: readonly Hasshin[] = ['符', '蛇', '陰', '合', '陳', '雀', '地', '天'];

/** 干の数（甲=1 … 癸=10）。直使を飛ばす数に使う */
const KAN_NO_KAZU: Readonly<Record<Stem, number>> = {
  甲: 1, 乙: 2, 丙: 3, 丁: 4, 戊: 5, 己: 6, 庚: 7, 辛: 8, 壬: 9, 癸: 10,
};

/** 中宮の寄宮（坤二宮） */
const KUN_PALACE: PalacePosition = 2;

/**
 * 各宮から時計回りに外側の8宮をたどる順（先頭がその宮）。
 * 中宮（5）から始めるときは、坤二宮（2）から始める（現行版の決まり）
 */
const CLOCKWISE_FROM: Readonly<Record<PalacePosition, readonly PalacePosition[]>> = {
  1: [1, 8, 3, 4, 9, 2, 7, 6],
  2: [2, 7, 6, 1, 8, 3, 4, 9],
  3: [3, 4, 9, 2, 7, 6, 1, 8],
  4: [4, 9, 2, 7, 6, 1, 8, 3],
  5: [2, 7, 6, 1, 8, 3, 4, 9],
  6: [6, 1, 8, 3, 4, 9, 2, 7],
  7: [7, 6, 1, 8, 3, 4, 9, 2],
  8: [8, 3, 4, 9, 2, 7, 6, 1],
  9: [9, 2, 7, 6, 1, 8, 3, 4],
};

/** 各宮から反時計回りに外側の8宮をたどる順（中宮は坤二宮から） */
const COUNTER_CLOCKWISE_FROM: Readonly<Record<PalacePosition, readonly PalacePosition[]>> = {
  1: [1, 6, 7, 2, 9, 4, 3, 8],
  2: [2, 9, 4, 3, 8, 1, 6, 7],
  3: [3, 8, 1, 6, 7, 2, 9, 4],
  4: [4, 3, 8, 1, 6, 7, 2, 9],
  5: [2, 9, 4, 3, 8, 1, 6, 7],
  6: [6, 7, 2, 9, 4, 3, 8, 1],
  7: [7, 2, 9, 4, 3, 8, 1, 6],
  8: [8, 1, 6, 7, 2, 9, 4, 3],
  9: [9, 4, 3, 8, 1, 6, 7, 2],
};

/** 1〜9 の飛泊（陽遁は 1→2→…→9→1、陰遁は逆）で、start から steps 個進んだ宮 */
function fly(start: number, steps: number, yinYang: YinYang): PalacePosition {
  return (mod(start - 1 + (yinYang === '陽' ? steps : -steps), 9) + 1) as PalacePosition;
}

/** 旬首（その干支が属する旬の遁干。甲子旬=戊、甲戌旬=己 … 甲寅旬=癸） */
export function junshuOf(stem: Stem, branch: Branch): Stem {
  const s = STEMS.indexOf(stem);
  const b = BRANCHES.indexOf(branch);
  for (let i = 0; i < 60; i++) {
    if (i % 10 === s && i % 12 === b) return SANKI_ROKUGI[Math.floor(i / 10)]!;
  }
  throw new Error(`干支が見つかりません: ${stem}${branch}`);
}

/** 作盤の途中経過（直使・大直符など）。画面の補足表示や検証に使う */
export interface KimonBoardDetail {
  /** 用事干支（時盤は時柱、日盤は日柱） */
  stem: Stem;
  branch: Branch;
  /** 旬首 */
  junshu: Stem;
  /** 地盤干で旬首がある宮 */
  junshuJibanPosition: PalacePosition;
  /** 天盤干で旬首を置いた宮（用事干が中宮なら坤二宮） */
  junshuTenbanPosition: PalacePosition;
  /** 地盤干で用事干がある宮（用事干が甲なら旬首の宮） */
  targetPosition: PalacePosition;
  /** 直使（八門） */
  chokushi: {
    /** 直使の門（地盤の旬首の宮の定位の門。中宮なら坤二宮の門。時支飛宮のときは休門） */
    mon: Hachimon;
    /** 直使を置いた宮 */
    position: PalacePosition;
    /**
     * 時支飛宮を使ったか（時盤で旬首が中宮のとき、坎一宮の休門から時支の序数だけ飛ばす）。
     * 使わないときは用事干の「干の数」だけ飛ばす
     */
    branchFly: boolean;
  };
  /** 大直符（九星） */
  chokufu: {
    star: Kyusei;
    /** 大直符を置いた宮（用事干が中宮なら坤二宮） */
    position: PalacePosition;
  };
  /** 八神の「符」を置いた宮（用事干が中宮なら坤二宮） */
  hasshinStartPosition: PalacePosition;
  /** 中宮の地盤干を天盤干に複製して添えた宮（複製しなかったら null） */
  centerCopyPosition: PalacePosition | null;
}

/** 作盤の結果（宮ごとの配置。凶格と点数はまだ入っていない） */
export interface KimonBoardLayout {
  jiban: Record<PalacePosition, Stem>;
  /** 天盤干。中宮は空。中宮の地盤干を複製した宮は2つ */
  tenban: Record<PalacePosition, Stem[]>;
  hachimon: Record<PalacePosition, Hachimon | null>;
  kyusei: Record<PalacePosition, Kyusei | null>;
  hasshin: Record<PalacePosition, Hasshin | null>;
  /** 中宮の干支（用事干が中宮にあるときだけ。離九宮に添えて表示する） */
  chugan: string | null;
  detail: KimonBoardDetail;
}

function emptyRecord<T>(value: () => T): Record<PalacePosition, T> {
  return Object.fromEntries(PALACE_POSITIONS.map((p) => [p, value()])) as Record<PalacePosition, T>;
}

/** 地盤干を置く（局数の宮から、陽遁は順、陰遁は逆に三奇六儀を並べる） */
function placeJiban(kyokusu: number, yinYang: YinYang): Record<PalacePosition, Stem> {
  const jiban = {} as Record<PalacePosition, Stem>;
  SANKI_ROKUGI.forEach((kan, i) => {
    jiban[fly(kyokusu, i, yinYang)] = kan;
  });
  return jiban;
}

function positionOf(jiban: Record<PalacePosition, Stem>, kan: Stem): PalacePosition | null {
  return PALACE_POSITIONS.find((p) => jiban[p] === kan) ?? null;
}

/**
 * 作盤（現行: calculate_kimon_tonkou_board の配置部分）
 *
 * @param stem 用事干（時盤は時干、日盤は日干）
 * @param branch 用事支（時盤は時支、日盤は日支）
 */
export function layoutKimonBoard(
  stem: Stem,
  branch: Branch,
  yinYang: YinYang,
  kyokusu: number,
  type: KimonBoardType,
): KimonBoardLayout {
  // ② 地盤干
  const jiban = placeJiban(kyokusu, yinYang);
  const junshu = junshuOf(stem, branch);
  const junshuJibanPosition = positionOf(jiban, junshu)!; // 旬首（戊〜癸）は必ずある
  // 用事干の宮（甲は地盤にないので旬首の宮）
  const targetPosition = stem === '甲' ? junshuJibanPosition : positionOf(jiban, stem)!;
  // 用事干が中宮のときは、坤二宮に寄せる
  const placement: PalacePosition = targetPosition === 5 ? KUN_PALACE : targetPosition;

  // ③ 天盤干：用事干の宮に旬首を置き、地盤の旬首から時計回りに見た地盤干（A）を順に並べる
  const tenbanSingle = new Map<PalacePosition, Stem>();
  const junshuTenbanPosition = placement;
  tenbanSingle.set(junshuTenbanPosition, junshu);
  const a = CLOCKWISE_FROM[junshuJibanPosition].map((p) => jiban[p]);
  CLOCKWISE_FROM[junshuTenbanPosition].forEach((p, i) => {
    if (i > 0 && i < a.length) tenbanSingle.set(p, a[i]!);
  });
  const tenban = emptyRecord<Stem[]>(() => []);
  for (const [p, kan] of tenbanSingle) tenban[p] = [kan];
  // 中宮の地盤干を複製し、坤二宮の地盤干と同じ天盤干の宮（B）に添える
  let centerCopyPosition: PalacePosition | null = null;
  for (const [p, kan] of tenbanSingle) {
    if (kan === jiban[2]) {
      tenban[p] = [kan, jiban[5]];
      centerCopyPosition = p;
      break;
    }
  }
  // 中宮の干支（用事干が中宮のとき）
  const chugan = targetPosition === 5 ? `${stem}${branch}` : null;

  // ④ 八門：直使を決めて置き、そこから時計回りに八門の順で置く
  const branchFly = junshuJibanPosition === 5 && type === '時盤';
  let chokushiMon: Hachimon;
  let chokushiPosition: PalacePosition;
  if (branchFly) {
    chokushiMon = HACHIMON_TEII[1]!; // 坎一宮の休門
    chokushiPosition = fly(1, BRANCHES.indexOf(branch), yinYang); // 子=1 なので (序数-1) 進む
  } else {
    const teiiPosition = junshuJibanPosition === 5 ? KUN_PALACE : junshuJibanPosition;
    chokushiMon = HACHIMON_TEII[teiiPosition]!;
    chokushiPosition = fly(teiiPosition, KAN_NO_KAZU[stem] - 1, yinYang);
  }
  const hachimon = emptyRecord<Hachimon | null>(() => null);
  hachimon[chokushiPosition] = chokushiMon;
  const monIndex = HACHIMON_ORDER.indexOf(chokushiMon);
  // 直使が中宮に来たとき、たどる順は坤二宮から始まり、坤二宮には門が入らない（現行版のまま）
  CLOCKWISE_FROM[chokushiPosition].forEach((p, i) => {
    if (i > 0) hachimon[p] = HACHIMON_ORDER[(monIndex + i) % 8]!;
  });

  // ⑤ 九星：地盤の旬首の宮の定位の星（大直符）を用事干の宮に置き、時計回りに並べる
  const chokufuStar = KYUSEI_TEII[junshuJibanPosition === 5 ? KUN_PALACE : junshuJibanPosition]!;
  const kyusei = emptyRecord<Kyusei | null>(() => null);
  kyusei[placement] = chokufuStar;
  const starIndex = KYUSEI_ORDER.indexOf(chokufuStar);
  CLOCKWISE_FROM[placement].forEach((p, i) => {
    if (i > 0) kyusei[p] = KYUSEI_ORDER[(starIndex + i) % 8]!;
  });

  // ⑥ 八神：用事干の宮に「符」を置き、陽遁は時計回り、陰遁は反時計回りに並べる
  const hasshin = emptyRecord<Hasshin | null>(() => null);
  hasshin[placement] = '符';
  const order = yinYang === '陽' ? CLOCKWISE_FROM[placement] : COUNTER_CLOCKWISE_FROM[placement];
  order.forEach((p, i) => {
    if (i > 0) hasshin[p] = HASSHIN_ORDER[i % 8]!;
  });

  return {
    jiban,
    tenban,
    hachimon,
    kyusei,
    hasshin,
    chugan,
    detail: {
      stem,
      branch,
      junshu,
      junshuJibanPosition,
      junshuTenbanPosition,
      targetPosition,
      chokushi: { mon: chokushiMon, position: chokushiPosition, branchFly },
      chokufu: { star: chokufuStar, position: placement },
      hasshinStartPosition: placement,
      centerCopyPosition,
    },
  };
}

// ---------------------------------------------------------------------------
// 点数

const HACHIMON_SCORES: Partial<Record<Hachimon, number>> = { 休: 40, 生: 40, 開: 40, 景: 20 };
const HASSHIN_SCORES: Partial<Record<Hasshin, number>> = { 符: 20, 陰: 20, 合: 20, 地: 20, 天: 20 };
const KYUSEI_SCORES: Partial<Record<Kyusei, number>> = { 任: 10, 冲: 10, 輔: 10, 心: 10 };
/** 三奇（乙・丙・丁）。天盤干・地盤干それぞれに加点 */
const SANKI_SCORE = 10;
const SANKI: ReadonlySet<Stem> = new Set<Stem>(['乙', '丙', '丁']);

/** 宮の点数（現行: calculate_palace_score）。中宮は点数なし（null） */
export function palaceScore(layout: KimonBoardLayout, position: PalacePosition): number | null {
  if (position === 5) return null;
  let score = 0;
  const mon = layout.hachimon[position];
  if (mon) score += HACHIMON_SCORES[mon] ?? 0;
  const shin = layout.hasshin[position];
  if (shin) score += HASSHIN_SCORES[shin] ?? 0;
  const star = layout.kyusei[position];
  if (star) score += KYUSEI_SCORES[star] ?? 0;
  // 天盤干は、中宮の地盤干を複製した2つ目も数える（現行版と同じ）
  for (const kan of layout.tenban[position]) if (SANKI.has(kan)) score += SANKI_SCORE;
  if (SANKI.has(layout.jiban[position])) score += SANKI_SCORE;
  return score;
}

// ---------------------------------------------------------------------------
// 凶格

/** 凶格の判定に使う干。日盤では時干がない */
export interface KyokakuStems {
  junshu: Stem;
  year: Stem;
  month: Stem;
  /** 日干（時盤でも日柱の天干。現行版は時盤で時干を使っていた不具合を直している） */
  day: Stem;
  /** 時干（日盤は null） */
  hour: Stem | null;
}

/** 宮名 → 位置（条件の「離宮(九位)」などから位置を読む） */
const PALACE_NAME_TO_POSITION: readonly [string, PalacePosition][] = [
  ['離宮', 9], ['坎宮', 1], ['震宮', 3], ['兌宮', 7], ['坤宮', 2], ['乾宮', 6], ['艮宮', 8], ['巽宮', 4],
];

function positionInText(text: string): PalacePosition | null {
  return PALACE_NAME_TO_POSITION.find(([name]) => text.includes(name))?.[1] ?? null;
}

/**
 * 各宮の凶格（現行: check_kyokaku）
 *
 * 現行版からの変更:
 * - 置き換える干がない条件（日盤の「(時干)」＝天羅・地網）は判定しない。現行版はここで
 *   None を文字列に置き換えようとして、日盤が必ずエラーになっていた
 * - 門迫：条件の「休門」と盤の「休」を比べていたため一度も成立しなかった。「門」を除いて比べる
 * - 天盤干が2つある宮は、1つ目（本来の天盤干）だけで判定する（現行版と同じ）
 */
export function judgeKyokaku(
  layout: KimonBoardLayout,
  stems: KyokakuStems,
  type: KimonBoardType,
): Record<PalacePosition, string[]> {
  const result = emptyRecord<string[]>(() => []);
  const replacements: [string, Stem | null][] = [
    ['(旬首)', stems.junshu],
    ['(年干)', stems.year],
    ['(月干)', stems.month],
    ['(日干)', stems.day],
    ['(時干)', stems.hour],
  ];

  for (const rule of KYOKAKU_RULES) {
    if (rule.category === '五不遇時' && type !== '時盤') continue;

    if (rule.conditionType === 'tenban_jiban') {
      let condition = rule.conditionValue;
      let missing = false;
      for (const [placeholder, value] of replacements) {
        if (!condition.includes(placeholder)) continue;
        if (value === null) {
          missing = true;
          break;
        }
        condition = condition.split(placeholder).join(value);
      }
      if (missing) continue;
      const parts = condition.split(':');
      if (parts.length !== 2) continue;
      const [tenbanExpected, jibanExpected] = parts.map((s) => s.trim());
      for (const p of PALACE_POSITIONS) {
        const tenban = layout.tenban[p][0] ?? '';
        if (tenban === tenbanExpected && layout.jiban[p] === jibanExpected) result[p].push(rule.name);
      }
    } else if (rule.conditionType === 'hachimon_position' || rule.conditionType === 'tenban_position') {
      const [left, right] = rule.conditionValue.split('=');
      if (left === undefined || right === undefined) continue;
      const position = positionInText(right);
      if (position === null) continue;
      if (rule.conditionType === 'hachimon_position') {
        const expected = left.trim().replace(/門$/, '');
        if (layout.hachimon[position] === expected) result[position].push(rule.name);
      } else {
        if ((layout.tenban[position][0] ?? '') === left.trim()) result[position].push(rule.name);
      }
    }
    // day_hour（五不遇時）は宮ごとではなく盤全体の判定なので、gobuujiOf で判定する
  }
  return result;
}

/**
 * 五不遇時（現行: check_gobuuji）。時干が日干を剋し、陰陽が同じとき成立する。
 * 現行版は日干の代わりに時干を渡していたため、一度も成立しなかった（直している）
 */
export function gobuujiOf(dayStem: Stem, hourStem: Stem): boolean {
  if (YANG_STEMS.has(dayStem) !== YANG_STEMS.has(hourStem)) return false;
  const hourElement = STEM_TO_ELEMENT[hourStem];
  const killed = KEIKO_CYCLE[(KEIKO_CYCLE.indexOf(hourElement) + 1) % 5];
  return killed === STEM_TO_ELEMENT[dayStem];
}
