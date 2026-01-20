/**
 * 単語関連の型定義
 */

/**
 * 単語データ
 */
export interface Word {
  id: number;
  english: string;
  japanese: string | null;
  definition: string | null;
  postUrl: string | null;
  postText: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

/**
 * 単語の新規作成用データ
 */
export interface CreateWordInput {
  english: string;
  japanese?: string | null;
  definition?: string | null;
  postUrl?: string | null;
  postText?: string | null;
}

/**
 * 単語一覧のフィルター条件
 */
export interface WordFilter {
  isRead?: boolean | null;
  sortBy: 'created_at' | 'english';
  sortOrder: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * 辞書API（Free Dictionary）のレスポンス
 */
export interface DictionaryResult {
  word: string;
  phonetic?: string;
  definition: string;
  example?: string;
  partOfSpeech: string;
  audio?: string;
}

/**
 * 翻訳API（DeepL）のレスポンス
 */
export interface TranslateResult {
  text: string;
  detectedLanguage: string;
}

/**
 * DeepL API使用量情報
 */
export interface UsageInfo {
  used: number;
  limit: number;
  percentage: number;
  remaining: number;
}

/**
 * Yahoo! JAPAN API - 日本語単語情報
 */
export interface JapaneseWordInfo {
  word: string; // 単語
  reading: string; // 読み（ひらがな）
  partOfSpeech: string; // 品詞
  baseForm: string; // 基本形
}

/**
 * 単語情報（文章モード用）
 */
export interface WordInfo {
  word: string;
  japanese: string | null;
  definition: string | null;
  isRegistered: boolean;
  isSelected: boolean;
}

/**
 * 学習セッション記録
 */
export interface LearningSession {
  date: string; // YYYY-MM-DD形式
  wordsLearned: number;
  timeSpent: number; // 秒数
  achievement?: string;
  visibility: 'public' | 'private';
  createdAt: string; // ISO 8601形式
}

/**
 * 学習セッション作成用の入力データ
 */
export interface CreateLearningSessionInput {
  date: string;
  wordsLearned: number;
  timeSpent: number;
  achievement?: string;
  visibility?: 'public' | 'private';
}

/**
 * 画像のアスペクト比
 */
export interface ImageAspectRatio {
  width: number;
  height: number;
}
