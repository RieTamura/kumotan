/**
 * 統合翻訳サービス
 *
 * JMdict辞書とDeepL APIを組み合わせた翻訳機能を提供します。
 *
 * フォールバック戦略:
 * 1. JMdict辞書で検索（オフライン、高速、単語に最適）
 * 2. DeepL APIで翻訳（オンライン、文章に最適）
 */

import { Result } from '../../types/result';
import { TranslateResult, JMdictTranslateResult, JMdictReverseTranslateResult } from '../../types/word';
import { AppError, ErrorCode } from '../../utils/errors';
import {
  translateToJapanese as translateWithDeepL,
  translateToEnglish as translateWithDeepLToEnglish,
  hasApiKey as hasDeepLApiKey,
} from './deepl';
import {
  translateWithJMdict,
  translateWithJMdictReverse,
  isJMdictAvailable,
  initJMdictDatabase,
} from './jmdict';
import { containsJapanese } from '../../utils/japanese';

/**
 * 翻訳ソースの種類
 */
export type TranslationSource = 'jmdict' | 'deepl' | 'none';

/**
 * 拡張翻訳結果
 */
export interface ExtendedTranslateResult {
  text: string;
  source: TranslationSource;
  readings?: string[];
  partOfSpeech?: string[];
  isCommon?: boolean;
  detectedLanguage?: string;
}

/**
 * 翻訳オプション
 */
export interface TranslateOptions {
  /**
   * JMdictを優先的に使用するか（デフォルト: true）
   */
  preferJMdict?: boolean;

  /**
   * JMdictで見つからない場合にDeepLにフォールバックするか（デフォルト: true）
   */
  fallbackToDeepL?: boolean;

  /**
   * 単語レベルの翻訳か（trueの場合JMdictを優先）
   */
  isWord?: boolean;
}

/**
 * テキストが単語レベルかどうかを判定
 */
function isWordLevel(text: string): boolean {
  const trimmed = text.trim();
  // スペースがない、または2語以下
  const words = trimmed.split(/\s+/);
  return words.length <= 2;
}

/**
 * 英語から日本語に翻訳（統合版）
 *
 * 1. 単語の場合: JMdict → DeepL（フォールバック）
 * 2. 文章の場合: DeepL → JMdictは使用しない
 *
 * @param text 翻訳するテキスト
 * @param options 翻訳オプション
 * @returns 翻訳結果
 */
export async function translateToJapaneseWithFallback(
  text: string,
  options: TranslateOptions = {}
): Promise<Result<ExtendedTranslateResult, AppError>> {
  const {
    preferJMdict = true,
    fallbackToDeepL = true,
    isWord = isWordLevel(text),
  } = options;

  const trimmedText = text.trim();

  if (!trimmedText) {
    return {
      success: false,
      error: new AppError(ErrorCode.VALIDATION_ERROR, '翻訳するテキストを入力してください。'),
    };
  }

  // 単語レベルでJMdictを優先する場合
  if (isWord && preferJMdict) {
    // JMdict初期化を試みる
    const jmdictAvailable = await isJMdictAvailable();
    if (!jmdictAvailable) {
      await initJMdictDatabase();
    }

    // JMdict検索
    const jmdictResult = await translateWithJMdict(trimmedText);

    if (jmdictResult.success) {
      return {
        success: true,
        data: {
          text: jmdictResult.data.text,
          source: 'jmdict',
          readings: jmdictResult.data.readings,
          partOfSpeech: jmdictResult.data.partOfSpeech,
          isCommon: jmdictResult.data.isCommon,
        },
      };
    }

    // JMdictで見つからない場合、DeepLにフォールバック
    if (fallbackToDeepL && jmdictResult.error.code === ErrorCode.WORD_NOT_FOUND) {
      if (__DEV__) {
        console.log(`JMdict not found, falling back to DeepL: "${trimmedText}"`);
      }
      // DeepLへフォールスルー
    } else if (!fallbackToDeepL) {
      // フォールバック無効の場合はJMdictのエラーを返す
      return { success: false, error: jmdictResult.error };
    } else {
      // データベースエラーなどの場合もDeepLを試す
      if (__DEV__) {
        console.log(`JMdict error, trying DeepL: ${jmdictResult.error.message}`);
      }
    }
  }

  // DeepL APIで翻訳
  const hasDeepL = await hasDeepLApiKey();
  if (!hasDeepL) {
    // DeepLが利用不可で、JMdictも失敗した場合
    if (isWord && preferJMdict) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.WORD_NOT_FOUND,
          `「${trimmedText}」の翻訳が見つかりませんでした。DeepL API Keyを設定すると、より多くの単語を翻訳できます。`
        ),
      };
    }

    return {
      success: false,
      error: new AppError(
        ErrorCode.AUTH_FAILED,
        'DeepL API Keyが設定されていません。設定画面からAPI Keyを登録してください。'
      ),
    };
  }

  const deeplResult = await translateWithDeepL(trimmedText);

  if (deeplResult.success) {
    return {
      success: true,
      data: {
        text: deeplResult.data.text,
        source: 'deepl',
        detectedLanguage: deeplResult.data.detectedLanguage,
      },
    };
  }

  return { success: false, error: deeplResult.error };
}

/**
 * 翻訳サービスの状態を取得
 */
export async function getTranslationServiceStatus(): Promise<{
  jmdict: {
    available: boolean;
    initialized: boolean;
  };
  deepl: {
    available: boolean;
    apiKeyConfigured: boolean;
  };
}> {
  const jmdictAvailable = await isJMdictAvailable();
  const deeplConfigured = await hasDeepLApiKey();

  return {
    jmdict: {
      available: jmdictAvailable,
      initialized: jmdictAvailable,
    },
    deepl: {
      available: deeplConfigured,
      apiKeyConfigured: deeplConfigured,
    },
  };
}

/**
 * 推奨される翻訳ソースを取得
 *
 * @param text 翻訳するテキスト
 * @returns 推奨される翻訳ソース
 */
export async function getRecommendedSource(text: string): Promise<TranslationSource> {
  const isWord = isWordLevel(text);
  const jmdictAvailable = await isJMdictAvailable();
  const deeplAvailable = await hasDeepLApiKey();

  if (isWord && jmdictAvailable) {
    return 'jmdict';
  }

  if (deeplAvailable) {
    return 'deepl';
  }

  if (jmdictAvailable) {
    return 'jmdict';
  }

  return 'none';
}

/**
 * 日本語から英語に翻訳（統合版）
 *
 * 1. 単語の場合: JMdict逆引き → DeepL（フォールバック）
 * 2. 文章の場合: DeepL → JMdictは使用しない
 *
 * @param text 翻訳するテキスト（日本語）
 * @param options 翻訳オプション
 * @returns 翻訳結果
 */
export async function translateToEnglishWithFallback(
  text: string,
  options: TranslateOptions = {}
): Promise<Result<ExtendedTranslateResult, AppError>> {
  const {
    preferJMdict = true,
    fallbackToDeepL = true,
    isWord = isWordLevel(text),
  } = options;

  const trimmedText = text.trim();

  if (!trimmedText) {
    return {
      success: false,
      error: new AppError(ErrorCode.VALIDATION_ERROR, '翻訳するテキストを入力してください。'),
    };
  }

  // 入力が日本語かどうか確認
  if (!containsJapanese(trimmedText)) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.VALIDATION_ERROR,
        '日本語のテキストを入力してください。'
      ),
    };
  }

  // 単語レベルでJMdictを優先する場合
  if (isWord && preferJMdict) {
    // JMdict初期化を試みる
    const jmdictAvailable = await isJMdictAvailable();
    if (!jmdictAvailable) {
      await initJMdictDatabase();
    }

    // JMdict逆引き検索
    const jmdictResult = await translateWithJMdictReverse(trimmedText);

    if (jmdictResult.success) {
      return {
        success: true,
        data: {
          text: jmdictResult.data.text,
          source: 'jmdict',
          readings: jmdictResult.data.reading ? [jmdictResult.data.reading] : undefined,
          partOfSpeech: jmdictResult.data.partOfSpeech,
          isCommon: jmdictResult.data.isCommon,
        },
      };
    }

    // JMdictで見つからない場合、DeepLにフォールバック
    if (fallbackToDeepL && jmdictResult.error.code === ErrorCode.WORD_NOT_FOUND) {
      if (__DEV__) {
        console.log(`JMdict reverse not found, falling back to DeepL: "${trimmedText}"`);
      }
      // DeepLへフォールスルー
    } else if (!fallbackToDeepL) {
      // フォールバック無効の場合はJMdictのエラーを返す
      return { success: false, error: jmdictResult.error };
    } else {
      // データベースエラーなどの場合もDeepLを試す
      if (__DEV__) {
        console.log(`JMdict reverse error, trying DeepL: ${jmdictResult.error.message}`);
      }
    }
  }

  // DeepL APIで翻訳
  const hasDeepL = await hasDeepLApiKey();
  if (!hasDeepL) {
    // DeepLが利用不可で、JMdictも失敗した場合
    if (isWord && preferJMdict) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.WORD_NOT_FOUND,
          `「${trimmedText}」の翻訳が見つかりませんでした。DeepL API Keyを設定すると、より多くの単語を翻訳できます。`
        ),
      };
    }

    return {
      success: false,
      error: new AppError(
        ErrorCode.AUTH_FAILED,
        'DeepL API Keyが設定されていません。設定画面からAPI Keyを登録してください。'
      ),
    };
  }

  const deeplResult = await translateWithDeepLToEnglish(trimmedText);

  if (deeplResult.success) {
    return {
      success: true,
      data: {
        text: deeplResult.data.text,
        source: 'deepl',
        detectedLanguage: deeplResult.data.detectedLanguage,
      },
    };
  }

  return { success: false, error: deeplResult.error };
}

/**
 * テキストの言語を検出して適切な翻訳方向を決定
 *
 * @param text 翻訳するテキスト
 * @returns 翻訳方向（'ja-to-en' | 'en-to-ja'）
 */
export function detectTranslationDirection(text: string): 'ja-to-en' | 'en-to-ja' {
  return containsJapanese(text) ? 'ja-to-en' : 'en-to-ja';
}

/**
 * テキストを自動検出して翻訳（統合版）
 *
 * 入力テキストの言語を自動検出し、適切な方向に翻訳します。
 * - 日本語 → 英語
 * - 英語 → 日本語
 *
 * @param text 翻訳するテキスト
 * @param options 翻訳オプション
 * @returns 翻訳結果
 */
export async function translateWithAutoDetect(
  text: string,
  options: TranslateOptions = {}
): Promise<Result<ExtendedTranslateResult, AppError>> {
  const direction = detectTranslationDirection(text);

  if (direction === 'ja-to-en') {
    return translateToEnglishWithFallback(text, options);
  } else {
    return translateToJapaneseWithFallback(text, options);
  }
}
