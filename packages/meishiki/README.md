# @yoten/meishiki（新版の計算ロジック）

四柱推命の命式（四柱・蔵干・通変星・五行バランス・身旺身弱・格局・干合・大運）と、鑑定スキル表（解釈ルールの補正を含む）、奇門遁甲の盤を計算する TypeScript のパッケージです。画面から独立していて、単体でテストできます。

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

## 奇門遁甲（管理者向け）

時盤・日盤の作盤（地盤干・天盤干・八門・九星・八神・点数・凶格・五不遇時）を計算します（`src/kimon.ts`・`src/kimonBoard.ts`・`src/kimonData.ts`）。

```ts
import { calculateKimonTonkou, calculateKimonDay, PALACE_GRID_ORDER } from '@yoten/meishiki';

const r = calculateKimonTonkou({ type: '時盤', year: 2026, month: 5, day: 6, hour: 5, minute: 0, place: '13' });
r.pillars;            // 年・月・日・時の干支（時盤は経度差・均時差で補正した自然時で出す）
r.yinYang; r.kyokusu; // 陽, 4（局数データから。yinYang・kyokusu を両方渡せば指定もできる）
r.palaces;            // 9宮（位置1〜9の順）。表示の並びは PALACE_GRID_ORDER（4 9 2 / 3 5 7 / 8 1 6）

calculateKimonTonkou({ type: '日盤', year: 2026, month: 5, day: 6 }); // 日盤（時刻・場所は使わない）
calculateKimonDay({ year: 2026, month: 5, day: 6, place: '13' });     // 1日分の時盤（0,2,…,22時の12枚）
```

- 局数データ（`data/kimon/kyokusu.csv`）は **2026年分だけ** です。データのない日は `KimonInputError`（`code: 'noKyokusuData'`）になります。陰陽と局数を両方指定すれば、データのない日でも作盤できます（現行と同じ）。
- CSV（`data/kimon/kyokusu.csv`・`kyokaku.csv`）は `src/kimon.generated.ts` に文字列として同梱します。**書き換えたら次のコマンドを実行してください。** 切り替えまでの間は、現行版の `backend/apps/fortune/data/` と同じ内容に保ちます（違うとテストが知らせます）。

  ```bash
  pnpm --filter @yoten/meishiki generate:kimon
  ```

- 1日分の時盤は、1枚が失敗してもほかの盤を返します（`slots[i].ok` で判定）。

### 現行版からの意図的な変更

盤の配置（地盤干〜八神・点数）は現行版とまったく同じです（中宮の扱いなど、現行版の独特な決まりも含めて）。次の不具合だけ直しています。

- 日盤が必ずエラー（「replace() argument 2 must be str, not None」）になっていた：凶格の判定で、日盤にはない時干（None）を条件の「(時干)」に置き換えようとしていたのが原因。日盤では時干を使う凶格（天羅・地網）を判定しない。その先の五不遇時のフラグ未設定（これもエラーになる）も、日盤は false にした
- 時盤の凶格「(日干)」（日格・雲干）に時干が使われていた → 日柱の天干を使う。五不遇時も同じ理由で一度も成立しなかったのを直した
- 門迫：条件の「休門」と盤の「休」を比べていて一度も成立しなかったのを直した
- 1月1日〜小寒前の月柱：命式と同じく前年12月（大雪）の月柱を使う（凶格の月格に影響）
- 場所は都市名ではなく都道府県コード（命式と同じ）。補正値は現行の都市と同じ
- 時盤では時刻（時）を必須にした（現行は省略すると0時として計算）

## テスト

```bash
pnpm test        # vitest
pnpm typecheck   # tsc
```

- `test/legacy-parity.test.ts`：現行の Python 版で計算した 11,395 件（全節入りの前後と乱数の日時）と比べる。意図的な変更に当たるケースを除き、すべて一致すること。
- `test/meishiki.test.ts`：基準ケース、不具合の修正、オプション、入力チェック。
- `test/skill-sheet.test.ts`：現行の Python 版で計算した鑑定スキル表 3,001 件と、点数・内訳・職種・適用ルール・解釈の文面まで比べる。基準ケースと鑑定事例（Sさん・Oさん）の期待値も現行のテストから引き継ぐ。
- `test/skill-rules.test.ts`：解釈ルールの書式チェックと判定。
- `test/kimon-parity.test.ts`：現行の Python 版で作った奇門遁甲の盤 14,005件（2026年の毎日の時盤 13,140件・日盤 365件と、陰陽・局数を指定したケース 500件）と比べる。盤の配置はすべて一致、凶格・五不遇時は不具合を直した期待値（現行の関数で作ったもの）と一致すること。
- `test/kimon.test.ts`：奇門遁甲の基準ケース（現行のテストから引き継ぎ）、日盤、時刻の境目、入力チェック、1日分の時盤。

比較用データは、現行版が動いている環境で次のコマンドで作り直せます（リポジトリのルートで）。

```bash
docker compose exec -T backend python - < packages/meishiki/scripts/export_legacy_fixtures.py \
  | gzip -9 > packages/meishiki/test/fixtures/legacy.json.gz
docker compose exec -T backend python - < packages/meishiki/scripts/export_legacy_skill_fixtures.py \
  | gzip -9 > packages/meishiki/test/fixtures/legacy-skill.json.gz
docker compose exec -T backend python - < packages/meishiki/scripts/export_legacy_kimon_fixtures.py \
  | gzip -9 > packages/meishiki/test/fixtures/legacy-kimon.json.gz
```

解釈ルールを書き換えたら、鑑定スキル表の比較用データ（`legacy-skill.json.gz`）も作り直してください（版が違うとテストが知らせます）。


## 判定の要点（AI 解説）の中心部分

`src/insight.ts`：AI に渡す入力の組み立て（`buildInsightInput`）、キャッシュ用のハッシュ（`computeInsightHash`）、プロンプト（`renderInsightSystemPrompt`・`renderInsightUserPrompt`）、構造化出力のスキーマ（`insightResponseSchema`）、応答の検証（`validateInsightContent`）。現行の `insight_service.py` と同じ形・同じ基準。

プロンプトは `prompts/skill_insight_v2.md`（現行 backend のコピー。同じ内容かをテストで確かめる）。書き換えたら `pnpm --filter @yoten/meishiki generate:prompts` で `src/prompts.generated.ts` を作り直す。版を上げるときは新しいファイル（v3）を作り、`INSIGHT_PROMPT_VERSION` を変える。

### 奇門遁甲の吉格

凶格（`data/kimon/kyokaku.csv`）とは別に、陽てん塾の指定で吉格を判定する（`judgeKichikaku`、結果は各宮の `kichikaku`）。

- 風遁：天盤に「乙」があり、三吉門（休・生・開）が巽宮（4）にある
- 玉女守門：天盤に「丁」があり、直使と同じ宮にある

天盤干が2つある宮は、どちらの干も天盤干として見る。
