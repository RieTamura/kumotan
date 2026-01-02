/**
 * Stats Database Service
 * Handles all database operations related to learning statistics
 */

import * as SQLite from 'expo-sqlite';
import { Result } from '../../types/result';
import { Stats, DailyStats, CalendarData } from '../../types/stats';
import { AppError, databaseError } from '../../utils/errors';

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
 * Get overall statistics
 */
export async function getStats(): Promise<Result<Stats, AppError>> {
  try {
    const database = getDatabase();

    // Get total and read word counts
    const wordCounts = await database.getFirstAsync<{
      total: number;
      read: number;
    }>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as read
       FROM words`
    );

    const total = wordCounts?.total ?? 0;
    const read = wordCounts?.read ?? 0;

    // Get this week's learning days
    const thisWeekResult = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(DISTINCT date) as count FROM daily_stats
       WHERE date >= date('now', '-7 days') AND words_read_count > 0`
    );

    // Get today's count
    const todayResult = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM words
       WHERE date(read_at) = date('now')`
    );

    // Calculate streak
    const streak = await calculateStreak(database);

    return {
      success: true,
      data: {
        totalWords: total,
        readWords: read,
        readPercentage: total > 0 ? Math.round((read / total) * 100) : 0,
        thisWeekDays: thisWeekResult?.count ?? 0,
        streak,
        todayCount: todayResult?.count ?? 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: databaseError('統計の取得に失敗しました。', error),
    };
  }
}

/**
 * Calculate consecutive learning days (streak)
 */
async function calculateStreak(
  database: SQLite.SQLiteDatabase
): Promise<number> {
  let streak = 0;
  const currentDate = new Date();
  let checkDate = new Date(currentDate);

  // Check if today has any activity, if not start from yesterday
  const todayStr = currentDate.toISOString().split('T')[0];
  const todayResult = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM daily_stats WHERE date = ? AND words_read_count > 0',
    [todayStr]
  );

  // If no activity today, start checking from yesterday
  if (!todayResult || todayResult.count === 0) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Count consecutive days
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM daily_stats WHERE date = ? AND words_read_count > 0',
      [dateStr]
    );

    if (!result || result.count === 0) {
      break;
    }

    streak++;
    checkDate.setDate(checkDate.getDate() - 1);

    // Safety limit to prevent infinite loop
    if (streak > 365) {
      break;
    }
  }

  return streak;
}

/**
 * Get calendar data for a specific month
 */
export async function getCalendarData(
  year: number,
  month: number
): Promise<Result<CalendarData, AppError>> {
  try {
    const database = getDatabase();

    // Format dates for the query
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    // Get the last day of the month
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const rows = await database.getAllAsync<{
      date: string;
      words_read_count: number;
    }>(
      `SELECT date, words_read_count FROM daily_stats
       WHERE date BETWEEN ? AND ?
       ORDER BY date`,
      [startDate, endDate]
    );

    const days: DailyStats[] = rows.map((row) => ({
      date: row.date,
      wordsReadCount: row.words_read_count,
    }));

    return {
      success: true,
      data: {
        year,
        month,
        days,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: databaseError('カレンダーデータの取得に失敗しました。', error),
    };
  }
}

/**
 * Get daily stats for a specific date
 */
export async function getDailyStats(
  date: string
): Promise<Result<DailyStats | null, AppError>> {
  try {
    const database = getDatabase();
    const row = await database.getFirstAsync<{
      date: string;
      words_read_count: number;
    }>('SELECT date, words_read_count FROM daily_stats WHERE date = ?', [date]);

    if (!row) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        date: row.date,
        wordsReadCount: row.words_read_count,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: databaseError('日別統計の取得に失敗しました。', error),
    };
  }
}

/**
 * Get stats for the past N days
 */
export async function getRecentStats(
  days: number = 7
): Promise<Result<DailyStats[], AppError>> {
  try {
    const database = getDatabase();
    const rows = await database.getAllAsync<{
      date: string;
      words_read_count: number;
    }>(
      `SELECT date, words_read_count FROM daily_stats
       WHERE date >= date('now', '-${days} days')
       ORDER BY date DESC`
    );

    const stats: DailyStats[] = rows.map((row) => ({
      date: row.date,
      wordsReadCount: row.words_read_count,
    }));

    return { success: true, data: stats };
  } catch (error) {
    return {
      success: false,
      error: databaseError('最近の統計の取得に失敗しました。', error),
    };
  }
}

/**
 * Increment today's read count manually (usually called from word toggle)
 * This is mainly for cases where you need to update stats outside of word operations
 */
export async function incrementTodayCount(): Promise<Result<void, AppError>> {
  try {
    const database = getDatabase();
    await database.runAsync(
      `INSERT INTO daily_stats (date, words_read_count)
       VALUES (date('now'), 1)
       ON CONFLICT(date) DO UPDATE SET
       words_read_count = words_read_count + 1`
    );
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: databaseError('統計の更新に失敗しました。', error),
    };
  }
}

/**
 * Export all daily stats
 */
export async function exportStats(): Promise<Result<DailyStats[], AppError>> {
  try {
    const database = getDatabase();
    const rows = await database.getAllAsync<{
      date: string;
      words_read_count: number;
    }>('SELECT date, words_read_count FROM daily_stats ORDER BY date DESC');

    const stats: DailyStats[] = rows.map((row) => ({
      date: row.date,
      wordsReadCount: row.words_read_count,
    }));

    return { success: true, data: stats };
  } catch (error) {
    return {
      success: false,
      error: databaseError('統計のエクスポートに失敗しました。', error),
    };
  }
}
