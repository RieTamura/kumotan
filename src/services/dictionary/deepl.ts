/**
 * DeepL API Service
 * Handles Japanese translation using DeepL API Free
 */

import * as SecureStore from 'expo-secure-store';
import { Result } from '../../types/result';
import { TranslateResult } from '../../types/word';
import { AppError, ErrorCode } from '../../utils/errors';
import { API, STORAGE_KEYS, TIMEOUT, RATE_LIMIT } from '../../constants/config';
import { LRUCache, createCacheKey } from '../../utils/cache';

/**
 * Cache for translations (100 entries, 5 minute TTL)
 */
const translationCache = new LRUCache<TranslateResult>(100, 5 * 60 * 1000);

/**
 * DeepL API usage information
 */
export interface DeepLUsage {
  characterCount: number;
  characterLimit: number;
  usagePercentage: number;
}

/**
 * DeepL API response for translation
 */
interface DeepLTranslateResponse {
  translations: Array<{
    detected_source_language: string;
    text: string;
  }>;
}

/**
 * DeepL API response for usage
 */
interface DeepLUsageResponse {
  character_count: number;
  character_limit: number;
}

/**
 * Get stored DeepL API key
 */
export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.DEEPL_API_KEY);
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to get DeepL API key:', error);
    }
    return null;
  }
}

/**
 * Save DeepL API key to secure storage
 */
export async function saveApiKey(apiKey: string): Promise<Result<void, AppError>> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.DEEPL_API_KEY, apiKey);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        'API Keyの保存に失敗しました。',
        error
      ),
    };
  }
}

/**
 * Delete DeepL API key from secure storage
 */
export async function deleteApiKey(): Promise<Result<void, AppError>> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.DEEPL_API_KEY);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        'API Keyの削除に失敗しました。',
        error
      ),
    };
  }
}

/**
 * Check if DeepL API key is configured
 */
export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return key !== null && key.length > 0;
}

/**
 * Validate DeepL API key by making a test request
 */
export async function validateApiKey(apiKey: string): Promise<Result<DeepLUsage, AppError>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT.API_REQUEST);

    const response = await fetch(API.DEEPL.USAGE, {
      method: 'GET',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 403) {
        return {
          success: false,
          error: new AppError(
            ErrorCode.AUTH_FAILED,
            'API Keyが無効です。正しいKeyを入力してください。'
          ),
        };
      }
      if (response.status === 456) {
        return {
          success: false,
          error: new AppError(
            ErrorCode.QUOTA_EXCEEDED,
            '月間の翻訳文字数上限に達しています。'
          ),
        };
      }
      return {
        success: false,
        error: new AppError(
          ErrorCode.API_ERROR,
          `APIエラーが発生しました (${response.status})`
        ),
      };
    }

    const data: DeepLUsageResponse = await response.json();
    const usage: DeepLUsage = {
      characterCount: data.character_count,
      characterLimit: data.character_limit,
      usagePercentage: Math.round((data.character_count / data.character_limit) * 100),
    };

    return { success: true, data: usage };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: new AppError(ErrorCode.TIMEOUT, 'リクエストがタイムアウトしました。'),
      };
    }
    return {
      success: false,
      error: new AppError(
        ErrorCode.NETWORK_ERROR,
        'ネットワーク接続を確認してください。',
        error
      ),
    };
  }
}

/**
 * Get current API usage
 */
export async function getUsage(): Promise<Result<DeepLUsage, AppError>> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.AUTH_FAILED,
        'DeepL API Keyが設定されていません。'
      ),
    };
  }

  return validateApiKey(apiKey);
}

/**
 * Translate text from English to Japanese
 */
export async function translateToJapanese(
  text: string
): Promise<Result<TranslateResult, AppError>> {
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.AUTH_FAILED,
        'DeepL API Keyが設定されていません。設定画面からAPI Keyを登録してください。'
      ),
    };
  }

  // Validate input
  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.VALIDATION_ERROR,
        '翻訳するテキストを入力してください。'
      ),
    };
  }

  // Check text length (DeepL free has limits)
  if (text.length > 5000) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.VALIDATION_ERROR,
        'テキストが長すぎます（最大5000文字）。'
      ),
    };
  }

  // Check cache first
  const cacheKey = createCacheKey('translation', text.trim().toLowerCase());
  const cachedResult = translationCache.get(cacheKey);
  if (cachedResult) {
    if (__DEV__) {
      console.log(`Translation cache hit: "${text.substring(0, 30)}..."`);
    }
    return { success: true, data: cachedResult };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT.TRANSLATION);

    const response = await fetch(API.DEEPL.TRANSLATE, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: 'JA',
        source_lang: 'EN',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 403) {
        return {
          success: false,
          error: new AppError(
            ErrorCode.AUTH_FAILED,
            'API Keyが無効です。設定を確認してください。'
          ),
        };
      }
      if (response.status === 456) {
        return {
          success: false,
          error: new AppError(
            ErrorCode.QUOTA_EXCEEDED,
            '月間の翻訳文字数上限に達しました。来月まで翻訳機能は利用できません。'
          ),
        };
      }
      if (response.status === 429) {
        return {
          success: false,
          error: new AppError(
            ErrorCode.RATE_LIMIT,
            'リクエスト制限に達しました。しばらく待ってから再試行してください。'
          ),
        };
      }
      return {
        success: false,
        error: new AppError(
          ErrorCode.API_ERROR,
          `翻訳APIエラー (${response.status})`
        ),
      };
    }

    const data: DeepLTranslateResponse = await response.json();

    if (!data.translations || data.translations.length === 0) {
      return {
        success: false,
        error: new AppError(ErrorCode.API_ERROR, '翻訳結果が取得できませんでした。'),
      };
    }

    const translation = data.translations[0];
    const result: TranslateResult = {
      text: translation.text,
      detectedLanguage: translation.detected_source_language,
    };

    // Cache the result
    translationCache.set(cacheKey, result);

    if (__DEV__) {
      console.log(`Translated: "${text}" → "${result.text}"`);
    }

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: new AppError(ErrorCode.TIMEOUT, '翻訳リクエストがタイムアウトしました。'),
      };
    }
    return {
      success: false,
      error: new AppError(
        ErrorCode.NETWORK_ERROR,
        'ネットワーク接続を確認してください。',
        error
      ),
    };
  }
}

/**
 * Check if usage is near limit
 */
export function isUsageWarning(usage: DeepLUsage): boolean {
  return usage.usagePercentage >= RATE_LIMIT.DEEPL.WARNING_THRESHOLD;
}

/**
 * Check if usage is critical
 */
export function isUsageCritical(usage: DeepLUsage): boolean {
  return usage.usagePercentage >= RATE_LIMIT.DEEPL.CRITICAL_THRESHOLD;
}

/**
 * Format usage for display
 */
export function formatUsage(usage: DeepLUsage): string {
  const used = usage.characterCount.toLocaleString();
  const limit = usage.characterLimit.toLocaleString();
  return `${used} / ${limit} 文字 (${usage.usagePercentage}%)`;
}
