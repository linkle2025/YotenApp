# @yoten/meishiki（新版の計算ロジック）

四柱推命の命式（四柱・蔵干・通変星・五行バランス・身旺身弱・格局・干合・大運）を計算する TypeScript のパッケージです。画面から独立していて、単体でテストできます。

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
```

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

比較用データは、現行版が動いている環境で次のコマンドで作り直せます（リポジトリのルートで）。

```bash
docker compose exec -T backend python - < packages/meishiki/scripts/export_legacy_fixtures.py \
  | gzip -9 > packages/meishiki/test/fixtures/legacy.json.gz
```

## 今後移植するもの

- 鑑定スキル表（`skill_sheet.py`）と解釈ルール（`skill_rules.py`・`skill_rules.toml`）
- 奇門遁甲（管理者のみ）
