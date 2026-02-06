/**
 * useWordRegistration Hook
 * Manages word registration and sentence mode logic for vocabulary building from posts.
 * Extracted from HomeScreen to enable reuse across multiple screens.
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { addWord } from '../services/database/words';

/**
 * Word popup state interface
 */
export interface WordPopupState {
  visible: boolean;
  word: string;
  isSentenceMode: boolean;
  postUri: string;
  postText: string;
}

const initialWordPopupState: WordPopupState = {
  visible: false,
  word: '',
  isSentenceMode: false,
  postUri: '',
  postText: '',
};

export interface UseWordRegistrationReturn {
  wordPopup: WordPopupState;
  handleWordSelect: (word: string, postUri: string, postText: string) => void;
  handleSentenceSelect: (sentence: string, postUri: string, postText: string) => void;
  closeWordPopup: () => void;
  handleAddWord: (
    word: string,
    japanese: string | null,
    definition: string | null,
    postUri: string | null,
    postText: string | null
  ) => void;
}

/**
 * Custom hook for word registration and sentence mode functionality.
 * Provides state and callbacks for WordPopup and PostCard integration.
 */
export function useWordRegistration(): UseWordRegistrationReturn {
  const { t } = useTranslation('home');
  const { t: tc } = useTranslation('common');

  const [wordPopup, setWordPopup] = useState<WordPopupState>(initialWordPopupState);

  /**
   * Handle word selection from a post
   */
  const handleWordSelect = useCallback(
    (word: string, postUri: string, postText: string) => {
      setWordPopup({
        visible: true,
        word: word.toLowerCase(),
        isSentenceMode: false,
        postUri,
        postText,
      });
    },
    []
  );

  /**
   * Handle sentence selection from a post
   */
  const handleSentenceSelect = useCallback(
    (sentence: string, postUri: string, postText: string) => {
      setWordPopup({
        visible: true,
        word: sentence,
        isSentenceMode: true,
        postUri,
        postText,
      });
    },
    []
  );

  /**
   * Close word popup with delayed reset for PostCard clearSelection
   */
  const closeWordPopup = useCallback(() => {
    // Keep postUri to allow PostCard to clear selection before full reset
    setWordPopup(prev => ({ ...prev, visible: false }));

    // Reset postUri after a short delay to allow PostCard to process clearSelection
    setTimeout(() => {
      setWordPopup(() => ({ ...initialWordPopupState }));
    }, 100);
  }, []);

  /**
   * Handle add word to vocabulary
   */
  const handleAddWord = useCallback(
    async (
      word: string,
      japanese: string | null,
      definition: string | null,
      postUri: string | null,
      postText: string | null
    ) => {
      try {
        const result = await addWord(
          word,
          japanese ?? undefined,
          definition ?? undefined,
          postUri ?? undefined,
          postText ?? undefined
        );

        if (result.success) {
          Alert.alert(tc('status.success'), t('wordAdded'));
        } else {
          Alert.alert(tc('status.error'), result.error.message);
        }
      } catch (error) {
        Alert.alert(tc('status.error'), t('wordAddError'));
        console.error('Failed to add word:', error);
      }
    },
    [t, tc]
  );

  return {
    wordPopup,
    handleWordSelect,
    handleSentenceSelect,
    closeWordPopup,
    handleAddWord,
  };
}
