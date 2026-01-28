/**
 * useJapaneseToEnglish Hook
 * Handles Japanese to English translation lookup
 */

import { useState, useCallback } from 'react';
import {
  translateToEnglishWithFallback,
  ExtendedTranslateResult,
} from '../../../services/dictionary/translate';

export interface UseJapaneseToEnglishResult {
  englishTranslation: ExtendedTranslateResult | null;
  translationError: string | null;
  loading: boolean;
  translationAvailable: boolean;
  fetchEnglishTranslation: (text: string) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for looking up English translation of Japanese text
 */
export function useJapaneseToEnglish(): UseJapaneseToEnglishResult {
  const [englishTranslation, setEnglishTranslation] = useState<ExtendedTranslateResult | null>(
    null
  );
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [translationAvailable, setTranslationAvailable] = useState(false);

  const reset = useCallback(() => {
    setEnglishTranslation(null);
    setTranslationError(null);
    setLoading(false);
    setTranslationAvailable(false);
  }, []);

  const fetchEnglishTranslation = useCallback(async (text: string) => {
    // Reset previous state
    setTranslationError(null);
    setEnglishTranslation(null);

    setLoading(true);
    const result = await translateToEnglishWithFallback(text);
    setLoading(false);

    if (result.success) {
      setEnglishTranslation(result.data);
      setTranslationAvailable(true);
    } else {
      setTranslationError(result.error.message);
      setTranslationAvailable(false);
    }
  }, []);

  return {
    englishTranslation,
    translationError,
    loading,
    translationAvailable,
    fetchEnglishTranslation,
    reset,
  };
}
