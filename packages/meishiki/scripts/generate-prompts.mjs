// prompts/*.md を src/prompts.generated.ts（文字列）に書き出す。
// サーバーレス環境ではファイルを実行時に読まず、ビルドに同梱するため。
// 使い方: pnpm --filter @yoten/meishiki generate:prompts（プロンプトを書き換えたら実行）
// テスト（test/insight.test.ts）が、書き出し忘れを検出する。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../prompts/', import.meta.url);
const target = new URL('../src/prompts.generated.ts', import.meta.url);
const entries = readdirSync(dir)
  .filter((f) => /^skill_insight_v\d+\.md$/.test(f))
  .sort()
  .map((f) => [f.replace(/^skill_insight_|\.md$/g, ''), readFileSync(new URL(f, dir), 'utf8').replace(/\r\n/g, '\n')]);

writeFileSync(
  target,
  `// このファイルは scripts/generate-prompts.mjs が prompts/*.md から自動で作ります。直接編集しないでください。\n` +
    `export const INSIGHT_PROMPTS: Record<string, string> = ${JSON.stringify(Object.fromEntries(entries), null, 2)};\n`,
);
console.log('src/prompts.generated.ts を更新しました');
