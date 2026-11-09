/**
 * 解釈ルール設定（rules/skill_rules.toml）の読み込み・書式チェック・判定
 * 現行のテスト: backend/apps/fortune/tests/test_skill_rules.py
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  Dec,
  RulesConfigError,
  STEMS,
  adjustmentAmount,
  elementRelations,
  evaluateRules,
  formatInterpretation,
  loadDefaultRules,
  matches,
  parseRules,
  type RuleContext,
} from '../src';
import { SKILL_RULES_TOML } from '../src/rules.generated';

const MINIMAL_ROLES = `
[strength_roles."身旺"]
"比劫" = "忌"
"印" = "忌"
"食傷" = "喜"
"財" = "喜"
"官" = "中"
[strength_roles."身弱"]
"比劫" = "喜"
"印" = "喜"
"食傷" = "忌"
"財" = "忌"
"官" = "中"
[strength_roles."中和"]
"比劫" = "中"
"印" = "中"
"食傷" = "中"
"財" = "中"
"官" = "中"
`;

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('設定ファイル', () => {
  it('同梱の解釈ルールが正しく読める', () => {
    const rules = loadDefaultRules();
    expect(rules.version).toBeTruthy();
    expect(rules.principles.length).toBeGreaterThan(0);
    expect(Object.keys(rules.dayStems).sort()).toEqual([...STEMS].sort());
    expect(rules.rules.map((r) => r.id)).toContain('mijaku_kan_heavy');
  });

  it('src/rules.generated.ts が rules/skill_rules.toml と同じ（書き出し忘れの検出）', () => {
    // 違う場合は pnpm --filter @yoten/meishiki generate:rules を実行する
    expect(SKILL_RULES_TOML).toBe(readText('../rules/skill_rules.toml'));
  });

  it('現行版（backend）の解釈ルールと同じ（切り替えまでの間、両方を同じ内容に保つ）', () => {
    // 違う場合は、どちらかを書き換えてそろえる。現行版の削除後はこのテストを消す
    expect(readText('../rules/skill_rules.toml')).toBe(readText('../../../backend/apps/fortune/rules/skill_rules.toml'));
  });

  it('内容が変わると版（fingerprint）が変わる', () => {
    const a = parseRules('version = "x"\n' + MINIMAL_ROLES);
    const b = parseRules('version = "x"\nprinciples = ["追加"]\n' + MINIMAL_ROLES);
    expect(a.fingerprint).not.toBe(b.fingerprint);
    expect(a.fingerprint.startsWith('x-')).toBe(true);
  });

  it.each([
    ['不明な条件', '[[rules]]\nid = "a"\ntitle = "A"\nwhen = { foo = 1 }\n'],
    ['五行グループ名が不正', '[[rules]]\nid = "a"\ntitle = "A"\nwhen = { group_below = { "火" = 1 } }\n'],
    ['ability が不正', '[[rules]]\nid = "a"\ntitle = "A"\nadjust = [{ ability = "x", value = 1 }]\n'],
    ['per に使えない名前', '[[rules]]\nid = "a"\ntitle = "A"\nadjust = [{ ability = "kanri", value = 1, per = "火" }]\n'],
    ['差し込み名', '[[rules]]\nid = "a"\ntitle = "A"\ninterpretation = "{名前}"\n'],
    ['id が重複', '[[rules]]\nid = "a"\ntitle = "A"\n[[rules]]\nid = "a"\ntitle = "B"\n'],
    ['TOMLの書式', '[[rules]\n'],
  ])('書式の誤りを、どのルールかとともに知らせる：%s', (message, rules) => {
    expect(() => parseRules(MINIMAL_ROLES + rules)).toThrow(RulesConfigError);
    expect(() => parseRules(MINIMAL_ROLES + rules)).toThrow(message);
  });

  it('strength_roles は必須', () => {
    expect(() => parseRules('version = "x"\n')).toThrow('strength_roles');
  });
});

describe('判定', () => {
  const ctx = (patch: Partial<RuleContext> = {}): RuleContext => ({
    dayStem: '癸',
    strengthLabel: '身弱',
    strengthDiff: -90,
    elementGroups: { 比劫: 7.5, 印: 20, 食傷: 12.5, 財: 5, 官: 100 },
    starPoints: { 比肩: 0, 劫財: 0, 食神: 0, 傷官: 0, 偏財: 0, 正財: 0, 偏官: 40, 正官: 10, 偏印: 0, 印綬: 0 },
    kakukyoku: '',
    stemStars: [],
    ...patch,
  });

  it('条件', () => {
    const c = ctx();
    expect(matches({ strength: ['身弱'], top_group: '官' }, c)).toBe(true);
    expect(matches({ strength: ['身旺'] }, c)).toBe(false);
    expect(matches({ day_element: ['水'], day_stem: ['癸'] }, c)).toBe(true);
    expect(matches({ group_at_least: { 官: 100 }, group_below: { 財: 5.1 } }, c)).toBe(true);
    expect(matches({ group_below: { 財: 5 } }, c)).toBe(false);
    expect(matches({ group_rank_within: { 印: 2 } }, c)).toBe(true);
    expect(matches({ strength_diff_below: -50 }, c)).toBe(true);
    expect(matches({ strength_diff_at_least: 0 }, c)).toBe(false);
    expect(matches({ kakukyoku_any: ['偏官格'] }, c)).toBe(false);
    expect(matches({ kakukyoku_any: ['偏官格'] }, ctx({ kakukyoku: '偏官格' }))).toBe(true);
    expect(matches({ stem_stars: [['傷官'], ['正官', '偏官']] }, ctx({ stemStars: ['傷官', '偏官'] }))).toBe(true);
    expect(matches({ stem_stars: [['傷官'], ['正官', '偏官']] }, ctx({ stemStars: ['傷官'] }))).toBe(false);
  });

  it('補正量（per・min・max）', () => {
    const c = ctx();
    const adj = (value: string, per: string[] = [], min: string | null = null, max: string | null = null) => ({
      ability: 'kanri' as const,
      value: Dec.from(value),
      per,
      min: min === null ? null : Dec.from(min),
      max: max === null ? null : Dec.from(max),
    });
    expect(adjustmentAmount(adj('-10'), c).toString()).toBe('-10');
    expect(adjustmentAmount(adj('-1.0', ['官']), c).toString()).toBe('-100');
    expect(adjustmentAmount(adj('-0.3', ['正官', '偏官']), c).toString()).toBe('-15');
    expect(adjustmentAmount(adj('0.3', ['官'], null, '25'), c).toString()).toBe('25');
    expect(adjustmentAmount(adj('0.3', ['身旺度'], '-20'), c).toString()).toBe('-20');
  });

  it('解釈の差し込み', () => {
    expect(formatInterpretation('官 {官}・身旺度 {身旺度}・{日干}・{{そのまま}}', ctx())).toBe('官 100・身旺度 -90・癸・{そのまま}');
  });

  it('日干の adjust は最初に適用される', () => {
    const ruleset = parseRules(MINIMAL_ROLES + '[day_stems."癸"]\nnature = "雨"\nadjust = [{ ability = "jinbou", value = 5 }]\n');
    const applied = evaluateRules(ctx(), ruleset);
    expect(applied[0]?.id).toBe('day_stem_癸');
    expect(applied[0]?.adjustments.map((a) => [a.ability, a.value.toString()])).toEqual([['jinbou', '5']]);
  });

  it('日干から見た五行の関係と喜忌', () => {
    const relations = Object.fromEntries(
      elementRelations('癸', { 比劫: 7.5, 印: 20, 食傷: 12.5, 財: 5, 官: 100 }, '身弱').map((r) => [r.group, r]),
    );
    expect(Object.fromEntries(Object.entries(relations).map(([g, r]) => [g, r.element]))).toEqual({
      比劫: '水', 印: '金', 食傷: '木', 財: '火', 官: '土',
    });
    expect(relations.官?.rank).toBe(1);
    expect(relations.印?.role).toBe('喜');
    expect(relations.財?.role).toBe('忌');
  });
});
