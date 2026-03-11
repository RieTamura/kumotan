#!/usr/bin/env node
/**
 * One-shot migration script: convert NGSL_MAP from Record object literal to Map
 * to fix Biome lint/suspicious/noThenProperty ("then", "catch", "finally" keys).
 *
 * NOTE: Already applied on 2026-03-09. Do NOT run again.
 * Kept for historical reference only.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'constants', 'ngslWords.ts');
let src = fs.readFileSync(filePath, 'utf8');

// 1. Fix license header
src = src.replace(
  `/**
 * NGSL (New General Service List) 単語データ
 *
 * Source: lpmi-13/machine_readable_wordlists (CC0 1.0 Universal)
 * Original list: New General Service List by Browne, Culligan & Phillips
 * License: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)`,
  `/**
 * NGSL (New General Service List) 単語データ
 *
 * Original list: New General Service List by Browne, Culligan & Phillips
 * License: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)
 * Machine-readable source: lpmi-13/machine_readable_wordlists (CC0 1.0 Universal)`
);

// 2. Change type declaration
src = src.replace(
  `export const NGSL_MAP: Readonly<Record<string, NgslBand>> = {`,
  `export const NGSL_MAP: ReadonlyMap<string, NgslBand> = new Map<string, NgslBand>([`
);

// 3. Change closing brace
src = src.replace(/^};$/m, ']);');

// 4. Change each entry: "word": N, → ["word", N],
src = src.replace(/^  "([^"]+)": ([123]),$/gm, (_, word, band) => `  ["${word}", ${band}],`);

// 5. Fix lookup function
src = src.replace(
  `  const band = NGSL_MAP[word.toLowerCase()];`,
  `  const band = NGSL_MAP.get(word.toLowerCase());`
);

// 6. Update JSDoc comment
src = src.replace(
  `/**
 * NGSL単語と頻度バンドのマップ
 * key: 小文字の見出し語, value: 頻度バンド (1=最頻出, 2=頻出, 3=基礎)
 */`,
  `/**
 * NGSL単語と頻度バンドのマップ
 * キー: 小文字の見出し語, 値: 頻度バンド (1=最頻出, 2=頻出, 3=基礎)
 * Map を使用することで "then"/"catch"/"finally" キーの Biome noThenProperty 違反を回避
 */`
);

fs.writeFileSync(filePath, src, 'utf8');
console.log('Done: ngslWords.ts converted to Map');

// Verify
const converted = fs.readFileSync(filePath, 'utf8');
const hasThenKey = converted.includes('"then": ');
const hasMapDecl = converted.includes('new Map<string, NgslBand>');
const hasGetCall = converted.includes('NGSL_MAP.get(');
console.log(`  Map declaration: ${hasMapDecl}`);
console.log(`  .get() lookup:   ${hasGetCall}`);
console.log(`  "then": remains: ${hasThenKey} (should be false)`);
