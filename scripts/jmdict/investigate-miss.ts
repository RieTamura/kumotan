/**
 * 未ヒット単語の調査スクリプト
 */

import Database from 'better-sqlite3';
import * as path from 'path';

const db = new Database(path.join(__dirname, '../../assets/jmdict/jmdict.db'));

const words = ['eat', 'read', 'write', 'understand', 'forget', 'believe'];

console.log('=== 未ヒット単語の調査 ===\n');

for (const word of words) {
  console.log(`--- "${word}" ---`);

  // 前方一致で検索
  const rows = db.prepare(`
    SELECT e.kanji, e.kana, g.gloss, e.is_common, e.priority
    FROM glosses g
    JOIN entries e ON g.entry_id = e.id
    WHERE g.gloss_normalized LIKE ?
    ORDER BY e.priority DESC
    LIMIT 5
  `).all(`${word}%`) as any[];

  if (rows.length > 0) {
    console.log(`  前方一致 ${rows.length}件:`);
    rows.forEach(r => {
      const jp = r.kanji || r.kana;
      const common = r.is_common ? '★' : '';
      console.log(`    ${jp} (${r.kana}) ${common}`);
      console.log(`      → "${r.gloss}"`);
    });
  } else {
    console.log('  前方一致: 見つからず');
  }

  // "to [word]" で完全一致検索
  const toWord = `to ${word}`;
  const toRows = db.prepare(`
    SELECT e.kanji, e.kana, g.gloss, e.is_common, e.priority
    FROM glosses g
    JOIN entries e ON g.entry_id = e.id
    WHERE g.gloss_normalized = ?
    ORDER BY e.priority DESC
    LIMIT 3
  `).all(toWord) as any[];

  if (toRows.length > 0) {
    console.log(`  "to ${word}" 完全一致 ${toRows.length}件:`);
    toRows.forEach(r => {
      const jp = r.kanji || r.kana;
      const common = r.is_common ? '★' : '';
      console.log(`    ${jp} (${r.kana}) ${common}`);
    });
  }

  console.log('');
}

db.close();
