/**
 * 鑑定スキル表（現代ビジネス版）alpha-2
 *
 * 命式（通変星・五行バランス・身旺身弱・格局）から、9つの能力値と7つの職種ランクを出す。
 * 現行: backend/apps/fortune/skill_sheet.py
 * 説明書: doc/鑑定スキル表.md、仕様: 新仕様書/付録A_鑑定ロジック仕様.md A.9
 */
import {
  ELEMENT_GROUPS,
  HIDDEN_STEMS,
  STARS,
  starOf,
  type Branch,
  type Element,
  type ElementGroup,
  type Star,
  type Stem,
} from './constants';
import { Dec } from './decimal';
import { elementGroupsOf, type MeishikiResult } from './meishiki';
import {
  evaluateRules,
  loadDefaultRules,
  type AbilityKey,
  type AppliedRule,
  type RuleSet,
  type StrengthLabel,
} from './skillRules';

export const SKILL_SHEET_VERSION = 'alpha-2';

export const ABILITIES: readonly { key: AbilityKey; name: string; meaning: string }[] = [
  { key: 'kikaku', name: '企画', meaning: 'ゼロから構想を描く' },
  { key: 'chiryaku', name: '知略', meaning: '情報を整理し本質を見抜く' },
  { key: 'jikkou', name: '実行', meaning: '決めたことを形にしてやり切る' },
  { key: 'tairyoku', name: '体力', meaning: '長く集中して動き続ける' },
  { key: 'jinbou', name: '人望', meaning: '人に頼られ、集まってもらえる' },
  { key: 'touritsu', name: '統率', meaning: 'チームを率いて動かす' },
  { key: 'kaitaku', name: '開拓', meaning: '新しい市場や関係に切り込む' },
  { key: 'shousai', name: '商才', meaning: '値付け・集金・稼ぐ仕組みづくり' },
  { key: 'kanri', name: '管理', meaning: '経理・期限・規程・書類' },
];

export type JobKey = 'shogun' | 'gunshi' | 'kyoukan' | 'senmon' | 'eigyou' | 'genba' | 'soumu';

export const JOBS: readonly { key: JobKey; name: string; meaning: string }[] = [
  { key: 'shogun', name: '将軍', meaning: '方針を決め、責任を取る経営者' },
  { key: 'gunshi', name: '軍師', meaning: '選択肢と勝ち筋を設計する参謀' },
  { key: 'kyoukan', name: '教官', meaning: '学びを設計し、人を育てる' },
  { key: 'senmon', name: '専門職', meaning: '専門技術で価値を届ける' },
  { key: 'eigyou', name: '営業', meaning: '新規顧客や提携先を開拓する' },
  { key: 'genba', name: '現場L', meaning: '現場のチームを堅実に回す' },
  { key: 'soumu', name: '総務', meaning: 'お金と運営の裏方を支える' },
];

const BASE_POINTS: Record<AbilityKey, number> = {
  kikaku: 30,
  chiryaku: 37,
  jikkou: 45,
  tairyoku: 52,
  jinbou: 40,
  touritsu: 30,
  kaitaku: 35,
  shousai: 30,
  kanri: 25,
};

const STRENGTH_BONUS: Partial<Record<AbilityKey, Record<StrengthLabel, number>>> = {
  jikkou: { 身旺: 10, 身弱: -10, 中和: 0 },
  touritsu: { 身旺: 5, 身弱: -5, 中和: 0 },
};

const KAKU_BONUS_POINTS = 10;
const KAKU_BONUS_TARGETS: Partial<Record<AbilityKey, string[]>> = {
  kikaku: ['食神格', '傷官格'],
  chiryaku: ['偏印格', '印綬格'],
  touritsu: ['正官格', '偏官格'],
  shousai: ['正財格', '偏財格'],
};

export const JOB_WEIGHTS: Record<JobKey, Partial<Record<AbilityKey, number>>> = {
  shogun: { touritsu: 0.3, tairyoku: 0.3, kaitaku: 0.2, shousai: 0.2 },
  gunshi: { chiryaku: 0.4, kikaku: 0.4, jinbou: 0.2 },
  kyoukan: { kikaku: 0.5, chiryaku: 0.5 },
  senmon: { jikkou: 0.5, chiryaku: 0.5 },
  eigyou: { kaitaku: 0.4, jinbou: 0.4, tairyoku: 0.2 },
  genba: { touritsu: 0.4, tairyoku: 0.3, jinbou: 0.3 },
  soumu: { kanri: 0.6, shousai: 0.4 },
};

const RANK_BANDS: readonly [number, string][] = [
  [85, 'S'],
  [80, 'A+'],
  [75, 'A'],
  [70, 'B+'],
  [65, 'B'],
  [60, 'B-'],
  [55, 'C+'],
  [50, 'C'],
  [45, 'C-'],
];
const RANK_LOWEST = 'D';

const STAR_WEIGHT_HEAVENLY = 10;
const STAR_WEIGHT_HONKI = 10;
const STAR_WEIGHT_CHUKI = 5;
const STAR_WEIGHT_YOKI = 5;
const STAR_HONKI_20_BRANCHES = new Set(['子', '卯', '酉', '午']);
const STAR_CHUKI_ZERO_BRANCHES = new Set(['午']);

export interface BreakdownItem {
  factor: string;
  value: number;
}

export interface SkillSheet {
  version: string;
  /** 時間不明のときは参考値 */
  isReference: boolean;
  strength: { label: StrengthLabel; diff: number };
  kakukyoku: string;
  abilities: { key: AbilityKey; name: string; meaning: string; score: number; breakdown: BreakdownItem[] }[];
  jobs: { key: JobKey; name: string; meaning: string; score: number; rank: string; weights: Record<string, number> }[];
  appliedRules: { id: string; title: string; interpretation: string; effects: Record<string, number> }[];
  /** 解釈ルールの版（判定の要点の入力に含める） */
  rulesVersion: string;
  inputs: { elementGroups: Record<ElementGroup, number>; starPoints: Record<Star, number> };
}

export function getRank(score: number): string {
  for (const [lower, rank] of RANK_BANDS) {
    if (score >= lower) return rank;
  }
  return RANK_LOWEST;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** スキル表の計算に必要な命式の要素（時間不明なら hour は null） */
export interface SkillChart {
  pillars: Record<'year' | 'month' | 'day', { stem: Stem; branch: Branch }> & {
    hour: { stem: Stem; branch: Branch } | null;
  };
  fiveElements: Record<Element, number>;
  kakukyoku: string;
}

/** 通変星点数 P（日干そのものは含めない。時間不明なら時柱を除く） */
export function starPointsOf(pillars: SkillChart['pillars'], dayStem: Stem): Record<Star, number> {
  const points = Object.fromEntries(STARS.map((s) => [s, 0])) as Record<Star, number>;
  const add = (stem: Stem | null, weight: number) => {
    if (!stem || weight === 0) return;
    points[starOf(dayStem, stem)] += weight;
  };
  const entries: [string, { stem: Stem; branch: Branch } | null][] = [
    ['year', pillars.year],
    ['month', pillars.month],
    ['day', pillars.day],
    ['hour', pillars.hour],
  ];
  for (const [key, pillar] of entries) {
    if (!pillar) continue;
    if (key !== 'day') add(pillar.stem, STAR_WEIGHT_HEAVENLY);
    const hidden = HIDDEN_STEMS[pillar.branch];
    add(hidden.honki, STAR_HONKI_20_BRANCHES.has(pillar.branch) ? 20 : STAR_WEIGHT_HONKI);
    add(hidden.chuki, STAR_CHUKI_ZERO_BRANCHES.has(pillar.branch) ? 0 : STAR_WEIGHT_CHUKI);
    add(hidden.yoki, STAR_WEIGHT_YOKI);
  }
  return points;
}

/** 天干（日干を除く）の通変星 */
export function stemStarsOf(pillars: SkillChart['pillars'], dayStem: Stem): Star[] {
  return [pillars.year, pillars.month, pillars.hour]
    .filter((p): p is { stem: Stem; branch: Branch } => p !== null)
    .map((p) => starOf(dayStem, p.stem));
}

interface DecItem {
  factor: string;
  value: Dec;
}

function abilityBreakdowns(
  e: Record<ElementGroup, number>,
  p: Record<Star, number>,
  strengthLabel: StrengthLabel,
  kakukyoku: string,
): Record<AbilityKey, DecItem[]> {
  const E = Object.fromEntries(ELEMENT_GROUPS.map((g) => [g, Dec.from(e[g])])) as Record<ElementGroup, Dec>;
  const P = Object.fromEntries(STARS.map((s) => [s, Dec.from(p[s])])) as Record<Star, Dec>;
  const half = Dec.from('0.5');
  const terms: Record<AbilityKey, [string, Dec][]> = {
    kikaku: [
      ['食傷の五行', E.食傷],
      ['食神・傷官の星', half.mul(P.食神.add(P.傷官))],
    ],
    chiryaku: [
      ['印の五行', E.印],
      ['偏印・印綬の星', half.mul(P.偏印.add(P.印綬))],
    ],
    jikkou: [
      ['食傷の五行', half.mul(E.食傷)],
      ['比劫の五行', half.mul(E.比劫)],
    ],
    tairyoku: [['比劫・印の五行', Dec.from('0.6').mul(E.比劫.add(E.印))]],
    jinbou: [['比肩・食神・偏財の星', half.mul(P.比肩.add(P.食神).add(P.偏財))]],
    touritsu: [
      ['官の五行', E.官],
      ['正官・偏官の星', half.mul(P.正官.add(P.偏官))],
    ],
    kaitaku: [
      ['偏官の星', P.偏官],
      ['劫財の星', P.劫財],
    ],
    shousai: [
      ['財の五行', E.財],
      ['正財・偏財の星', half.mul(P.正財.add(P.偏財))],
    ],
    kanri: [
      ['正官の星', P.正官],
      ['正財の星', P.正財],
    ],
  };

  const result = {} as Record<AbilityKey, DecItem[]>;
  for (const { key } of ABILITIES) {
    const items: DecItem[] = [{ factor: '基礎点', value: Dec.from(BASE_POINTS[key]) }];
    items.push(...terms[key].map(([factor, value]) => ({ factor, value })));
    const strengthBonus = STRENGTH_BONUS[key]?.[strengthLabel] ?? 0;
    if (strengthBonus) items.push({ factor: `${strengthLabel}による補正`, value: Dec.from(strengthBonus) });
    const matched = (KAKU_BONUS_TARGETS[key] ?? []).filter((t) => kakukyoku && kakukyoku.includes(t));
    if (matched.length) items.push({ factor: matched.join('・'), value: Dec.from(KAKU_BONUS_POINTS) });
    result[key] = items;
  }
  return result;
}

function sumEffects(rule: AppliedRule): Record<string, number> {
  const names = Object.fromEntries(ABILITIES.map((a) => [a.key, a.name])) as Record<AbilityKey, string>;
  const effects = new Map<string, Dec>();
  for (const adj of rule.adjustments) {
    if (adj.value.isZero()) continue;
    const name = names[adj.ability];
    effects.set(name, (effects.get(name) ?? Dec.ZERO).add(adj.value));
  }
  return Object.fromEntries([...effects].map(([name, value]) => [name, value.toNumber()]));
}

/** 鑑定スキル表を出す（解釈ルールの補正を含む） */
export function calculateSkillSheet(meishiki: MeishikiResult, ruleset: RuleSet = loadDefaultRules()): SkillSheet {
  return skillSheetFromChart(meishiki, ruleset);
}

/** 命式の要素から鑑定スキル表を出す（鑑定事例のテストなど、命式を直接与えるとき用） */
export function skillSheetFromChart(chart: SkillChart, ruleset: RuleSet = loadDefaultRules()): SkillSheet {
  const { pillars, kakukyoku } = chart;
  const dayStem = pillars.day.stem;
  const groupElements = elementGroupsOf(dayStem);
  const elementGroups = Object.fromEntries(
    ELEMENT_GROUPS.map((g) => [g, chart.fiveElements[groupElements[g]] ?? 0]),
  ) as Record<ElementGroup, number>;
  const starPoints = starPointsOf(pillars, dayStem);
  const diff = Dec.sum([Dec.from(elementGroups.比劫), Dec.from(elementGroups.印)])
    .sub(Dec.sum([Dec.from(elementGroups.食傷), Dec.from(elementGroups.財), Dec.from(elementGroups.官)]))
    .toNumber();
  const strength: { label: StrengthLabel; diff: number } = {
    label: diff > 0 ? '身旺' : diff < 0 ? '身弱' : '中和',
    diff,
  };

  const breakdowns = abilityBreakdowns(elementGroups, starPoints, strength.label, kakukyoku);
  const applied = evaluateRules(
    {
      dayStem,
      strengthLabel: strength.label,
      strengthDiff: strength.diff,
      elementGroups,
      starPoints,
      kakukyoku,
      stemStars: stemStarsOf(pillars, dayStem),
    },
    ruleset,
  );
  for (const rule of applied) {
    for (const adj of rule.adjustments) {
      if (!adj.value.isZero()) breakdowns[adj.ability].push({ factor: rule.title, value: adj.value });
    }
  }

  const abilityScores = Object.fromEntries(
    ABILITIES.map(({ key }) => [key, clamp(Dec.sum(breakdowns[key].map((i) => i.value)).roundHalfUp())]),
  ) as Record<AbilityKey, number>;
  const abilityNames = Object.fromEntries(ABILITIES.map((a) => [a.key, a.name])) as Record<AbilityKey, string>;

  return {
    version: SKILL_SHEET_VERSION,
    isReference: pillars.hour === null,
    strength: { label: strength.label, diff: strength.diff },
    kakukyoku,
    abilities: ABILITIES.map((a) => ({
      ...a,
      score: abilityScores[a.key],
      breakdown: breakdowns[a.key].map((i) => ({ factor: i.factor, value: i.value.toNumber() })),
    })),
    jobs: JOBS.map((job) => {
      const weights = JOB_WEIGHTS[job.key];
      const score = Dec.sum(
        (Object.entries(weights) as [AbilityKey, number][]).map(([k, w]) => Dec.from(w).mul(Dec.from(abilityScores[k]))),
      ).roundHalfUp();
      return {
        ...job,
        score,
        rank: getRank(score),
        weights: Object.fromEntries(
          (Object.entries(weights) as [AbilityKey, number][]).map(([k, w]) => [abilityNames[k], w]),
        ),
      };
    }),
    appliedRules: applied.map((rule) => ({
      id: rule.id,
      title: rule.title,
      interpretation: rule.interpretation,
      effects: sumEffects(rule),
    })),
    rulesVersion: ruleset.fingerprint,
    inputs: { elementGroups, starPoints },
  };
}
