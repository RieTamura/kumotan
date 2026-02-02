/**
 * Quiz Database Service
 * Handles all database operations related to quizzes
 */

import * as SQLite from 'expo-sqlite';
import { Result } from '../../types/result';
import { Word } from '../../types/word';
import {
  QuizAttempt,
  QuizSessionRecord,
  QuizStats,
  CreateQuizAttemptInput,
  CreateQuizSessionInput,
} from '../../types/quiz';
import { AppError, databaseError } from '../../utils/errors';

/**
 * Database instance reference
 */
let db: SQLite.SQLiteDatabase | null = null;

/**
 * Set the database instance
 */
export function setQuizDatabase(database: SQLite.SQLiteDatabase): void {
  db = database;
}

/**
 * Get the database instance
 */
function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call setQuizDatabase first.');
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
 * Get random words for quiz
 * Only returns words that have Japanese translation (required for quiz)
 */
export async function getRandomWordsForQuiz(
  count: number
): Promise<Result<Word[], AppError>> {
  try {
    const database = getDatabase();

    // Get words that have Japanese translation (required for quiz)
    const rows = await database.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM words
       WHERE japanese IS NOT NULL AND japanese != ''
       ORDER BY RANDOM()
       LIMIT ?`,
      [count]
    );

    const words: Word[] = rows.map(rowToWord);

    return { success: true, data: words };
  } catch (error) {
    return {
      success: false,
      error: databaseError('クイズ用単語の取得に失敗しました。', error),
    };
  }
}

/**
 * Save a quiz attempt
 */
export async function saveQuizAttempt(
  input: CreateQuizAttemptInput
): Promise<Result<QuizAttempt, AppError>> {
  try {
    const database = getDatabase();

    const result = await database.runAsync(
      `INSERT INTO quiz_attempts (word_id, question_type, user_answer, correct_answer, is_correct)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.wordId,
        input.questionType,
        input.userAnswer,
        input.correctAnswer,
        input.isCorrect ? 1 : 0,
      ]
    );

    const inserted = await database.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM quiz_attempts WHERE id = ?',
      [result.lastInsertRowId]
    );

    if (!inserted) {
      return {
        success: false,
        error: databaseError('クイズ回答の保存に失敗しました。'),
      };
    }

    return {
      success: true,
      data: {
        id: inserted.id as number,
        wordId: inserted.word_id as number,
        questionType: inserted.question_type as 'en_to_ja' | 'ja_to_en',
        userAnswer: inserted.user_answer as string,
        correctAnswer: inserted.correct_answer as string,
        isCorrect: (inserted.is_correct as number) === 1,
        answeredAt: inserted.answered_at as string,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: databaseError('クイズ回答の保存に失敗しました。', error),
    };
  }
}

/**
 * Save a quiz session
 */
export async function saveQuizSession(
  input: CreateQuizSessionInput
): Promise<Result<QuizSessionRecord, AppError>> {
  try {
    const database = getDatabase();

    const result = await database.runAsync(
      `INSERT INTO quiz_sessions (question_type, total_questions, correct_count, started_at, completed_at, time_spent_seconds)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.questionType,
        input.totalQuestions,
        input.correctCount,
        input.startedAt,
        input.completedAt,
        input.timeSpentSeconds,
      ]
    );

    const inserted = await database.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM quiz_sessions WHERE id = ?',
      [result.lastInsertRowId]
    );

    if (!inserted) {
      return {
        success: false,
        error: databaseError('クイズセッションの保存に失敗しました。'),
      };
    }

    return {
      success: true,
      data: {
        id: inserted.id as number,
        questionType: inserted.question_type as 'en_to_ja' | 'ja_to_en' | 'mixed',
        totalQuestions: inserted.total_questions as number,
        correctCount: inserted.correct_count as number,
        startedAt: inserted.started_at as string,
        completedAt: inserted.completed_at as string | null,
        timeSpentSeconds: inserted.time_spent_seconds as number | null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: databaseError('クイズセッションの保存に失敗しました。', error),
    };
  }
}

/**
 * Get quiz statistics
 */
export async function getQuizStats(): Promise<Result<QuizStats, AppError>> {
  try {
    const database = getDatabase();

    // Get overall stats
    const overallStats = await database.getFirstAsync<{
      total: number;
      correct: number;
    }>(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
       FROM quiz_attempts`
    );

    // Get session count
    const sessionCount = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM quiz_sessions WHERE completed_at IS NOT NULL'
    );

    // Get average accuracy from sessions
    const avgAccuracy = await database.getFirstAsync<{ avg: number | null }>(
      `SELECT AVG(CAST(correct_count AS REAL) / total_questions * 100) as avg
       FROM quiz_sessions WHERE completed_at IS NOT NULL`
    );

    // Get weak words (words with accuracy < 50% and at least 3 attempts)
    const weakWordRows = await database.getAllAsync<Record<string, unknown>>(
      `SELECT
         w.*,
         COUNT(qa.id) as attempts,
         SUM(CASE WHEN qa.is_correct = 1 THEN 1 ELSE 0 END) as correct_count
       FROM words w
       INNER JOIN quiz_attempts qa ON w.id = qa.word_id
       GROUP BY w.id
       HAVING attempts >= 3 AND (CAST(correct_count AS REAL) / attempts) < 0.5
       ORDER BY (CAST(correct_count AS REAL) / attempts) ASC
       LIMIT 10`
    );

    // Get recent sessions
    const recentSessions = await database.getAllAsync<{
      completed_at: string;
      correct_count: number;
      total_questions: number;
    }>(
      `SELECT completed_at, correct_count, total_questions
       FROM quiz_sessions
       WHERE completed_at IS NOT NULL
       ORDER BY completed_at DESC
       LIMIT 10`
    );

    const totalAttempts = overallStats?.total ?? 0;
    const totalCorrect = overallStats?.correct ?? 0;

    return {
      success: true,
      data: {
        totalAttempts,
        totalCorrect,
        totalIncorrect: totalAttempts - totalCorrect,
        overallAccuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
        sessionsCompleted: sessionCount?.count ?? 0,
        averageAccuracy: Math.round(avgAccuracy?.avg ?? 0),
        weakWords: weakWordRows.map((row) => ({
          word: rowToWord(row),
          attempts: row.attempts as number,
          correctCount: row.correct_count as number,
          accuracy: Math.round(((row.correct_count as number) / (row.attempts as number)) * 100),
        })),
        recentSessions: recentSessions.map((s) => ({
          date: s.completed_at.split(' ')[0],
          accuracy: Math.round((s.correct_count / s.total_questions) * 100),
          questionCount: s.total_questions,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: databaseError('クイズ統計の取得に失敗しました。', error),
    };
  }
}

/**
 * Get count of words available for quiz
 * Only words with Japanese translation are counted
 */
export async function getQuizableWordCount(): Promise<Result<number, AppError>> {
  try {
    const database = getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM words
       WHERE japanese IS NOT NULL AND japanese != ''`
    );
    return { success: true, data: result?.count ?? 0 };
  } catch (error) {
    return {
      success: false,
      error: databaseError('クイズ可能な単語数の取得に失敗しました。', error),
    };
  }
}
