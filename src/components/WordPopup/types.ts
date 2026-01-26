/**
 * WordPopup Component Types
 * Shared type definitions for WordPopup and its sub-components
 */

import { DictionaryResult, JapaneseWordInfo, WordInfo } from '../../types/word';
import { ExtendedTranslateResult } from '../../services/dictionary/translate';

/**
 * Props for WordPopup component
 */
export interface WordPopupProps {
  visible: boolean;
  word: string;
  isSentenceMode?: boolean;  // True if displaying a sentence instead of a word
  postUri?: string;
  postText?: string;
  onClose: () => void;
  onAddToWordList: (
    word: string,
    japanese: string | null,
    definition: string | null,
    postUri: string | null,
    postText: string | null
  ) => void;
}

/**
 * Props for SwipeableWordCard component
 */
export interface SwipeableWordCardProps {
  wordInfo: WordInfo;
  onRemove: () => void;
}

/**
 * Loading state for each API call
 */
export interface LoadingState {
  definition: boolean;
  translation: boolean;
  sentenceTranslation: boolean;
  wordsInfo: boolean;
  japanese: boolean;
}

/**
 * State for single word mode
 */
export interface WordModeState {
  definition: DictionaryResult | null;
  translation: ExtendedTranslateResult | null;
  japaneseInfo: JapaneseWordInfo[];
  definitionError: string | null;
  definitionNotFound: boolean;
  translationError: string | null;
  japaneseError: string | null;
}

/**
 * State for sentence mode
 */
export interface SentenceModeState {
  sentenceTranslation: ExtendedTranslateResult | null;
  wordsInfo: WordInfo[];
  sentenceError: string | null;
}

/**
 * Combined state for WordPopup reducer
 */
export interface WordPopupState extends WordModeState, SentenceModeState {
  loading: LoadingState;
  isAdding: boolean;
  isJapanese: boolean;
}

/**
 * Actions for WordPopup reducer
 */
export type WordPopupAction =
  | { type: 'RESET' }
  | { type: 'SET_LOADING'; key: keyof LoadingState; value: boolean }
  | { type: 'SET_DEFINITION'; definition: DictionaryResult | null }
  | { type: 'SET_TRANSLATION'; translation: ExtendedTranslateResult | null }
  | { type: 'SET_JAPANESE_INFO'; japaneseInfo: JapaneseWordInfo[] }
  | { type: 'SET_SENTENCE_TRANSLATION'; translation: ExtendedTranslateResult | null }
  | { type: 'SET_WORDS_INFO'; wordsInfo: WordInfo[] }
  | { type: 'SET_DEFINITION_ERROR'; error: string | null }
  | { type: 'SET_DEFINITION_NOT_FOUND'; notFound: boolean }
  | { type: 'SET_TRANSLATION_ERROR'; error: string | null }
  | { type: 'SET_JAPANESE_ERROR'; error: string | null }
  | { type: 'SET_SENTENCE_ERROR'; error: string | null }
  | { type: 'SET_IS_ADDING'; isAdding: boolean }
  | { type: 'SET_IS_JAPANESE'; isJapanese: boolean }
  | { type: 'REMOVE_WORD_FROM_LIST'; word: string };
