/**
 * useJapaneseMorphology Hook
 * Handles Japanese text morphological analysis
 */

import { useState, useCallback } from 'react';
import { JapaneseWordInfo } from '../../../types/word';
import { analyzeMorphology, hasClientId as hasYahooClientId } from '../../../services/dictionary/yahooJapan';

export interface UseJapaneseMorphologyResult {
  japaneseInfo: JapaneseWordInfo[];
  japaneseError: string | null;
  loading: boolean;
  yahooClientIdAvailable: boolean;
  fetchJapaneseData: (text: string) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for Japanese morphological analysis
 */
export function useJapaneseMorphology(): UseJapaneseMorphologyResult {
  const [japaneseInfo, setJapaneseInfo] = useState<JapaneseWordInfo[]>([]);
  const [japaneseError, setJapaneseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [yahooClientIdAvailable, setYahooClientIdAvailable] = useState(false);

  const reset = useCallback(() => {
    setJapaneseInfo([]);
    setJapaneseError(null);
    setLoading(false);
  }, []);

  const fetchJapaneseData = useCallback(async (text: string) => {
    // Reset previous state
    setJapaneseError(null);

    // Check if Yahoo Client ID is available
    const hasYahooId = await hasYahooClientId();
    setYahooClientIdAvailable(hasYahooId);

    if (!hasYahooId) {
      return;
    }

    // Fetch morphological analysis
    setLoading(true);
    const result = await analyzeMorphology(text);
    setLoading(false);

    if (result.success) {
      setJapaneseInfo(result.data);
    } else {
      setJapaneseError(result.error.message);
    }
  }, []);

  return {
    japaneseInfo,
    japaneseError,
    loading,
    yahooClientIdAvailable,
    fetchJapaneseData,
    reset,
  };
}
