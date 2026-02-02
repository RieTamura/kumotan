/**
 * クイズ関連の型定義
 */

import { Word } from './word';

/**
 * クイズの出題方式
 */
export type QuestionType = 'en_to_ja' | 'ja_to_en' | 'mixed';

/**
 * 出題数オプション
 */
export type QuestionCount = 5 | 10 | 20;

/**
 * クイズ設定
 */
export interface QuizSettings {
  questionType: QuestionType;
  questionCount: QuestionCount;
}

/**
 * 1つのクイズ問題
 */
export interface QuizQuestion {
  word: Word;
  /** この問題の実際の出題方式（mixedの場合は個別に決定） */
  questionType: 'en_to_ja' | 'ja_to_en';
  /** 表示する問題テキスト */
  question: string;
  /** 正解 */
  correctAnswer: string;
  /** 許容される代替回答（日本語訳が複数ある場合など） */
  alternativeAnswers?: string[];
}

/**
 * ユーザーの回答
 */
export interface QuizAnswer {
  questionIndex: number;
  wordId: number;
  questionType: 'en_to_ja' | 'ja_to_en';
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  answeredAt: string;
}

/**
 * クイズセッションの状態
 */
export interface QuizSession {
  id?: number;
  settings: QuizSettings;
  questions: QuizQuestion[];
  answers: QuizAnswer[];
  currentIndex: number;
  startedAt: string;
  completedAt?: string;
  timeSpentSeconds?: number;
}

/**
 * クイズ回答記録（データベースから取得）
 */
export interface QuizAttempt {
  id: number;
  wordId: number;
  questionType: 'en_to_ja' | 'ja_to_en';
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  answeredAt: string;
}

/**
 * クイズセッション記録（データベースから取得）
 */
export interface QuizSessionRecord {
  id: number;
  questionType: QuestionType;
  totalQuestions: number;
  correctCount: number;
  startedAt: string;
  completedAt: string | null;
  timeSpentSeconds: number | null;
}

/**
 * クイズ結果サマリー
 */
export interface QuizResult {
  sessionId: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  /** 正答率（0-100%） */
  accuracy: number;
  /** 間違えた単語リスト */
  incorrectWords: Array<{
    word: Word;
    userAnswer: string;
    correctAnswer: string;
  }>;
  timeSpentSeconds: number;
}

/**
 * クイズ統計（進捗画面表示用）
 */
export interface QuizStats {
  /** 総回答数 */
  totalAttempts: number;
  /** 正解数 */
  totalCorrect: number;
  /** 不正解数 */
  totalIncorrect: number;
  /** 全体正答率 */
  overallAccuracy: number;
  /** 完了セッション数 */
  sessionsCompleted: number;
  /** 平均正答率 */
  averageAccuracy: number;
  /** 苦手な単語リスト */
  weakWords: Array<{
    word: Word;
    attempts: number;
    correctCount: number;
    accuracy: number;
  }>;
  /** 最近のセッション履歴 */
  recentSessions: Array<{
    date: string;
    accuracy: number;
    questionCount: number;
  }>;
}

/**
 * クイズ回答の作成入力
 */
export interface CreateQuizAttemptInput {
  wordId: number;
  questionType: 'en_to_ja' | 'ja_to_en';
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

/**
 * クイズセッションの作成入力
 */
export interface CreateQuizSessionInput {
  questionType: QuestionType;
  totalQuestions: number;
  correctCount: number;
  startedAt: string;
  completedAt: string;
  timeSpentSeconds: number;
}
