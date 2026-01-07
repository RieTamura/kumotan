/**
 * useWordLookup Hook
 * Handles English word lookup (definition + translation)
 */

import { useState, useCallback } from 'react';
import { DictionaryResult, TranslateResult } from '../../../types/word';
import { lookupWord } from '../../../services/dictionary/freeDictionary';
import { translateToJapanese, hasApiKey } from '../../../services/dictionary/deepl';
import { LoadingState } from '../types';

export interface UseWordLookupResult {
  definition: DictionaryResult | null;
  translation: TranslateResult | null;
  definitionError: string | null;
  definitionNotFound: boolean;
  translationError: string | null;
  loading: Pick<LoadingState, 'definition' | 'translation'>;
  apiKeyAvailable: boolean;
  fetchWordData: (word: string) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for looking up English word definition and translation
 */
export function useWordLookup(): UseWordLookupResult {
  const [definition, setDefinition] = useState<DictionaryResult | null>(null);
  const [translation, setTranslation] = useState<TranslateResult | null>(null);
  const [definitionError, setDefinitionError] = useState<string | null>(null);
  const [definitionNotFound, setDefinitionNotFound] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [loading, setLoading] = useState<Pick<LoadingState, 'definition' | 'translation'>>({
    definition: false,
    translation: false,
  });
  const [apiKeyAvailable, setApiKeyAvailable] = useState(false);

  const updateLoading = useCallback((key: 'definition' | 'translation', value: boolean) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setDefinition(null);
    setTranslation(null);
    setDefinitionError(null);
    setDefinitionNotFound(false);
    setTranslationError(null);
    setLoading({ definition: false, translation: false });
  }, []);

  const fetchWordData = useCallback(async (word: string) => {
    // Reset previous state
    setDefinitionError(null);
    setDefinitionNotFound(false);
    setTranslationError(null);

    // Fetch dictionary definition
    updateLoading('definition', true);

    try {
      const defResult = await lookupWord(word);
      updateLoading('definition', false);

      if (defResult.success) {
        setDefinition(defResult.data);
      } else {
        // Handle "word not found" gracefully
        if (defResult.error.code === 'WORD_NOT_FOUND') {
          setDefinitionNotFound(true);
        } else {
          setDefinitionError(defResult.error.message);
        }
      }
    } catch (error) {
      updateLoading('definition', false);
      setDefinitionError('予期しないエラーが発生しました');
    }

    // Fetch translation (only if API key is set)
    const hasKey = await hasApiKey();
    setApiKeyAvailable(hasKey);

    if (hasKey) {
      updateLoading('translation', true);
      const transResult = await translateToJapanese(word);
      updateLoading('translation', false);

      if (transResult.success) {
        setTranslation(transResult.data);
      } else {
        setTranslationError(transResult.error.message);
      }
    }
  }, [updateLoading]);

  return {
    definition,
    translation,
    definitionError,
    definitionNotFound,
    translationError,
    loading,
    apiKeyAvailable,
    fetchWordData,
    reset,
  };
}
