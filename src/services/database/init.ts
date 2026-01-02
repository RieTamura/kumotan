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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
  // Migration to version 2 (example for future use)
  if (currentVersion < 2) {
    // Example migration:
    // await database.execAsync(`
    //   ALTER TABLE words ADD COLUMN pronunciation TEXT;
    // `);
    // await database.runAsync(
    //   'INSERT INTO schema_version (version) VALUES (?)',
    //   [2]
    // );
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
