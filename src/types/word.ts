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
  searchQuery?: string;
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

/**
 * JMdict辞書エントリ
 */
export interface JMdictEntry {
  id: number;
  kanji: string | null;
  kana: string;
  isCommon: boolean;
  priority: number;
}

/**
 * JMdict検索結果（意味を含む）
 */
export interface JMdictResult {
  entry: JMdictEntry;
  glosses: JMdictGloss[];
}

/**
 * JMdict意味（英語→日本語検索用）
 */
export interface JMdictGloss {
  id: number;
  entryId: number;
  gloss: string;
  partOfSpeech: string;
  senseIndex: number;
}

/**
 * JMdict翻訳結果（TranslateResultと互換）
 */
export interface JMdictTranslateResult {
  text: string;
  readings: string[];
  partOfSpeech: string[];
  isCommon: boolean;
  /** 'jmdict' = 通常の辞書検索, 'override' = フィードバックからの修正適用 */
  source: 'jmdict' | 'override';
}

/**
 * JMdict逆引き検索結果（日本語→英語）
 */
export interface JMdictReverseResult {
  entry: JMdictEntry;
  englishGlosses: string[];
  partOfSpeech: string[];
}

/**
 * JMdict逆引き翻訳結果（日本語→英語翻訳用）
 */
export interface JMdictReverseTranslateResult {
  text: string;
  originalJapanese: string;
  reading?: string;
  partOfSpeech: string[];
  isCommon: boolean;
  source: 'jmdict';
}
