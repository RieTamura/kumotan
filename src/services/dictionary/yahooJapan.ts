/**
 * Yahoo! JAPAN Text Analysis API Service
 * Handles Japanese word analysis, morphological parsing, and furigana
 */

import * as SecureStore from 'expo-secure-store';
import { Result } from '../../types/result';
import { AppError, ErrorCode } from '../../utils/errors';
import { STORAGE_KEYS, TIMEOUT } from '../../constants/config';

/**
 * Yahoo! JAPAN API endpoints
 */
const YAHOO_API = {
  MA: 'https://jlp.yahooapis.jp/MAService/V2/parse', // 形態素解析
  FURIGANA: 'https://jlp.yahooapis.jp/FuriganaService/V2/furigana', // ルビ振り
} as const;

/**
 * 形態素解析レスポンスの型定義
 */
interface MorphologicalAnalysisResponse {
  id: string;
  jsonrpc: string;
  result: {
    tokens: string[][]; // [表記, 読み, 基本形, 品詞, 品詞細分類, 活用型, 活用形]
  };
}

/**
 * ルビ振りレスポンスの型定義
 */
interface FuriganaWord {
  surface: string; // 表層形
  furigana: string; // ひらがなの読み
  roman?: string; // ローマ字（オプション）
}

interface FuriganaResponse {
  id: string;
  jsonrpc: string;
  result: {
    word: FuriganaWord[];
  };
}

/**
 * 日本語単語情報
 */
export interface JapaneseWordInfo {
  word: string; // 単語
  reading: string; // 読み（ひらがな）
  partOfSpeech: string; // 品詞
  baseForm: string; // 基本形
}

/**
 * Get stored Yahoo! Client ID
 */
export async function getClientId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.YAHOO_CLIENT_ID);
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to get Yahoo! Client ID:', error);
    }
    return null;
  }
}

/**
 * Save Yahoo! Client ID to secure storage
 */
export async function saveClientId(clientId: string): Promise<Result<void, AppError>> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.YAHOO_CLIENT_ID, clientId);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        'Yahoo! Client IDの保存に失敗しました。',
        error
      ),
    };
  }
}

/**
 * Delete Yahoo! Client ID from secure storage
 */
export async function deleteClientId(): Promise<Result<void, AppError>> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.YAHOO_CLIENT_ID);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        'Yahoo! Client IDの削除に失敗しました。',
        error
      ),
    };
  }
}

/**
 * Check if Yahoo! Client ID is configured
 */
export async function hasClientId(): Promise<boolean> {
  const id = await getClientId();
  return id !== null && id.length > 0;
}

/**
 * Validate Yahoo! Client ID by making a test request
 */
export async function validateClientId(clientId: string): Promise<Result<boolean, AppError>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT.API);

    // Client IDをURLパラメータとして追加
    const url = `${YAHOO_API.FURIGANA}?appid=${encodeURIComponent(clientId)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: '1',
        jsonrpc: '2.0',
        method: 'jlp.furiganaservice.furigana',
        params: {
          q: 'テスト',
          grade: 1,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 400 || response.status === 403) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.INVALID_API_KEY,
          'Yahoo! Client IDが無効です。正しいIDを入力してください。'
        ),
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.NETWORK_ERROR,
          `APIエラー: ${response.status} ${response.statusText}`
        ),
      };
    }

    return { success: true, data: true };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: new AppError(
          ErrorCode.NETWORK_ERROR,
          'リクエストがタイムアウトしました。'
        ),
      };
    }

    return {
      success: false,
      error: new AppError(
        ErrorCode.NETWORK_ERROR,
        'Yahoo! Client IDの検証に失敗しました。',
        error
      ),
    };
  }
}

/**
 * 形態素解析を実行
 */
export async function analyzeMorphology(
  text: string
): Promise<Result<JapaneseWordInfo[], AppError>> {
  try {
    const clientId = await getClientId();
    if (!clientId) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.INVALID_API_KEY,
          'Yahoo! Client IDが設定されていません。'
        ),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT.API);

    // Client IDをURLパラメータとして追加
    const url = `${YAHOO_API.MA}?appid=${encodeURIComponent(clientId)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: '1',
        jsonrpc: '2.0',
        method: 'jlp.maservice.parse',
        params: {
          q: text,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: new AppError(
            ErrorCode.RATE_LIMIT_EXCEEDED,
            'API利用制限に達しました。しばらく待ってから再試行してください。'
          ),
        };
      }

      const errorText = await response.text();
      console.error('Yahoo! MA API Error:', response.status, errorText);

      return {
        success: false,
        error: new AppError(
          ErrorCode.NETWORK_ERROR,
          `形態素解析APIエラー: ${response.status}`
        ),
      };
    }

    const data: MorphologicalAnalysisResponse = await response.json();

    if (!data.result || !data.result.tokens) {
      console.error('Invalid MA response structure:', data);
      return {
        success: false,
        error: new AppError(
          ErrorCode.PARSE_ERROR,
          '形態素解析の結果が不正です。'
        ),
      };
    }

    // トークン配列を変換
    // 各トークンは配列: [表記, 読み, 基本形, 品詞, 品詞細分類, 活用型, 活用形]
    const wordInfos: JapaneseWordInfo[] = data.result.tokens.map((token) => ({
      word: token[0],        // 表記
      reading: token[1],     // 読み
      baseForm: token[2],    // 基本形
      partOfSpeech: token[3], // 品詞
    }));

    return { success: true, data: wordInfos };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: new AppError(
          ErrorCode.NETWORK_ERROR,
          'リクエストがタイムアウトしました。'
        ),
      };
    }

    return {
      success: false,
      error: new AppError(
        ErrorCode.NETWORK_ERROR,
        '形態素解析に失敗しました。',
        error
      ),
    };
  }
}

/**
 * ルビ振りを実行
 */
export async function addFurigana(
  text: string,
  grade: number = 1
): Promise<Result<string, AppError>> {
  try {
    const clientId = await getClientId();
    if (!clientId) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.INVALID_API_KEY,
          'Yahoo! Client IDが設定されていません。'
        ),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT.API);

    // Client IDをURLパラメータとして追加
    const url = `${YAHOO_API.FURIGANA}?appid=${encodeURIComponent(clientId)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: '1',
        jsonrpc: '2.0',
        method: 'jlp.furiganaservice.furigana',
        params: {
          q: text,
          grade: grade,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: new AppError(
            ErrorCode.RATE_LIMIT_EXCEEDED,
            'API利用制限に達しました。しばらく待ってから再試行してください。'
          ),
        };
      }

      return {
        success: false,
        error: new AppError(
          ErrorCode.NETWORK_ERROR,
          `ルビ振りAPIエラー: ${response.status}`
        ),
      };
    }

    const data: FuriganaResponse = await response.json();

    if (!data.result || !data.result.word) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.PARSE_ERROR,
          'ルビ振りの結果が不正です。'
        ),
      };
    }

    // ルビ情報を整形して返す（表層形(読み)の形式）
    const furiganaText = data.result.word
      .map((w) => {
        if (w.furigana && w.furigana !== w.surface) {
          return `${w.surface}(${w.furigana})`;
        }
        return w.surface;
      })
      .join('');

    return { success: true, data: furiganaText };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: new AppError(
          ErrorCode.NETWORK_ERROR,
          'リクエストがタイムアウトしました。'
        ),
      };
    }

    return {
      success: false,
      error: new AppError(
        ErrorCode.NETWORK_ERROR,
        'ルビ振りに失敗しました。',
        error
      ),
    };
  }
}

/**
 * 日本語単語の詳細情報を取得（形態素解析から主要な情報を抽出）
 */
export async function getJapaneseWordInfo(
  text: string
): Promise<Result<JapaneseWordInfo, AppError>> {
  const result = await analyzeMorphology(text);

  if (!result.success) {
    console.error('analyzeMorphology failed:', result.error);
    return result;
  }

  // 最初の有意義なトークン（助詞や記号以外）を返す
  const mainToken = result.data.find(
    (token) =>
      !token.partOfSpeech.includes('助詞') &&
      !token.partOfSpeech.includes('記号') &&
      token.word.trim().length > 0
  );

  if (!mainToken) {
    console.error('No main token found in:', result.data);
    return {
      success: false,
      error: new AppError(
        ErrorCode.PARSE_ERROR,
        '有効な単語情報が見つかりませんでした。'
      ),
    };
  }

  return { success: true, data: mainToken };
}
