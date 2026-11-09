// rules/skill_rules.toml を src/rules.generated.ts（文字列）に書き出す。
// サーバーレス環境ではファイルを実行時に読まず、ビルドに同梱するため。
// 使い方: pnpm --filter @yoten/meishiki generate:rules（skill_rules.toml を書き換えたら実行）
// テスト（test/skill-rules.test.ts）が、書き出し忘れを検出する。
import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL('../rules/skill_rules.toml', import.meta.url);
const target = new URL('../src/rules.generated.ts', import.meta.url);
const text = readFileSync(source, 'utf8').replace(/\r\n/g, '\n');

writeFileSync(
  target,
  `// このファイルは scripts/generate-rules.mjs が rules/skill_rules.toml から自動で作ります。直接編集しないでください。\n` +
    `export const SKILL_RULES_TOML: string = ${JSON.stringify(text)};\n`,
);
console.log('src/rules.generated.ts を更新しました');
