/**
 * Free Dictionary API Service
 * Handles English word definitions using the Free Dictionary API
 */

import { Result } from '../../types/result';
import { DictionaryResult } from '../../types/word';
import { AppError, ErrorCode } from '../../utils/errors';
import { API, TIMEOUT } from '../../constants/config';
import { LRUCache, createCacheKey } from '../../utils/cache';

/**
 * Cache for dictionary lookups (100 entries, 5 minute TTL)
 */
const dictionaryCache = new LRUCache<DictionaryResult>(100, 5 * 60 * 1000);

/**
 * Raw response from Free Dictionary API
 */
interface FreeDictionaryResponse {
  word: string;
  phonetic?: string;
  phonetics?: Array<{
    text?: string;
    audio?: string;
    sourceUrl?: string;
  }>;
  origin?: string;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }>;
    synonyms?: string[];
    antonyms?: string[];
  }>;
  license?: {
    name: string;
    url: string;
  };
  sourceUrls?: string[];
}

/**
 * Clean and normalize a word for lookup
 */
function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .trim()
    .replace(/[^\w\s'-]/g, '') // Remove special characters except hyphens and apostrophes
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Look up a word in the Free Dictionary API
 */
export async function lookupWord(
  word: string
): Promise<Result<DictionaryResult, AppError>> {
  // Validate input
  if (!word || word.trim().length === 0) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.VALIDATION_ERROR,
        '単語を入力してください。'
      ),
    };
  }

  const normalizedWord = normalizeWord(word);

  // Check if it's a valid word (basic validation)
  if (normalizedWord.length === 0 || normalizedWord.length > 50) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.VALIDATION_ERROR,
        '無効な単語です。'
      ),
    };
  }

  // Check cache first
  const cacheKey = createCacheKey('dictionary', normalizedWord);
  const cachedResult = dictionaryCache.get(cacheKey);
  if (cachedResult) {
    if (__DEV__) {
      console.log(`Dictionary cache hit: "${word}"`);
    }
    return { success: true, data: cachedResult };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT.API_REQUEST);

    const url = `${API.DICTIONARY.BASE_URL}/${encodeURIComponent(normalizedWord)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: new AppError(
            ErrorCode.WORD_NOT_FOUND,
            `"${word}" の定義が見つかりませんでした。`
          ),
        };
      }
      return {
        success: false,
        error: new AppError(
          ErrorCode.API_ERROR,
          `辞書APIエラー (${response.status})`
        ),
      };
    }

    const data: FreeDictionaryResponse[] = await response.json();

    if (!data || data.length === 0) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.WORD_NOT_FOUND,
          `"${word}" の定義が見つかりませんでした。`
        ),
      };
    }

    // Parse the first result
    const entry = data[0];
    const result = parseFreeDictionaryResponse(entry);

    // Cache the result
    dictionaryCache.set(cacheKey, result);

    if (__DEV__) {
      console.log(`Dictionary lookup: "${word}" → "${result.definition}"`);
    }

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: new AppError(ErrorCode.TIMEOUT, '辞書検索がタイムアウトしました。'),
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
 * Look up multiple words at once
 */
export async function lookupWords(
  words: string[]
): Promise<Map<string, Result<DictionaryResult, AppError>>> {
  const results = new Map<string, Result<DictionaryResult, AppError>>();

  // Process in parallel with a limit to avoid rate limiting
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (word) => {
        const result = await lookupWord(word);
        return { word, result };
      })
    );

    for (const { word, result } of batchResults) {
      results.set(word.toLowerCase(), result);
    }

    // Small delay between batches to be nice to the API
    if (i + BATCH_SIZE < words.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Parse Free Dictionary API response into our format
 */
function parseFreeDictionaryResponse(entry: FreeDictionaryResponse): DictionaryResult {
  // Get the first definition from the first meaning
  const firstMeaning = entry.meanings[0];
  const firstDefinition = firstMeaning?.definitions[0];

  // Find audio URL (prefer one with actual audio)
  const audioUrl = entry.phonetics?.find((p) => p.audio && p.audio.length > 0)?.audio;

  // Get phonetic text
  const phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text;

  return {
    word: entry.word,
    phonetic: phonetic,
    definition: firstDefinition?.definition || 'No definition available',
    example: firstDefinition?.example,
    partOfSpeech: firstMeaning?.partOfSpeech || 'unknown',
    audio: audioUrl,
  };
}

/**
 * Get all meanings for a word (for detailed view)
 */
export async function getDetailedDefinition(
  word: string
): Promise<Result<DictionaryResult[], AppError>> {
  // Validate input
  if (!word || word.trim().length === 0) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.VALIDATION_ERROR,
        '単語を入力してください。'
      ),
    };
  }

  const normalizedWord = normalizeWord(word);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT.API_REQUEST);

    const url = `${API.DICTIONARY.BASE_URL}/${encodeURIComponent(normalizedWord)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: new AppError(
            ErrorCode.WORD_NOT_FOUND,
            `"${word}" の定義が見つかりませんでした。`
          ),
        };
      }
      return {
        success: false,
        error: new AppError(
          ErrorCode.API_ERROR,
          `辞書APIエラー (${response.status})`
        ),
      };
    }

    const data: FreeDictionaryResponse[] = await response.json();

    if (!data || data.length === 0) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.WORD_NOT_FOUND,
          `"${word}" の定義が見つかりませんでした。`
        ),
      };
    }

    // Parse all meanings from all entries
    const results: DictionaryResult[] = [];
    
    for (const entry of data) {
      const phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text;
      const audioUrl = entry.phonetics?.find((p) => p.audio && p.audio.length > 0)?.audio;

      for (const meaning of entry.meanings) {
        for (const def of meaning.definitions) {
          results.push({
            word: entry.word,
            phonetic,
            definition: def.definition,
            example: def.example,
            partOfSpeech: meaning.partOfSpeech,
            audio: audioUrl,
          });
        }
      }
    }

    return { success: true, data: results };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: new AppError(ErrorCode.TIMEOUT, '辞書検索がタイムアウトしました。'),
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
 * Check if a string looks like an English word
 */
export function isEnglishWord(text: string): boolean {
  // Basic check: contains only English letters, hyphens, apostrophes
  const englishWordPattern = /^[a-zA-Z][a-zA-Z'-]*[a-zA-Z]$|^[a-zA-Z]$/;
  return englishWordPattern.test(text.trim());
}

/**
 * Extract potential English words from a text
 */
export function extractWords(text: string): string[] {
  // Match words that look like English words
  const wordPattern = /\b[a-zA-Z][a-zA-Z'-]*[a-zA-Z]\b|\b[a-zA-Z]\b/g;
  const matches = text.match(wordPattern) || [];
  
  // Remove duplicates and filter out very short words
  const uniqueWords = [...new Set(matches.map((w) => w.toLowerCase()))];
  
  return uniqueWords.filter((word) => word.length >= 2);
}
