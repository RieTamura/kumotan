/**
 * JMdict → SQLite変換スクリプト
 *
 * JMdict JSONファイルを英語→日本語検索用のSQLiteデータベースに変換します。
 *
 * 使用方法:
 *   npx ts-node scripts/jmdict/convert-to-sqlite.ts
 *
 * 出力:
 *   assets/jmdict/jmdict.db - SQLiteデータベースファイル
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

interface JMdictSense {
  partOfSpeech: string[];
  appliesToKanji: string[];
  appliesToKana: string[];
  related: string[][];
  antonym: string[][];
  field: string[];
  dialect: string[];
  misc: string[];
  info: string[];
  languageSource: unknown[];
  gloss: Array<{
    lang: string;
    gender?: string;
    type?: string;
    text: string;
  }>;
}

interface JMdictKanji {
  common: boolean;
  text: string;
  tags: string[];
}

interface JMdictKana {
  common: boolean;
  text: string;
  tags: string[];
  appliesToKanji: string[];
}

interface JMdictEntry {
  id: string;
  kanji: JMdictKanji[];
  kana: JMdictKana[];
  sense: JMdictSense[];
}

interface JMdictData {
  version: string;
  languages: string[];
  commonOnly: boolean;
  dictDate: string;
  dictRevisions: string[];
  tags: Record<string, string>;
  words: JMdictEntry[];
}

const INPUT_FILE = path.join(__dirname, '../../assets/jmdict/jmdict-eng.json');
const OUTPUT_FILE = path.join(__dirname, '../../assets/jmdict/jmdict.db');

function createSchema(db: Database.Database): void {
  console.log('Creating database schema...');

  // メインのエントリテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY,
      kanji TEXT,
      kana TEXT NOT NULL,
      is_common INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 0
    );
  `);

  // 英語の意味テーブル（英語→日本語検索用）
  db.exec(`
    CREATE TABLE IF NOT EXISTS glosses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      gloss TEXT NOT NULL,
      gloss_normalized TEXT NOT NULL,
      part_of_speech TEXT,
      sense_index INTEGER DEFAULT 0,
      FOREIGN KEY (entry_id) REFERENCES entries(id)
    );
  `);

  // インデックス作成
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_glosses_normalized ON glosses(gloss_normalized);
    CREATE INDEX IF NOT EXISTS idx_glosses_entry ON glosses(entry_id);
    CREATE INDEX IF NOT EXISTS idx_entries_kanji ON entries(kanji);
    CREATE INDEX IF NOT EXISTS idx_entries_kana ON entries(kana);
    CREATE INDEX IF NOT EXISTS idx_entries_common ON entries(is_common);
  `);

  // メタデータテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  console.log('Schema created.');
}

function normalizeGloss(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function calculatePriority(entry: JMdictEntry): number {
  let priority = 0;

  // 常用語彙の場合は優先度を上げる
  if (entry.kanji.some((k) => k.common) || entry.kana.some((k) => k.common)) {
    priority += 100;
  }

  // news1, ichi1, spec1, gai1などのタグがあれば優先度を上げる
  const highPriorityTags = ['news1', 'ichi1', 'spec1', 'gai1'];
  for (const kanji of entry.kanji) {
    for (const tag of kanji.tags) {
      if (highPriorityTags.includes(tag)) {
        priority += 50;
      }
    }
  }
  for (const kana of entry.kana) {
    for (const tag of kana.tags) {
      if (highPriorityTags.includes(tag)) {
        priority += 50;
      }
    }
  }

  return priority;
}

function convertToSqlite(): void {
  console.log('=== JMdict to SQLite Converter ===\n');

  // Check input file
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    console.error('Run download-jmdict.ts first.');
    process.exit(1);
  }

  // Remove existing database
  if (fs.existsSync(OUTPUT_FILE)) {
    fs.unlinkSync(OUTPUT_FILE);
    console.log('Removed existing database.');
  }

  // Create database
  const db = new Database(OUTPUT_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  createSchema(db);

  // Read JMdict JSON
  console.log('Reading JMdict JSON...');
  const jsonData = fs.readFileSync(INPUT_FILE, 'utf-8');
  const jmdict: JMdictData = JSON.parse(jsonData);

  console.log(`JMdict version: ${jmdict.version}`);
  console.log(`Dictionary date: ${jmdict.dictDate}`);
  console.log(`Total entries: ${jmdict.words.length}`);

  // Prepare statements
  const insertEntry = db.prepare(`
    INSERT INTO entries (id, kanji, kana, is_common, priority)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertGloss = db.prepare(`
    INSERT INTO glosses (entry_id, gloss, gloss_normalized, part_of_speech, sense_index)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMetadata = db.prepare(`
    INSERT INTO metadata (key, value) VALUES (?, ?)
  `);

  // Convert in transaction
  console.log('Converting entries...');
  let processedCount = 0;
  let glossCount = 0;

  const transaction = db.transaction(() => {
    for (const entry of jmdict.words) {
      // Get primary kanji and kana
      const kanji = entry.kanji.length > 0 ? entry.kanji[0].text : null;
      const kana = entry.kana.length > 0 ? entry.kana[0].text : '';
      const isCommon = entry.kanji.some((k) => k.common) || entry.kana.some((k) => k.common) ? 1 : 0;
      const priority = calculatePriority(entry);

      // Insert entry
      insertEntry.run(parseInt(entry.id), kanji, kana, isCommon, priority);

      // Insert glosses
      for (let senseIndex = 0; senseIndex < entry.sense.length; senseIndex++) {
        const sense = entry.sense[senseIndex];
        const partOfSpeech = sense.partOfSpeech.join(', ');

        for (const glossItem of sense.gloss) {
          if (glossItem.lang === 'eng') {
            const glossText = glossItem.text;
            const glossNormalized = normalizeGloss(glossText);

            if (glossNormalized.length > 0) {
              insertGloss.run(parseInt(entry.id), glossText, glossNormalized, partOfSpeech, senseIndex);
              glossCount++;
            }
          }
        }
      }

      processedCount++;
      if (processedCount % 10000 === 0) {
        console.log(`  Processed: ${processedCount} / ${jmdict.words.length}`);
      }
    }

    // Insert metadata
    insertMetadata.run('version', jmdict.version);
    insertMetadata.run('dict_date', jmdict.dictDate);
    insertMetadata.run('entry_count', jmdict.words.length.toString());
    insertMetadata.run('gloss_count', glossCount.toString());
    insertMetadata.run('created_at', new Date().toISOString());
  });

  transaction();

  // Create FTS5 virtual table for full-text search
  console.log('Creating full-text search index...');
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS glosses_fts USING fts5(
      gloss,
      content='glosses',
      content_rowid='id'
    );
  `);

  db.exec(`
    INSERT INTO glosses_fts(glosses_fts) VALUES('rebuild');
  `);

  // Optimize database
  console.log('Optimizing database...');
  db.exec('VACUUM');
  db.exec('ANALYZE');

  db.close();

  // Report results
  const stats = fs.statSync(OUTPUT_FILE);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log('\n=== Conversion Complete ===');
  console.log(`Output file: ${OUTPUT_FILE}`);
  console.log(`Database size: ${sizeMB} MB`);
  console.log(`Entries: ${processedCount}`);
  console.log(`Glosses: ${glossCount}`);
}

convertToSqlite();
