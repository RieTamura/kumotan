/**
 * Database initialization service
 * Handles database creation, schema setup, and migrations
 */

import * as SQLite from 'expo-sqlite';
import { DATABASE } from '../../constants/config';

/**
 * Database instance
 */
let db: SQLite.SQLiteDatabase | null = null;

/**
 * Get or create database instance
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  db = await SQLite.openDatabaseAsync(DATABASE.NAME);
  return db;
}

/**
 * Initialize database with schema
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const database = await getDatabase();

  // Create words table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      english TEXT NOT NULL,
      japanese TEXT,
      definition TEXT,
      post_url TEXT,
      post_text TEXT,
      is_read INTEGER DEFAULT 0 CHECK(is_read IN (0, 1)),
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      read_at DATETIME
    );
  `);

  // Create daily_stats table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      words_read_count INTEGER DEFAULT 0
    );
  `);

  // Create schema_version table for migrations
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes for better query performance
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_words_english ON words(english);
  `);

  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_words_created_at ON words(created_at DESC);
  `);

  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_words_is_read ON words(is_read);
  `);

  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_words_read_at ON words(read_at);
  `);

  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date DESC);
  `);

  // Create quiz_attempts table for individual answer records
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      question_type TEXT NOT NULL CHECK(question_type IN ('en_to_ja', 'ja_to_en')),
      user_answer TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL CHECK(is_correct IN (0, 1)),
      answered_at DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    );
  `);

  // Create quiz_sessions table for session statistics
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_type TEXT NOT NULL CHECK(question_type IN ('en_to_ja', 'ja_to_en', 'mixed')),
      total_questions INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      started_at DATETIME DEFAULT (datetime('now', 'localtime')),
      completed_at DATETIME,
      time_spent_seconds INTEGER
    );
  `);

  // Create indexes for quiz tables
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_quiz_attempts_word_id ON quiz_attempts(word_id);
  `);
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_quiz_attempts_answered_at ON quiz_attempts(answered_at DESC);
  `);
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_quiz_attempts_is_correct ON quiz_attempts(is_correct);
  `);
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_quiz_sessions_completed_at ON quiz_sessions(completed_at DESC);
  `);

  // Check and set initial schema version
  const versionResult = await database.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );

  if (!versionResult) {
    await database.runAsync(
      'INSERT INTO schema_version (version) VALUES (?)',
      [DATABASE.VERSION]
    );
  } else {
    // Run migrations if needed
    await runMigrations(database, versionResult.version);
  }

  if (__DEV__) {
    console.log('Database initialized successfully');
  }

  return database;
}

/**
 * Run database migrations
 */
async function runMigrations(
  database: SQLite.SQLiteDatabase,
  currentVersion: number
): Promise<void> {
  if (__DEV__) {
    console.log(`Running migrations from version ${currentVersion}`);
  }

  // Migration to version 2: Convert timestamps to UTC for timezone independence (DEPRECATED)
  if (currentVersion < 2) {
    // This migration had issues, skip to version 3
    await database.runAsync(
      'INSERT INTO schema_version (version) VALUES (?)',
      [2]
    );
    if (__DEV__) {
      console.log('Migration to version 2: Skipped (deprecated)');
    }
  }

  // Migration to version 3: Fix timezone conversion
  if (currentVersion < 3) {
    // Simply add 9 hours to convert UTC back to JST
    // The previous migration incorrectly subtracted 9 hours
    await database.execAsync(`
      UPDATE words 
      SET created_at = datetime(created_at, '+9 hours')
      WHERE created_at IS NOT NULL;
    `);
    
    await database.execAsync(`
      UPDATE words 
      SET read_at = datetime(read_at, '+9 hours')
      WHERE read_at IS NOT NULL;
    `);
    
    await database.runAsync(
      'INSERT INTO schema_version (version) VALUES (?)',
      [3]
    );
    
    if (__DEV__) {
      console.log('Migration to version 3 completed: Corrected timestamps to JST');
    }
  }

  // Migration to version 4: Ensure all timestamps are in JST
  if (currentVersion < 4) {
    // Get a sample to check if conversion is needed
    const sample = await database.getFirstAsync<{ created_at: string }>(
      'SELECT created_at FROM words LIMIT 1'
    );
    
    if (sample && sample.created_at) {
      const sampleDate = new Date(sample.created_at.replace(' ', 'T') + 'Z');
      const now = new Date();
      
      // If the time looks like UTC (9 hours behind), convert it
      if (__DEV__) {
        console.log('Sample timestamp:', sample.created_at);
        console.log('Parsed as UTC:', sampleDate.toLocaleString('ja-JP'));
        console.log('Current time:', now.toLocaleString('ja-JP'));
      }
    }
    
    // Add 9 hours to all timestamps to ensure they are in JST
    await database.execAsync(`
      UPDATE words 
      SET created_at = datetime(created_at, '+9 hours')
      WHERE created_at IS NOT NULL;
    `);
    
    await database.execAsync(`
      UPDATE words 
      SET read_at = datetime(read_at, '+9 hours')
      WHERE read_at IS NOT NULL;
    `);
    
    await database.runAsync(
      'INSERT INTO schema_version (version) VALUES (?)',
      [4]
    );
    
    if (__DEV__) {
      console.log('Migration to version 4 completed: Ensured all timestamps are in JST');
    }
  }

  // Migration to version 5: Add quiz tables
  if (currentVersion < 5) {
    // Create quiz_attempts table for individual answer records
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id INTEGER NOT NULL,
        question_type TEXT NOT NULL CHECK(question_type IN ('en_to_ja', 'ja_to_en')),
        user_answer TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        is_correct INTEGER NOT NULL CHECK(is_correct IN (0, 1)),
        answered_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
      );
    `);

    // Create quiz_sessions table for session statistics
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS quiz_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_type TEXT NOT NULL CHECK(question_type IN ('en_to_ja', 'ja_to_en', 'mixed')),
        total_questions INTEGER NOT NULL,
        correct_count INTEGER NOT NULL,
        started_at DATETIME DEFAULT (datetime('now', 'localtime')),
        completed_at DATETIME,
        time_spent_seconds INTEGER
      );
    `);

    // Create indexes for quiz tables
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_quiz_attempts_word_id ON quiz_attempts(word_id);
    `);
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_quiz_attempts_answered_at ON quiz_attempts(answered_at DESC);
    `);
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_quiz_attempts_is_correct ON quiz_attempts(is_correct);
    `);
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_quiz_sessions_completed_at ON quiz_sessions(completed_at DESC);
    `);

    await database.runAsync(
      'INSERT INTO schema_version (version) VALUES (?)',
      [5]
    );

    if (__DEV__) {
      console.log('Migration to version 5 completed: Added quiz tables');
    }
  }

  // Migration to version 6: Add pds_rkey column for PDS sync
  if (currentVersion < 6) {
    await database.execAsync(`
      ALTER TABLE words ADD COLUMN pds_rkey TEXT DEFAULT NULL;
    `);

    await database.runAsync(
      'INSERT INTO schema_version (version) VALUES (?)',
      [6]
    );

    if (__DEV__) {
      console.log('Migration to version 6 completed: Added pds_rkey column for PDS sync');
    }
  }

  // Add more migrations as needed
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

/**
 * Reset database (delete all data)
 * Use with caution!
 */
export async function resetDatabase(): Promise<void> {
  const database = await getDatabase();

  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM words');
    await database.runAsync('DELETE FROM daily_stats');
    await database.runAsync('DELETE FROM quiz_attempts');
    await database.runAsync('DELETE FROM quiz_sessions');
    await database.runAsync('DELETE FROM schema_version');
    await database.runAsync(
      'INSERT INTO schema_version (version) VALUES (?)',
      [DATABASE.VERSION]
    );
  });

  // Optimize storage after deletion
  await database.execAsync('VACUUM');

  if (__DEV__) {
    console.log('Database reset successfully');
  }
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return db !== null;
}

/**
 * Get database statistics (for debugging)
 */
export async function getDatabaseStats(): Promise<{
  wordCount: number;
  readCount: number;
  statsCount: number;
}> {
  const database = await getDatabase();

  const wordCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM words'
  );

  const readCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM words WHERE is_read = 1'
  );

  const statsCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM daily_stats'
  );

  return {
    wordCount: wordCount?.count ?? 0,
    readCount: readCount?.count ?? 0,
    statsCount: statsCount?.count ?? 0,
  };
}
