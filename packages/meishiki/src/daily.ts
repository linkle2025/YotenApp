/**
 * 今日の干支と命式の関わり（管理者向けテスト機能）
 *
 * 今日の干支（年・月・日の三柱）を、本人の命式の4柱と突き合わせて、干合・剋・六合・三合・冲・刑・害・破・通変星などを
 * 機械的に洗い出す。AI には「洗い出した事実」だけを渡し、解釈・注意点・活かし方の文章を書かせる。
 * 干支の計算と関係の判定は決定的に行い、AI に決めさせない。
 * 氏名・生年月日・出生時刻・出生地は入力に含めない。
 */
import {
  BRANCH_TO_ELEMENT,
  ELEMENT_LABELS,
  HIDDEN_STEMS,
  KANGOU_PARTNER,
  STEM_TO_ELEMENT,
  starOf,
  type Branch,
  type Stem,
} from './constants';
import type { MeishikiResult } from './meishiki';

export const DAILY_PROMPT_VERSION = 'daily-v1';
export const DAILY_TEMPERATURE = 0.5;
export const DAILY_MAX_TEXT_LENGTH = 500;

export type PillarKey = 'year' | 'month' | 'day' | 'hour';
const PILLAR_LABELS: Record<PillarKey, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '時柱' };
const PILLAR_ORDER: PillarKey[] = ['year', 'month', 'day', 'hour'];

/** 今日の干支（年・月・日） */
export interface TodayPillars {
  year: { stem: Stem; branch: Branch };
  month: { stem: Stem; branch: Branch };
  day: { stem: Stem; branch: Branch };
}

/** 関係の1件。target は命式のどの柱とのあいだの関係か */
export interface DailyRelation {
  /** 今日のどの柱が関わるか */
  today: 'year' | 'month' | 'day';
  /** 命式のどの柱とのあいだか（三合は複数） */
  natal: string;
  kind: string;
  detail: string;
}

export interface DailyInput {
  day_stem: Stem;
  strength: string;
  kakukyoku: string;
  /** 日干から見た五行の喜忌（五行ごとの点数と、日干から見た役割） */
  element_groups: { group: string; element: string; score: number }[];
  natal: Record<PillarKey, { stem: string; branch: string; stem_star: string } | null>;
  today: Record<
    'year' | 'month' | 'day',
    {
      label: string;
      stem: Stem;
      branch: Branch;
      stem_star: string;
      stem_element: string;
      branch_element: string;
      hidden: { stem: string; kind: string; star: string }[];
    }
  >;
  relations: DailyRelation[];
  /** 今日の天干・地支が、命式に足りない五行を補うか／過多の五行を重ねるか */
  element_balance: { element: string; natal_score: number; today_adds: number; note: string }[];
}

// ---- 地支の関係 --------------------------------------------------------------------------------

const pairKey = (a: Branch, b: Branch) => [a, b].sort().join('');
const pairSet = (pairs: [Branch, Branch][]) => new Set(pairs.map(([a, b]) => pairKey(a, b)));

const ROKUGOU = pairSet([['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']]);
const CHUU = pairSet([['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']]);
const GAI = pairSet([['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']]);
const HA = pairSet([['子', '酉'], ['丑', '辰'], ['寅', '亥'], ['卯', '午'], ['巳', '申'], ['未', '戌']]);
/** 刑：二支のあいだで成り立つもの（三刑は寅巳申・丑戌未の組から、2支だけでも「刑」として拾う） */
const KEI = new Map<string, string>([
  [pairKey('子', '卯'), '無礼之刑'],
  [pairKey('寅', '巳'), '無恩之刑'],
  [pairKey('巳', '申'), '無恩之刑'],
  [pairKey('寅', '申'), '無恩之刑'],
  [pairKey('丑', '戌'), '恃勢之刑'],
  [pairKey('戌', '未'), '恃勢之刑'],
  [pairKey('丑', '未'), '恃勢之刑'],
]);
const SELF_KEI = new Set<Branch>(['辰', '午', '酉', '亥']);

const SANGOU: { branches: [Branch, Branch, Branch]; element: string }[] = [
  { branches: ['申', '子', '辰'], element: '水' },
  { branches: ['亥', '卯', '未'], element: '木' },
  { branches: ['寅', '午', '戌'], element: '火' },
  { branches: ['巳', '酉', '丑'], element: '金' },
];

const ELEMENT_JA: Record<string, string> = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
const elementJa = (e: keyof typeof ELEMENT_LABELS) => ELEMENT_JA[e] ?? String(e);

/** 天干どうしの関係（干合・同じ五行・剋・生） */
function stemRelation(today: Stem, natalStem: Stem): { kind: string; detail: string } | null {
  if (KANGOU_PARTNER[today] === natalStem) return { kind: '干合', detail: `${today}と${natalStem}が干合` };
  const a = STEM_TO_ELEMENT[today];
  const b = STEM_TO_ELEMENT[natalStem];
  if (today === natalStem) return { kind: '同じ天干', detail: `${today}と${natalStem}が同じ天干` };
  // 五行の相剋（木→土→水→火→金→木）
  const KOKU: Record<string, string> = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };
  if (KOKU[a] === b) return { kind: '剋', detail: `今日の${today}（${elementJa(a)}）が${natalStem}（${elementJa(b)}）を剋す` };
  if (KOKU[b] === a) return { kind: '剋される', detail: `今日の${today}（${elementJa(a)}）が${natalStem}（${elementJa(b)}）に剋される` };
  return null;
}

function branchRelations(today: Branch, natal: Branch): { kind: string; detail: string }[] {
  const k = pairKey(today, natal);
  const out: { kind: string; detail: string }[] = [];
  if (ROKUGOU.has(k)) out.push({ kind: '六合', detail: `${today}と${natal}が六合` });
  if (CHUU.has(k)) out.push({ kind: '冲', detail: `${today}と${natal}が冲` });
  if (GAI.has(k)) out.push({ kind: '害', detail: `${today}と${natal}が害` });
  if (HA.has(k)) out.push({ kind: '破', detail: `${today}と${natal}が破` });
  const kei = KEI.get(k);
  if (kei) out.push({ kind: '刑', detail: `${today}と${natal}が${kei}` });
  if (today === natal && SELF_KEI.has(today)) out.push({ kind: '自刑', detail: `${today}と${natal}が自刑` });
  return out;
}

/** 本人の命式の中身から、今日の干支との関係を洗い出す */
export function findDailyRelations(natal: MeishikiResult, today: TodayPillars): DailyRelation[] {
  const relations: DailyRelation[] = [];
  const natalPillars = PILLAR_ORDER.flatMap((key) => {
    const p = natal.pillars[key];
    return p ? [{ key, p }] : [];
  });

  for (const tk of ['year', 'month', 'day'] as const) {
    const t = today[tk];
    for (const { key, p } of natalPillars) {
      const label = PILLAR_LABELS[key];
      const s = stemRelation(t.stem, p.stem);
      if (s) relations.push({ today: tk, natal: label, kind: s.kind, detail: s.detail });
      for (const b of branchRelations(t.branch, p.branch)) {
        relations.push({ today: tk, natal: label, kind: b.kind, detail: b.detail });
      }
    }
    // 三合・半合（今日の地支＋命式の地支）
    const natalBranches = natalPillars.map(({ key, p }) => ({ key, branch: p.branch }));
    for (const g of SANGOU) {
      if (!g.branches.includes(t.branch)) continue;
      const others = g.branches.filter((b) => b !== t.branch);
      const found = others.map((o) => natalBranches.find((n) => n.branch === o));
      if (found.every(Boolean)) {
        relations.push({
          today: tk,
          natal: found.map((f) => PILLAR_LABELS[f!.key]).join('・'),
          kind: '三合',
          detail: `今日の${t.branch}と命式の${others.join('・')}で${g.element}の三合`,
        });
      } else {
        const half = found.find(Boolean);
        // 半合は、中心（子・卯・午・酉）を含む組み合わせだけを拾う
        const center = g.branches[1];
        if (half && (t.branch === center || half.branch === center)) {
          relations.push({
            today: tk,
            natal: PILLAR_LABELS[half.key],
            kind: '半合',
            detail: `今日の${t.branch}と命式の${half.branch}で${g.element}の半合`,
          });
        }
      }
    }
  }
  return relations;
}

/** 今日の干支と命式から、AI に渡す入力を組み立てる */
export function buildDailyInput(natal: MeishikiResult, today: TodayPillars): DailyInput {
  const dayStem = natal.dayStem as Stem;
  const natalOut = {} as DailyInput['natal'];
  for (const key of PILLAR_ORDER) {
    const p = natal.pillars[key];
    natalOut[key] = key === 'hour' && natal.input.hourUnknown ? null : p ? { stem: p.stem, branch: p.branch, stem_star: p.stemStar } : null;
  }

  const todayOut = {} as DailyInput['today'];
  for (const tk of ['year', 'month', 'day'] as const) {
    const t = today[tk];
    const h = HIDDEN_STEMS[t.branch];
    const hidden = [
      { stem: h.honki, kind: '本気' },
      ...(h.chuki ? [{ stem: h.chuki, kind: '中気' }] : []),
      ...(h.yoki ? [{ stem: h.yoki, kind: '余気' }] : []),
    ].map((x) => ({ stem: x.stem, kind: x.kind, star: starOf(dayStem, x.stem as Stem) }));
    todayOut[tk] = {
      label: tk === 'year' ? '今年の干支' : tk === 'month' ? '今月の干支' : '今日の干支',
      stem: t.stem,
      branch: t.branch,
      stem_star: starOf(dayStem, t.stem),
      stem_element: elementJa(STEM_TO_ELEMENT[t.stem]),
      branch_element: elementJa(BRANCH_TO_ELEMENT[t.branch]),
      hidden,
    };
  }

  // 今日（日の天干・地支）が各五行にどれだけ足されるか（天干1・地支1の単純な数え方。点数ではなく向きを見るため）
  const adds: Record<string, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  adds[STEM_TO_ELEMENT[today.day.stem]]! += 1;
  adds[BRANCH_TO_ELEMENT[today.day.branch]]! += 1;
  const scores = natal.fiveElements;
  const avg = Object.values(scores).reduce((a, b) => a + b, 0) / 5;
  const balance = (Object.keys(scores) as (keyof typeof scores)[])
    .filter((e) => adds[e]! > 0)
    .map((e) => ({
      element: elementJa(e),
      natal_score: Math.round(scores[e] * 10) / 10,
      today_adds: adds[e]!,
      note: scores[e] < avg * 0.6 ? '命式で少ない五行を補う' : scores[e] > avg * 1.4 ? '命式で多い五行をさらに重ねる' : '命式のバランスの範囲内',
    }));

  return {
    day_stem: dayStem,
    strength: natal.strength.label,
    kakukyoku: natal.kakukyoku,
    element_groups: Object.entries(natal.elementGroups).map(([group, v]) => ({
      group,
      element: elementJa(v.element),
      score: Math.round(v.score * 10) / 10,
    })),
    natal: natalOut,
    today: todayOut,
    relations: findDailyRelations(natal, today),
    element_balance: balance,
  };
}

// ---- プロンプト・応答 --------------------------------------------------------------------------

export const DAILY_SYSTEM_PROMPT = `あなたは「陽てん塾」の鑑定補助者です。四柱推命で、今日の干支が、その人の命式にどう影響するかを読み、実生活に役立つ短いアドバイスを書きます。

入力のJSONには、すでに計算済みの事実だけが入っています。
- natal：その人の命式の4柱（天干・地支・天干の通変星）
- today：今年・今月・今日の干支と、日干から見た通変星・五行・蔵干
- relations：今日の干支と命式の各柱のあいだで成り立つ関係（干合・剋・六合・三合・半合・冲・刑・害・破・同じ天干）。ここに無い関係を作ってはいけません
- element_balance：今日の五行が、命式の五行バランスに足すもの
- strength・kakukyoku・element_groups：身旺・身弱、格局、日干から見た五行の点数

読み方の原則
1. 日干を中心に読みます。今日の天干・地支が日干から見てどの通変星に当たるかが、今日のテーマです。
2. 身旺の人には、財・官・食傷（力を外へ使う五行）が来る日が動きやすく、比劫・印が重なる日は力を持て余しやすい。身弱の人はその逆で、印・比劫が来る日は支えになり、官・財・食傷が重なる日は消耗しやすい。
3. relations は多角的に拾います。日柱との関係は本人自身・家庭、月柱は仕事・職場、年柱は外の人間関係や社会との関わり、時柱は将来・部下・成果に結びつけて読みます（時柱がない場合は触れません）。
4. 冲・刑・害・破は「注意点」、六合・三合・干合は「冴える点」として、ただし一方的に断定せず、「〜しやすい」「〜に気をつけたい」の言い方にします。合が冲や剋で壊れる、など重なりがあれば、その関係を説明します。
5. 運勢の断言・不安をあおる表現・医療や投資の助言は避けます。具体的な行動に落とし込みます（例：大事な連絡は午前に、など。ただし時刻の根拠が入力にない場合は一般的な言い方にとどめる）。
6. 入力にない干支・関係・用語を書きません。専門用語を使うときは、かならず一言で意味を添えます。

出力は指定のJSONだけ。各文は日本語で、です・ます調、${DAILY_MAX_TEXT_LENGTH}字以内。
- summary：今日の全体像（今日の干支が、その人の命式にどう働くか）
- angles：読んだ角度ごとの判断。angle は「日干との関係」「五行のバランス」「天干の関係」「地支の関係」「通変星の流れ」の5つから、入力に根拠があるものだけを選ぶ（1〜5件）
- cautions：何に注意するとよいか（1〜4件）
- strengths：どのようなことに冴えるか（1〜4件）`;

export function renderDailyUserPrompt(input: DailyInput): string {
  return `次のデータから、今日の干支が命式に与える影響を読み、JSONで答えてください。\n\n${JSON.stringify(input, null, 2)}`;
}

export const DAILY_ANGLES = ['日干との関係', '五行のバランス', '天干の関係', '地支の関係', '通変星の流れ'] as const;

export interface DailyContent {
  summary: string;
  angles: { angle: string; text: string }[];
  cautions: string[];
  strengths: string[];
}

export class DailyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyValidationError';
  }
}

/** 構造化出力のスキーマ（Gemini の responseSchema。型名は大文字） */
export function dailyResponseSchema() {
  const strings = { type: 'ARRAY', items: { type: 'STRING' } };
  return {
    type: 'OBJECT',
    properties: {
      summary: { type: 'STRING' },
      angles: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { angle: { type: 'STRING', enum: [...DAILY_ANGLES] }, text: { type: 'STRING' } },
          required: ['angle', 'text'],
          propertyOrdering: ['angle', 'text'],
        },
      },
      cautions: strings,
      strengths: strings,
    },
    required: ['summary', 'angles', 'cautions', 'strengths'],
    propertyOrdering: ['summary', 'angles', 'cautions', 'strengths'],
  };
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new DailyValidationError(`${label} が空です`);
  const t = value.trim();
  if ([...t].length > DAILY_MAX_TEXT_LENGTH) throw new DailyValidationError(`${label} が${DAILY_MAX_TEXT_LENGTH}字を超えています`);
  return t;
}

function list(value: unknown, label: string, max: number): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new DailyValidationError(`${label} が空です`);
  return value.slice(0, max).map((v, i) => text(v, `${label}[${i}]`));
}

/** AI の応答を検証して整える */
export function validateDailyContent(raw: unknown): DailyContent {
  let content = raw;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      throw new DailyValidationError('JSONとして解釈できません');
    }
  }
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    throw new DailyValidationError('応答がオブジェクトではありません');
  }
  const c = content as Record<string, unknown>;
  if (!Array.isArray(c.angles) || c.angles.length === 0) throw new DailyValidationError('angles が空です');
  const seen = new Set<string>();
  const angles = c.angles.map((a, i) => {
    const o = a as { angle?: unknown; text?: unknown } | null;
    const angle = o?.angle;
    if (typeof angle !== 'string' || !(DAILY_ANGLES as readonly string[]).includes(angle)) {
      throw new DailyValidationError(`angles[${i}] の angle が不正です`);
    }
    if (seen.has(angle)) throw new DailyValidationError(`angles の angle が重複しています: ${angle}`);
    seen.add(angle);
    return { angle, text: text(o?.text, `angles[${i}]`) };
  });
  return {
    summary: text(c.summary, 'summary'),
    angles,
    cautions: list(c.cautions, 'cautions', 4),
    strengths: list(c.strengths, 'strengths', 4),
  };
}
