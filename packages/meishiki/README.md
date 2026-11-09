# @yoten/meishiki（新版の計算ロジック）

四柱推命の命式（四柱・蔵干・通変星・五行バランス・身旺身弱・格局・干合・大運）と、鑑定スキル表（解釈ルールの補正を含む）を計算する TypeScript のパッケージです。画面から独立していて、単体でテストできます。

- 仕様：[新仕様書/付録A_鑑定ロジック仕様.md](../../新仕様書/付録A_鑑定ロジック仕様.md)
- 現行の Python 版：`backend/apps/fortune/calculators.py`

```ts
import { calculateMeishiki } from '@yoten/meishiki';

const r = calculateMeishiki({
  year: 1985, month: 5, day: 10, hour: 11, minute: 30,
  birthPlace: '21', // 都道府県コード（岐阜県）
  gender: 'male',
});
r.pillars.day; // { stem: '己', branch: '酉', stemStar: '比肩', hidden: {...}, hiddenStars: {...} }

const sheet = calculateSkillSheet(r);
sheet.abilities; // 9能力の点数と内訳
sheet.jobs;      // 7職種の点数とランク
sheet.appliedRules; // 適用された解釈ルール（判定の要点の入力に使う）
```

## 解釈ルール（rules/skill_rules.toml）

書き方は [doc/解釈ルール設定.md](../../doc/解釈ルール設定.md) のとおりです（現行版と同じ書式）。

- サーバーレス環境では実行時にファイルを読まないため、`src/rules.generated.ts` に文字列として書き出してビルドに同梱します。**書き換えたら次のコマンドを実行してください。** 実行し忘れると、テストが失敗して知らせます。

  ```bash
  pnpm --filter @yoten/meishiki generate:rules
  ```

- 現行版から切り替えるまでの間は、現行版の `backend/apps/fortune/rules/skill_rules.toml` と同じ内容に保ちます（違うとテストが失敗します）。
- 点数の計算は、小数の誤差が出ないよう10進数で行います（`src/decimal.ts`。現行の Python の Decimal と同じ結果）。

## 現行版からの意図的な変更

付録B の不具合を直しています。

- 1月1日〜小寒前の月柱：前年12月（大雪）の月柱を使う
- 時間不明：時刻の補正をしない（日柱が前日にずれない）
- 節入りデータで決められない日時（1901年1月初めなど）はエラーにする
- 大運：立運0歳のときの「0〜−1歳」の運を出さない。翌年の節入りデータがなければ null
- 身旺身弱（同点は「中和」）と干合も、このパッケージで計算する

お手本サイトとの照合（[付録D](../../新仕様書/付録D_正解データ用テストケース.md)）の結果に合わせられるよう、次のオプションがあります。

| オプション | 既定 | 内容 |
|---|---|---|
| `longitudeCorrection` | true | 経度差による補正 |
| `equationOfTimeCorrection` | true | 均時差による補正 |
| `lateNightRule` | `'sameDay'` | 23時台を当日（`sameDay`）・翌日（`nextDay`）のどちらの日柱にするか |

## テスト

```bash
pnpm test        # vitest
pnpm typecheck   # tsc
```

- `test/legacy-parity.test.ts`：現行の Python 版で計算した 11,395 件（全節入りの前後と乱数の日時）と比べる。意図的な変更に当たるケースを除き、すべて一致すること。
- `test/meishiki.test.ts`：基準ケース、不具合の修正、オプション、入力チェック。
- `test/skill-sheet.test.ts`：現行の Python 版で計算した鑑定スキル表 3,001 件と、点数・内訳・職種・適用ルール・解釈の文面まで比べる。基準ケースと鑑定事例（Sさん・Oさん）の期待値も現行のテストから引き継ぐ。
- `test/skill-rules.test.ts`：解釈ルールの書式チェックと判定。

比較用データは、現行版が動いている環境で次のコマンドで作り直せます（リポジトリのルートで）。

```bash
docker compose exec -T backend python - < packages/meishiki/scripts/export_legacy_fixtures.py \
  | gzip -9 > packages/meishiki/test/fixtures/legacy.json.gz
docker compose exec -T backend python - < packages/meishiki/scripts/export_legacy_skill_fixtures.py \
  | gzip -9 > packages/meishiki/test/fixtures/legacy-skill.json.gz
```

解釈ルールを書き換えたら、鑑定スキル表の比較用データ（`legacy-skill.json.gz`）も作り直してください（版が違うとテストが知らせます）。

## 今後移植するもの

- 奇門遁甲（管理者のみ）
