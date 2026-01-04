/**
 * Words Database Service
 * Handles all database operations related to words
 */

import * as SQLite from 'expo-sqlite';
import { Result } from '../../types/result';
import { Word, CreateWordInput, WordFilter } from '../../types/word';
import { AppError, ErrorCode, databaseError } from '../../utils/errors';
import { sanitizeWord } from '../../utils/validators';

/**
 * Database instance reference
 */
let db: SQLite.SQLiteDatabase | null = null;

/**
 * Set the database instance
 */
export function setDatabase(database: SQLite.SQLiteDatabase): void {
  db = database;
}

/**
 * Get the database instance
 */
function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call setDatabase first.');
  }
  return db;
}

/**
 * Convert database row to Word object
 */
function rowToWord(row: Record<string, unknown>): Word {
  return {
    id: row.id as number,
    english: row.english as string,
    japanese: row.japanese as string | null,
    definition: row.definition as string | null,
    postUrl: row.post_url as string | null,
    postText: row.post_text as string | null,
    isRead: (row.is_read as number) === 1,
    createdAt: row.created_at as string,
    readAt: row.read_at as string | null,
  };
}

/**
 * Insert a new word
 */
export async function insertWord(
  input: CreateWordInput
): Promise<Result<Word, AppError>> {
  try {
    const database = getDatabase();
    const sanitizedEnglish = sanitizeWord(input.english);

    // Check for duplicate
    const existing = await database.getFirstAsync<Record<string, unknown>>(
      'SELECT id FROM words WHERE english = ? LIMIT 1',
      [sanitizedEnglish]
    );

    if (existing) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.DUPLICATE_WORD,
          'この単語は既に登録されています。'
        ),
      };
    }

    // Insert the word
    const result = await database.runAsync(
      `INSERT INTO words (english, japanese, definition, post_url, post_text)
       VALUES (?, ?, ?, ?, ?)`,
      [
        sanitizedEnglish,
        input.japanese ?? null,
        input.definition ?? null,
        input.postUrl ?? null,
        input.postText ?? null,
      ]
    );

    // Retrieve the inserted word
    const insertedWord = await database.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM words WHERE id = ?',
      [result.lastInsertRowId]
    );

    if (!insertedWord) {
      return {
        success: false,
        error: databaseError('単語の保存に失敗しました。'),
      };
    }

    return { success: true, data: rowToWord(insertedWord) };
  } catch (error) {
    return {
      success: false,
      error: databaseError('単語の保存に失敗しました。', error),
    };
  }
}

/**
 * Add a new word (simplified interface for insertWord)
 */
export async function addWord(
  english: string,
  japanese?: string,
  definition?: string,
  postUrl?: string,
  postText?: string
): Promise<Result<Word, AppError>> {
  return insertWord({
    english,
    japanese,
    definition,
    postUrl,
    postText,
  });
}

/**
 * Get words with filtering and sorting
 */
export async function getWords(
  filter: WordFilter
): Promise<Result<Word[], AppError>> {
  try {
    const database = getDatabase();
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    // Build WHERE clause
    if (filter.isRead !== null && filter.isRead !== undefined) {
      conditions.push('is_read = ?');
      params.push(filter.isRead ? 1 : 0);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build ORDER BY clause
    const sortColumn = filter.sortBy === 'english' ? 'english' : 'created_at';
    const sortDirection = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const orderClause = `ORDER BY ${sortColumn} ${sortDirection}`;

    // Build LIMIT and OFFSET clause
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;
    const limitClause = `LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const query = `SELECT * FROM words ${whereClause} ${orderClause} ${limitClause}`;

    const rows = await database.getAllAsync<Record<string, unknown>>(
      query,
      params
    );

    return { success: true, data: rows.map(rowToWord) };
  } catch (error) {
    return {
      success: false,
      error: databaseError('単語の取得に失敗しました。', error),
    };
  }
}

/**
 * Get a word by ID
 */
export async function getWordById(
  id: number
): Promise<Result<Word | null, AppError>> {
  try {
    const database = getDatabase();
    const row = await database.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM words WHERE id = ?',
      [id]
    );

    return { success: true, data: row ? rowToWord(row) : null };
  } catch (error) {
    return {
      success: false,
      error: databaseError('単語の取得に失敗しました。', error),
    };
  }
}

/**
 * Find a word by English text
 */
export async function findWordByEnglish(
  english: string
): Promise<Result<Word | null, AppError>> {
  try {
    const database = getDatabase();
    const sanitizedEnglish = sanitizeWord(english);
    const row = await database.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM words WHERE english = ? LIMIT 1',
      [sanitizedEnglish]
    );

    return { success: true, data: row ? rowToWord(row) : null };
  } catch (error) {
    return {
      success: false,
      error: databaseError('単語の検索に失敗しました。', error),
    };
  }
}

/**
 * Toggle read status of a word
 */
export async function toggleReadStatus(
  id: number
): Promise<Result<Word, AppError>> {
  try {
    const database = getDatabase();

    // Get current word
    const current = await database.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM words WHERE id = ?',
      [id]
    );

    if (!current) {
      return {
        success: false,
        error: new AppError(ErrorCode.WORD_NOT_FOUND, '単語が見つかりません。'),
      };
    }

    const currentIsRead = (current.is_read as number) === 1;
    const newIsRead = currentIsRead ? 0 : 1;
    const readAt = newIsRead === 1 ? new Date().toISOString() : null;

    // Use transaction for atomic update
    await database.withTransactionAsync(async () => {
      // Update word
      await database.runAsync(
        'UPDATE words SET is_read = ?, read_at = ? WHERE id = ?',
        [newIsRead, readAt, id]
      );

      // Update daily stats
      if (newIsRead === 1) {
        await database.runAsync(
          `INSERT INTO daily_stats (date, words_read_count)
           VALUES (date('now'), 1)
           ON CONFLICT(date) DO UPDATE SET
           words_read_count = words_read_count + 1`
        );
      } else {
        await database.runAsync(
          `UPDATE daily_stats
           SET words_read_count = MAX(0, words_read_count - 1)
           WHERE date = date('now')`
        );
      }
    });

    // Get updated word
    const updated = await database.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM words WHERE id = ?',
      [id]
    );

    if (!updated) {
      return {
        success: false,
        error: databaseError('単語の更新後の取得に失敗しました。'),
      };
    }

    return { success: true, data: rowToWord(updated) };
  } catch (error) {
    return {
      success: false,
      error: databaseError('既読状態の更新に失敗しました。', error),
    };
  }
}

/**
 * Delete a word by ID
 */
export async function deleteWord(id: number): Promise<Result<void, AppError>> {
  try {
    const database = getDatabase();
    await database.runAsync('DELETE FROM words WHERE id = ?', [id]);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: databaseError('単語の削除に失敗しました。', error),
    };
  }
}

/**
 * Get total word count
 */
export async function getTotalWordCount(): Promise<Result<number, AppError>> {
  try {
    const database = getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM words'
    );
    return { success: true, data: result?.count ?? 0 };
  } catch (error) {
    return {
      success: false,
      error: databaseError('単語数の取得に失敗しました。', error),
    };
  }
}

/**
 * Get read word count
 */
export async function getReadWordCount(): Promise<Result<number, AppError>> {
  try {
    const database = getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM words WHERE is_read = 1'
    );
    return { success: true, data: result?.count ?? 0 };
  } catch (error) {
    return {
      success: false,
      error: databaseError('既読単語数の取得に失敗しました。', error),
    };
  }
}

/**
 * Get today's read count
 */
export async function getTodayReadCount(): Promise<Result<number, AppError>> {
  try {
    const database = getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM words
       WHERE date(read_at) = date('now')`
    );
    return { success: true, data: result?.count ?? 0 };
  } catch (error) {
    return {
      success: false,
      error: databaseError('今日の既読数の取得に失敗しました。', error),
    };
  }
}

/**
 * Delete all words
 */
export async function deleteAllWords(): Promise<Result<void, AppError>> {
  try {
    const database = getDatabase();
    await database.withTransactionAsync(async () => {
      await database.runAsync('DELETE FROM words');
      await database.runAsync('DELETE FROM daily_stats');
    });
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: databaseError('データの削除に失敗しました。', error),
    };
  }
}

/**
 * Export all words as JSON-compatible array
 */
export async function exportWords(): Promise<Result<Word[], AppError>> {
  try {
    const database = getDatabase();
    const rows = await database.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM words ORDER BY created_at DESC'
    );
    return { success: true, data: rows.map(rowToWord) };
  } catch (error) {
    return {
      success: false,
      error: databaseError('データのエクスポートに失敗しました。', error),
    };
  }
}
