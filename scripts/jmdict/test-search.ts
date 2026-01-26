/**
 * JMdict検索テストスクリプト
 * 頻出単語での検索精度とレスポンス時間を計測
 */

import Database from 'better-sqlite3';
import * as path from 'path';

const db = new Database(path.join(__dirname, '../../assets/jmdict/jmdict.db'));

// テスト単語リスト（頻出単語50語）
const testWords = [
  // 基本形容詞
  'beautiful', 'happy', 'sad', 'big', 'small', 'good', 'bad', 'new', 'old', 'hot', 'cold', 'fast', 'slow',
  // 基本動詞
  'eat', 'run', 'walk', 'sleep', 'work', 'study', 'read', 'write', 'speak', 'listen', 'see', 'think',
  // 基本名詞
  'love', 'book', 'water', 'time', 'day', 'friend', 'apple', 'cat', 'dog', 'house', 'car', 'school',
  // フレーズ
  'thank you', 'hello', 'goodbye', 'good morning', 'good night',
  // その他
  'understand', 'remember', 'forget', 'believe', 'hope', 'dream', 'peace', 'nature', 'heart', 'soul'
];

console.log('=== JMdict Search Test ===\n');
console.log(`Testing ${testWords.length} words...\n`);

interface SearchResult {
  word: string;
  found: boolean;
  japanese?: string;
  kana?: string;
  isCommon?: boolean;
  timeMs: number;
}

const results: SearchResult[] = [];
const times: number[] = [];

for (const word of testWords) {
  const normalized = word.toLowerCase().trim();
  const start = performance.now();

  const rows = db.prepare(`
    SELECT e.kanji, e.kana, g.gloss, e.is_common, e.priority
    FROM glosses g
    JOIN entries e ON g.entry_id = e.id
    WHERE g.gloss_normalized = ?
    ORDER BY e.priority DESC, e.is_common DESC
    LIMIT 1
  `).all(normalized) as any[];

  const elapsed = performance.now() - start;
  times.push(elapsed);

  if (rows.length > 0) {
    const r = rows[0];
    results.push({
      word,
      found: true,
      japanese: r.kanji || r.kana,
      kana: r.kana,
      isCommon: r.is_common === 1,
      timeMs: elapsed
    });
  } else {
    results.push({
      word,
      found: false,
      timeMs: elapsed
    });
  }
}

// 結果表示
console.log('--- Results ---\n');
for (const r of results) {
  if (r.found) {
    const common = r.isCommon ? '★' : '';
    console.log(`✅ "${r.word}" → ${r.japanese} (${r.kana}) ${common} [${r.timeMs.toFixed(2)}ms]`);
  } else {
    console.log(`❌ "${r.word}" → Not found [${r.timeMs.toFixed(2)}ms]`);
  }
}

// 統計
const found = results.filter(r => r.found).length;
const notFound = results.filter(r => !r.found).length;
const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
const maxTime = Math.max(...times);
const minTime = Math.min(...times);

console.log('\n=== Summary ===');
console.log(`Hit rate: ${found}/${testWords.length} (${(found/testWords.length*100).toFixed(1)}%)`);
console.log(`Miss: ${notFound}/${testWords.length}`);
console.log('\n--- Response Time ---');
console.log(`Average: ${avgTime.toFixed(2)}ms`);
console.log(`Min: ${minTime.toFixed(2)}ms`);
console.log(`Max: ${maxTime.toFixed(2)}ms`);

// 未ヒット単語の詳細
if (notFound > 0) {
  console.log('\n--- Not Found Words ---');
  results.filter(r => !r.found).forEach(r => console.log(`  - ${r.word}`));
}

db.close();
