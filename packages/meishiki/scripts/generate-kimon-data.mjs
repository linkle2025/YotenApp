// data/kimon/kyokusu.csv・kyokaku.csv を src/kimon.generated.ts（文字列）に書き出す。
// サーバーレス環境ではファイルを実行時に読まず、ビルドに同梱するため（generate-rules.mjs と同じ考え方）。
// 使い方: pnpm --filter @yoten/meishiki generate:kimon（CSV を書き換えたら実行）
// テスト（test/kimon.test.ts）が、書き出し忘れを検出する。
import { readFileSync, writeFileSync } from 'node:fs';

const read = (name) =>
  readFileSync(new URL(`../data/kimon/${name}`, import.meta.url), 'utf8')
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n');

const target = new URL('../src/kimon.generated.ts', import.meta.url);
writeFileSync(
  target,
  `// このファイルは scripts/generate-kimon-data.mjs が data/kimon/*.csv から自動で作ります。直接編集しないでください。\n` +
    `/** 局数データ（data/kimon/kyokusu.csv） */\n` +
    `export const KYOKUSU_CSV: string = ${JSON.stringify(read('kyokusu.csv'))};\n` +
    `/** 凶格データ（data/kimon/kyokaku.csv） */\n` +
    `export const KYOKAKU_CSV: string = ${JSON.stringify(read('kyokaku.csv'))};\n`,
);
console.log('src/kimon.generated.ts を更新しました');
