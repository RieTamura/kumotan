#!/usr/bin/env node
/**
 * Script to generate src/constants/ngslsWords.ts from NGSL-S CSV files
 *
 * Sources:
 *   - NGSL-Spoken_1.2_with_en_definitions.csv
 *   - NGSL-Spoken_1.2_stats.csv
 *
 * NGSL-S License: CC BY-SA 4.0
 * https://creativecommons.org/licenses/by-sa/4.0/
 */

const fs = require('fs');
const path = require('path');

const STATS_CSV = path.join(__dirname, 'NGSL-Spoken_1.2_stats.csv');
const DEFS_CSV = path.join(__dirname, 'NGSL-Spoken_1.2_with_en_definitions.csv');
const OUTPUT_TS = path.join(__dirname, '..', 'src', 'constants', 'ngslsWords.ts');

/**
 * Parse CSV lines (handles quoted fields with commas inside)
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Parse stats CSV → Map<lemma, rank>
const statsLines = fs.readFileSync(STATS_CSV, 'utf8').trim().split('\n');
const rankMap = new Map(); // lemma (lowercase) → rank (number)
for (let i = 1; i < statsLines.length; i++) {
  const [lemma, rankStr] = parseCsvLine(statsLines[i]);
  if (!lemma || rankStr === '#N/A') continue;
  const rank = parseInt(rankStr, 10);
  if (!isNaN(rank)) {
    rankMap.set(lemma.toLowerCase(), rank);
  }
}

// Parse definitions CSV → Map<word, definition>
const defLines = fs.readFileSync(DEFS_CSV, 'utf8').trim().split('\n');
const defMap = new Map(); // word (lowercase) → definition string
for (let i = 1; i < defLines.length; i++) {
  const [word, def] = parseCsvLine(defLines[i]);
  if (!word) continue;
  defMap.set(word.toLowerCase(), def || '');
}

// Merge: use rankMap as the authoritative word list
// Band assignment based on rank:
//   Band 1: rank 1-240  (most frequent spoken words)
//   Band 2: rank 241-480
//   Band 3: rank 481-721
function getBand(rank) {
  if (rank <= 240) return 1;
  if (rank <= 480) return 2;
  return 3;
}

// Build entries sorted by rank
const entries = Array.from(rankMap.entries())
  .sort((a, b) => a[1] - b[1]);

// Generate TypeScript content
const lines = [
  '/**',
  ' * NGSL-S (New General Service List - Spoken) 単語データ',
  ' *',
  ' * Source: NGSL-Spoken 1.2',
  ' * License: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)',
  ' * Authors: Browne, C., Culligan, B., & Phillips, J.',
  ' *',
  ' * 頻度バンド（会話英語コーパスに基づくランクより算出）:',
  ' * Band 1: 最頻出会話語 (rank 1-240)',
  ' * Band 2: 頻出会話語 (rank 241-480)',
  ' * Band 3: 基礎会話語 (rank 481-721)',
  ' */',
  '',
  "export type NgslsBand = 1 | 2 | 3;",
  '',
  '/**',
  ' * NGSL-S単語と頻度バンドのマップ',
  ' * key: 小文字の見出し語, value: 頻度バンド (1=最頻出, 2=頻出, 3=基礎)',
  ' */',
  'export const NGSLS_MAP: Readonly<Record<string, NgslsBand>> = {',
];

for (const [lemma, rank] of entries) {
  const band = getBand(rank);
  lines.push(`  "${lemma}": ${band},`);
}

lines.push('};');
lines.push('');
lines.push('/**');
lines.push(' * 単語がNGSL-Sに含まれるか確認し、バンドを返す');
lines.push(' * @returns バンド番号（1-3）、含まれない場合は null');
lines.push(' */');
lines.push('export function getNgslsBand(word: string): NgslsBand | null {');
lines.push('  const band = NGSLS_MAP[word.toLowerCase()];');
lines.push('  return band !== undefined ? band : null;');
lines.push('}');
lines.push('');
lines.push('/**');
lines.push(' * バンド番号を表示ラベルに変換');
lines.push(' */');
lines.push('export function getNgslsBandLabel(band: NgslsBand): string {');
lines.push('  switch (band) {');
lines.push("    case 1: return 'S★★★';");
lines.push("    case 2: return 'S★★';");
lines.push("    case 3: return 'S★';");
lines.push('  }');
lines.push('}');
lines.push('');

fs.writeFileSync(OUTPUT_TS, lines.join('\n'), 'utf8');

console.log(`Generated ${OUTPUT_TS}`);
console.log(`  Total words: ${entries.length}`);
console.log(`  Band 1 (rank 1-240): ${entries.filter(([, r]) => r <= 240).length} words`);
console.log(`  Band 2 (rank 241-480): ${entries.filter(([, r]) => r > 240 && r <= 480).length} words`);
console.log(`  Band 3 (rank 481-721): ${entries.filter(([, r]) => r > 480).length} words`);
