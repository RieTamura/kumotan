/**
 * useSentenceLookup Hook
 * Handles sentence-level analysis for both English and Japanese
 */

import { useState, useCallback } from 'react';
import { WordInfo, JapaneseWordInfo } from '../../../types/word';
import { lookupWord } from '../../../services/dictionary/freeDictionary';
import {
  translateToJapaneseWithFallback,
  ExtendedTranslateResult,
} from '../../../services/dictionary/translate';
import { analyzeMorphology, hasClientId as hasYahooClientId } from '../../../services/dictionary/yahooJapan';
import { extractEnglishWords } from '../../../utils/validators';
import { useWordStore } from '../../../store/wordStore';
import { LoadingState } from '../types';

export interface UseSentenceLookupResult {
  sentenceTranslation: ExtendedTranslateResult | null;
  wordsInfo: WordInfo[];
  sentenceError: string | null;
  loading: Pick<LoadingState, 'sentenceTranslation' | 'wordsInfo'>;
  translationAvailable: boolean;
  yahooClientIdAvailable: boolean;
  fetchEnglishSentence: (sentence: string) => Promise<void>;
  fetchJapaneseSentence: (sentence: string) => Promise<void>;
  removeWordFromList: (word: string) => void;
  reset: () => void;
}

/**
 * Helper: Convert JapaneseWordInfo to WordInfo for sentence mode
 */
function convertJapaneseInfoToWordInfo(tokens: JapaneseWordInfo[]): WordInfo[] {
  return tokens.map(token => ({
    word: token.word,
    japanese: token.reading,
    definition: `${token.partOfSpeech} - 基本形: ${token.baseForm}`,
    isRegistered: false,
    isSelected: true,
  }));
}

/**
 * Hook for sentence-level word lookup (English and Japanese)
 */
export function useSentenceLookup(): UseSentenceLookupResult {
  const [sentenceTranslation, setSentenceTranslation] = useState<ExtendedTranslateResult | null>(null);
  const [wordsInfo, setWordsInfo] = useState<WordInfo[]>([]);
  const [sentenceError, setSentenceError] = useState<string | null>(null);
  const [loading, setLoading] = useState<Pick<LoadingState, 'sentenceTranslation' | 'wordsInfo'>>({
    sentenceTranslation: false,
    wordsInfo: false,
  });
  const [translationAvailable, setTranslationAvailable] = useState(false);
  const [yahooClientIdAvailable, setYahooClientIdAvailable] = useState(false);

  const updateLoading = useCallback((key: 'sentenceTranslation' | 'wordsInfo', value: boolean) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setSentenceTranslation(null);
    setWordsInfo([]);
    setSentenceError(null);
    setLoading({ sentenceTranslation: false, wordsInfo: false });
  }, []);

  const removeWordFromList = useCallback((word: string) => {
    setWordsInfo((prev) => prev.filter((w) => w.word !== word));
  }, []);

  /**
   * Fetch data for English sentence
   */
  const fetchEnglishSentence = useCallback(async (sentence: string) => {
    // Reset errors
    setSentenceError(null);

    // 1. Translate the entire sentence (JMdict + DeepL fallback)
    updateLoading('sentenceTranslation', true);
    const sentenceResult = await translateToJapaneseWithFallback(sentence, { isWord: false });
    updateLoading('sentenceTranslation', false);

    if (sentenceResult.success) {
      setSentenceTranslation(sentenceResult.data);
      setTranslationAvailable(true);
    } else {
      setSentenceError(sentenceResult.error.message);
      setTranslationAvailable(false);
    }

    // 2. Extract words from sentence
    const words = extractEnglishWords(sentence);

    if (words.length === 0) {
      return;
    }

    // 3. Get registered words from store
    const registeredWords = useWordStore.getState().words;
    const registeredWordsSet = new Set(
      registeredWords.map(w => w.english.toLowerCase())
    );

    // 4. Fetch info for each word
    updateLoading('wordsInfo', true);

    const wordsInfoPromises = words.map(async (w): Promise<WordInfo> => {
      const isRegistered = registeredWordsSet.has(w.toLowerCase());

      // If already registered, don't fetch new data
      if (isRegistered) {
        const registeredWord = registeredWords.find(
          rw => rw.english.toLowerCase() === w.toLowerCase()
        );
        return {
          word: w,
          japanese: registeredWord?.japanese || null,
          definition: registeredWord?.definition || null,
          isRegistered: true,
          isSelected: false, // Will be set by user
        };
      }

      // Fetch new data (JMdict優先、DeepLフォールバック)
      const [defResult, transResult] = await Promise.all([
        lookupWord(w),
        translateToJapaneseWithFallback(w),
      ]);

      return {
        word: w,
        japanese: transResult.success ? transResult.data.text : null,
        definition: defResult.success ? defResult.data.definition : null,
        isRegistered: false,
        isSelected: !isRegistered, // Auto-select unregistered words
      };
    });

    const wordsInfoResults = await Promise.all(wordsInfoPromises);
    setWordsInfo(wordsInfoResults);
    updateLoading('wordsInfo', false);
  }, [updateLoading]);

  /**
   * Fetch data for Japanese sentence
   */
  const fetchJapaneseSentence = useCallback(async (sentence: string) => {
    // Reset errors
    setSentenceError(null);

    const hasYahooId = await hasYahooClientId();
    setYahooClientIdAvailable(hasYahooId);

    if (!hasYahooId) {
      return;
    }

    // Morphological analysis
    updateLoading('wordsInfo', true);
    const result = await analyzeMorphology(sentence);
    updateLoading('wordsInfo', false);

    if (result.success) {
      // Convert morphological analysis results to WordInfo
      const wordInfos = convertJapaneseInfoToWordInfo(result.data);

      // Get registered words from store
      const registeredWords = useWordStore.getState().words;
      const registeredWordsSet = new Set(
        registeredWords.map(w => w.english.toLowerCase())
      );

      // Mark registered words
      const markedWordInfos = wordInfos.map(info => {
        const isRegistered = registeredWordsSet.has(info.word.toLowerCase());
        if (isRegistered) {
          const registeredWord = registeredWords.find(
            rw => rw.english.toLowerCase() === info.word.toLowerCase()
          );
          return {
            ...info,
            isRegistered: true,
            japanese: registeredWord?.japanese || info.japanese,
            definition: registeredWord?.definition || info.definition,
            isSelected: false,
          };
        }
        return info;
      });

      setWordsInfo(markedWordInfos);
    } else {
      setSentenceError(result.error.message);
    }
  }, [updateLoading]);

  return {
    sentenceTranslation,
    wordsInfo,
    sentenceError,
    loading,
    translationAvailable,
    yahooClientIdAvailable,
    fetchEnglishSentence,
    fetchJapaneseSentence,
    removeWordFromList,
    reset,
  };
}
