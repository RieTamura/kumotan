/**
 * Statistics related type definitions
 */

/**
 * Daily learning statistics for calendar display
 */
export interface DailyStats {
  date: string; // YYYY-MM-DD format
  wordsReadCount: number;
  quizCompleted: boolean;
}

/**
 * Overall statistics
 */
export interface Stats {
  totalWords: number;
  readWords: number;
  readPercentage: number;
  thisWeekDays: number;
  streak: number;
  todayCount: number;
}

/**
 * Calendar data for a specific month
 */
export interface CalendarData {
  year: number;
  month: number;
  days: DailyStats[];
}

/**
 * Statistics filter for querying
 */
export interface StatsFilter {
  startDate?: string;
  endDate?: string;
}
