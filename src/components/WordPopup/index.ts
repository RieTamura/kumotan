/**
 * WordPopup Module Exports
 * Centralized exports for WordPopup components and hooks
 */

// Types
export type {
  WordPopupProps,
  SwipeableWordCardProps,
  LoadingState,
  WordModeState,
  SentenceModeState,
  WordPopupState,
  WordPopupAction,
} from './types';

// Components
export { WordPopupModal } from './WordPopupModal';
export { SwipeableWordCard } from './components/SwipeableWordCard';

// Hooks
export { useWordLookup } from './hooks/useWordLookup';
export { useJapaneseMorphology } from './hooks/useJapaneseMorphology';
export { useSentenceLookup } from './hooks/useSentenceLookup';

export type { UseWordLookupResult } from './hooks/useWordLookup';
export type { UseJapaneseMorphologyResult } from './hooks/useJapaneseMorphology';
export type { UseSentenceLookupResult } from './hooks/useSentenceLookup';

// Reducer
export { wordPopupReducer, initialState } from './reducer';
