/**
 * 鑑定スキル表：現行の Python 版との比較、基準ケース・鑑定事例（現行のテストの期待値）
 * 現行のテスト: backend/apps/fortune/tests/test_skill_sheet.py、test_skill_rules.py
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { lastTermAtOrBefore, toMinutes } from '../src/calendar';
import {
  Dec,
  calculateMeishiki,
  calculateSkillSheet,
  getRank,
  loadDefaultRules,
  prefectureFromLegacyCity,
  skillSheetFromChart,
  type SkillChart,
  type SkillSheet,
} from '../src';

const scores = (sheet: SkillSheet) => Object.fromEntries(sheet.abilities.map((a) => [a.name, a.score]));
const jobs = (sheet: SkillSheet) => Object.fromEntries(sheet.jobs.map((j) => [j.name, [j.score, j.rank]]));

describe('基準ケース（現行 test_skill_sheet.py の期待値）', () => {
  const sheet = calculateSkillSheet(
    calculateMeishiki({ year: 1985, month: 5, day: 10, hour: 11, minute: 30, birthPlace: '21', gender: 'male' }),
  );

  it('五行グループ・通変星点数・身旺身弱', () => {
    expect(sheet.inputs.elementGroups).toEqual({ 比劫: 25, 印: 30, 食傷: 25, 財: 2.5, 官: 10 });
    expect(sheet.inputs.starPoints).toEqual({
      食神: 35, 偏印: 20, 傷官: 15, 偏官: 10, 比肩: 10, 印綬: 10, 劫財: 5, 偏財: 5, 正官: 0, 正財: 0,
    });
    expect(sheet.strength).toEqual({ label: '身旺', diff: 17.5 });
    expect(sheet.kakukyoku).toBe('傷官格');
    expect(sheet.isReference).toBe(false);
  });

  it('能力と職種', () => {
    expect(scores(sheet)).toEqual({ 企画: 90, 知略: 82, 実行: 80, 体力: 85, 人望: 65, 統率: 50, 開拓: 50, 商才: 35, 管理: 25 });
    expect(jobs(sheet)).toEqual({
      教官: [86, 'S'], 軍師: [82, 'A+'], 専門職: [81, 'A+'], 現場L: [65, 'B'], 営業: [63, 'B-'], 将軍: [58, 'C+'], 総務: [29, 'D'],
    });
  });

  it('内訳の合計が点数になる', () => {
    for (const a of sheet.abilities) {
      const total = Dec.sum(a.breakdown.map((b) => Dec.from(b.value))).roundHalfUp();
      expect(Math.max(0, Math.min(100, total))).toBe(a.score);
    }
  });
});

const chart = (y: string, m: string, d: string, h: string, fe: SkillChart['fiveElements'], kakukyoku: string): SkillChart => {
  const p = (gz: string) => ({ stem: gz[0], branch: gz[1] }) as SkillChart['pillars']['day'];
  return { pillars: { year: p(y), month: p(m), day: p(d), hour: p(h) }, fiveElements: fe, kakukyoku };
};

describe('鑑定事例（現行 test_skill_rules.py の期待値）', () => {
  it('事例O：癸・身弱・偏官格 → 身弱殺重・体力の補正', () => {
    const sheet = skillSheetFromChart(
      chart('庚戌', '己丑', '癸卯', '己未', { wood: 12.5, fire: 5, earth: 100, metal: 20, water: 7.5 }, '偏官格'),
    );
    expect(sheet.strength.label).toBe('身弱');
    const s = scores(sheet);
    expect([s.統率, s.体力, s.実行, s.管理]).toEqual([45, 42, 36, 60]);
    const effects = Object.fromEntries(sheet.appliedRules.map((r) => [r.title, r.effects]));
    expect(effects['身弱で官が重い（身弱殺重）']).toEqual({ 統率: -115, 開拓: -20, 管理: 25 });
    expect(sheet.appliedRules.map((r) => r.title)).toContain('身弱による体力・持続力の補正');
  });

  it('事例S：庚・身旺・印綬格 → 財印相剋・官が弱い', () => {
    const sheet = skillSheetFromChart(
      chart('甲寅', '辛未', '庚申', '己卯', { wood: 45, fire: 5, earth: 60, metal: 30, water: 1.25 }, '印綬格'),
    );
    expect(sheet.strength.label).toBe('身旺');
    const s = scores(sheet);
    expect([s.商才, s.管理, s.統率, s.知略, s.体力]).toEqual([71, 35, 40, 100, 100]);
    expect(sheet.appliedRules.map((r) => r.title)).toEqual(
      expect.arrayContaining(['財と印がともに強い（財印相剋）', '官が弱い']),
    );
  });
});

describe('ランクと四捨五入', () => {
  it('ランク帯', () => {
    expect([85, 84, 80, 75, 70, 65, 60, 55, 50, 45, 44].map(getRank)).toEqual([
      'S', 'A+', 'A+', 'A', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D',
    ]);
  });
  it('四捨五入は0.5を切り上げ、小数の誤差に左右されない', () => {
    expect([57.5, 62.5, 2.5, 81.8, 81.4].map((v) => Dec.from(v).roundHalfUp())).toEqual([58, 63, 3, 82, 81]);
    // 0.6 × 12.5 = 7.5（number では 7.499999… になり得る）
    expect(Dec.from('0.6').mul(Dec.from(12.5)).toString()).toBe('7.5');
  });
});

// ---------------------------------------------------------------------------

interface LegacySkillCase {
  in: [number, number, number, number | null, number | null, string, 'male' | 'female'];
  adj: [number, number, number, number, number];
  ab: [number, [string, number][]][];
  jb: [number, string][];
  ru: [string, string, string, Record<string, number>][];
  sp: Record<string, number>;
}

const fixture = JSON.parse(
  gunzipSync(readFileSync(new URL('./fixtures/legacy-skill.json.gz', import.meta.url))).toString('utf8'),
) as { rulesVersion: string; cases: LegacySkillCase[] };

describe('現行の Python 版との比較（鑑定スキル表）', () => {
  it('比較用データと同じ解釈ルールの版である', () => {
    // 違う場合は、rules/skill_rules.toml を現行版と同じにするか、比較用データを作り直す（README 参照）
    expect(loadDefaultRules().fingerprint).toBe(fixture.rulesVersion);
  });

  it(`${fixture.cases.length}件の点数・内訳・職種・適用ルールが一致する（意図的な変更を除く）`, () => {
    const mismatches: string[] = [];
    let compared = 0;
    for (const c of fixture.cases) {
      const [year, month, day, hour, minute, city, gender] = c.in;
      const [ay, am, ad, ah, ami] = c.adj;
      const adjMinutes = toMinutes({ year: ay, month: am, day: ad, hour: ah, minute: ami });
      // 現行の不具合に当たるケースは比較しない（legacy-parity.test.ts と同じ基準）
      if (hour === null) {
        const midnight = toMinutes({ year, month, day, hour: 0, minute: 0 });
        if (ay !== year || am !== month || ad !== day || lastTermAtOrBefore(midnight) !== lastTermAtOrBefore(adjMinutes)) continue;
      }
      if (lastTermAtOrBefore(adjMinutes)?.dataYear !== ay) continue;

      const sheet = calculateSkillSheet(
        calculateMeishiki({
          year, month, day,
          hour: hour ?? undefined,
          minute: minute ?? undefined,
          hourUnknown: hour === null,
          birthPlace: prefectureFromLegacyCity(city).code,
          gender,
        }),
      );
      compared += 1;
      const actual = {
        ab: sheet.abilities.map((a) => [a.score, a.breakdown.map((b) => [b.factor, b.value])]),
        jb: sheet.jobs.map((j) => [j.score, j.rank]),
        ru: sheet.appliedRules.map((r) => [r.id, r.title, r.interpretation, r.effects]),
        sp: sheet.inputs.starPoints,
      };
      for (const key of ['ab', 'jb', 'ru', 'sp'] as const) {
        const a = JSON.stringify(actual[key]);
        const e = JSON.stringify(key === 'sp' ? Object.fromEntries(Object.keys(sheet.inputs.starPoints).map((s) => [s, c.sp[s]])) : c[key]);
        if (a !== e) mismatches.push(`${c.in.join(' ')} ${key}\n  期待 ${e}\n  実際 ${a}`);
      }
    }
    console.info('鑑定スキル表の比較', compared, '件');
    expect(mismatches.slice(0, 10)).toEqual([]);
    expect(compared).toBeGreaterThan(2800);
  });
});
