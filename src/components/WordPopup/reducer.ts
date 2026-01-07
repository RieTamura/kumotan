/**
 * WordPopup State Reducer
 * Centralized state management for WordPopup component
 */

import { WordPopupState, WordPopupAction } from './types';

/**
 * Initial state for WordPopup
 */
export const initialState: WordPopupState = {
  // Word mode state
  definition: null,
  translation: null,
  japaneseInfo: [],
  definitionError: null,
  definitionNotFound: false,
  translationError: null,
  japaneseError: null,

  // Sentence mode state
  sentenceTranslation: null,
  wordsInfo: [],
  sentenceError: null,

  // Common state
  loading: {
    definition: false,
    translation: false,
    sentenceTranslation: false,
    wordsInfo: false,
    japanese: false,
  },
  isAdding: false,
  isJapanese: false,
};

/**
 * Reducer for WordPopup state
 */
export function wordPopupReducer(
  state: WordPopupState,
  action: WordPopupAction
): WordPopupState {
  switch (action.type) {
    case 'RESET':
      return initialState;

    case 'SET_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.key]: action.value,
        },
      };

    case 'SET_DEFINITION':
      return {
        ...state,
        definition: action.definition,
        definitionError: null,
        definitionNotFound: false,
      };

    case 'SET_TRANSLATION':
      return {
        ...state,
        translation: action.translation,
        translationError: null,
      };

    case 'SET_JAPANESE_INFO':
      return {
        ...state,
        japaneseInfo: action.japaneseInfo,
        japaneseError: null,
      };

    case 'SET_SENTENCE_TRANSLATION':
      return {
        ...state,
        sentenceTranslation: action.translation,
        sentenceError: null,
      };

    case 'SET_WORDS_INFO':
      return {
        ...state,
        wordsInfo: action.wordsInfo,
      };

    case 'SET_DEFINITION_ERROR':
      return {
        ...state,
        definitionError: action.error,
        definition: null,
      };

    case 'SET_DEFINITION_NOT_FOUND':
      return {
        ...state,
        definitionNotFound: action.notFound,
        definitionError: null,
      };

    case 'SET_TRANSLATION_ERROR':
      return {
        ...state,
        translationError: action.error,
        translation: null,
      };

    case 'SET_JAPANESE_ERROR':
      return {
        ...state,
        japaneseError: action.error,
        japaneseInfo: [],
      };

    case 'SET_SENTENCE_ERROR':
      return {
        ...state,
        sentenceError: action.error,
      };

    case 'SET_IS_ADDING':
      return {
        ...state,
        isAdding: action.isAdding,
      };

    case 'SET_IS_JAPANESE':
      return {
        ...state,
        isJapanese: action.isJapanese,
      };

    case 'REMOVE_WORD_FROM_LIST':
      return {
        ...state,
        wordsInfo: state.wordsInfo.filter(w => w.word !== action.word),
      };

    default:
      return state;
  }
}
