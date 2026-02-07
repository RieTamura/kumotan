/**
 * Word Store
 * Manages word list state using Zustand
 */

import { create } from 'zustand';
import { Word, WordFilter, CreateWordInput } from '../types/word';
import { Result } from '../types/result';
import { AppError } from '../utils/errors';
import * as WordService from '../services/database/words';
import { syncWordToPds, updateWordInPds, getPdsRkey } from '../services/pds/vocabularySync';
import { getAgent } from '../services/bluesky/auth';
import { useAuthStore } from './authStore';

/**
 * Word store state interface
 */
interface WordState {
  // State
  words: Word[];
  isLoading: boolean;
  error: AppError | null;
  filter: WordFilter;

  // Actions
  loadWords: () => Promise<Result<void, AppError>>;
  addWord: (input: CreateWordInput) => Promise<Result<Word, AppError>>;
  toggleReadStatus: (id: number) => Promise<Result<void, AppError>>;
  deleteWord: (id: number) => Promise<Result<void, AppError>>;
  setFilter: (filter: Partial<WordFilter>) => void;
  clearError: () => void;
  refreshWords: () => Promise<void>;
}

/**
 * Default filter settings
 */
const defaultFilter: WordFilter = {
  isRead: false,
  sortBy: 'created_at',
  sortOrder: 'desc',
  limit: 1000,
  offset: 0,
};

/**
 * Word store using Zustand
 */
export const useWordStore = create<WordState>((set, get) => ({
  // Initial state
  words: [],
  isLoading: false,
  error: null,
  filter: defaultFilter,

  /**
   * Load words from database with current filter
   */
  loadWords: async () => {
    set({ isLoading: true, error: null });

    const result = await WordService.getWords(get().filter);

    if (result.success) {
      set({
        words: result.data,
        isLoading: false,
        error: null,
      });
      return { success: true, data: undefined };
    } else {
      set({
        isLoading: false,
        error: result.error,
      });
      return result;
    }
  },

  /**
   * Add a new word to database and update state
   */
  addWord: async (input: CreateWordInput) => {
    const result = await WordService.insertWord(input);

    if (result.success) {
      // Reload words to reflect the new addition
      await get().loadWords();

      // PDS同期（非同期・バックグラウンド、失敗許容）
      const isAuthenticated = useAuthStore.getState().isAuthenticated;
      if (isAuthenticated) {
        const agent = getAgent();
        syncWordToPds(agent, result.data).catch((err) => {
          console.error('[wordStore] PDS sync failed:', err);
        });
      }

      return { success: true, data: result.data };
    } else {
      set({ error: result.error });
      return result;
    }
  },

  /**
   * Toggle read status of a word
   */
  toggleReadStatus: async (id: number) => {
    const result = await WordService.toggleReadStatus(id);

    if (result.success) {
      // PDS同期（非同期・失敗許容）
      const isAuthenticated = useAuthStore.getState().isAuthenticated;
      if (isAuthenticated) {
        getPdsRkey(id).then((rkey) => {
          if (rkey) {
            const agent = getAgent();
            updateWordInPds(agent, result.data, rkey).catch((err) => {
              console.error('[wordStore] PDS read status sync failed:', err);
            });
          }
        });
      }

      // Reload words to reflect the change
      await get().loadWords();
      return { success: true, data: undefined };
    } else {
      set({ error: result.error });
      return result;
    }
  },

  /**
   * Delete a word
   */
  deleteWord: async (id: number) => {
    const result = await WordService.deleteWord(id);

    if (result.success) {
      // Reload words to reflect the deletion
      await get().loadWords();
      return { success: true, data: undefined };
    } else {
      set({ error: result.error });
      return result;
    }
  },

  /**
   * Update filter settings and reload words
   */
  setFilter: (newFilter: Partial<WordFilter>) => {
    set((state) => ({
      filter: { ...state.filter, ...newFilter },
    }));
    // Reload words with new filter
    get().loadWords();
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * Refresh words (alias for loadWords for clarity)
   */
  refreshWords: async () => {
    await get().loadWords();
  },
}));
