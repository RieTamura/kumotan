/**
 * usePostCreation Hook
 * Manages state and logic for creating Bluesky posts
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPost } from '../services/bluesky/feed';
import { AppError } from '../utils/errors';

/**
 * Maximum character limit for Bluesky posts
 */
const MAX_CHARACTERS = 300;

/**
 * Maximum number of hashtag history entries
 */
const MAX_HASHTAG_HISTORY = 5;

/**
 * Storage key for hashtag history
 */
const HASHTAG_HISTORY_KEY = '@kumotan/hashtag_history';

/**
 * Default hashtags shown when no history exists
 */
export const DEFAULT_HASHTAGS = ['英語学習', 'くもたん', 'Bluesky'];

/**
 * @deprecated Use DEFAULT_HASHTAGS instead
 */
export const PRESET_HASHTAGS = DEFAULT_HASHTAGS;

/**
 * Post creation state interface
 */
interface PostCreationState {
  text: string;
  hashtags: string[];
  isPosting: boolean;
  error: AppError | null;
}

/**
 * Return type for usePostCreation hook
 */
interface UsePostCreationReturn {
  // State
  text: string;
  hashtags: string[];
  hashtagHistory: string[];
  isPosting: boolean;
  error: AppError | null;
  characterCount: number;
  isValid: boolean;
  remainingCharacters: number;

  // Actions
  setText: (text: string) => void;
  addHashtag: (tag: string) => void;
  removeHashtag: (tag: string) => void;
  submitPost: () => Promise<boolean>;
  reset: () => void;
  clearError: () => void;
}

/**
 * Initial state for post creation
 */
const initialState: PostCreationState = {
  text: '',
  hashtags: [],
  isPosting: false,
  error: null,
};

/**
 * Hook for managing post creation state and logic
 */
export function usePostCreation(): UsePostCreationReturn {
  const [state, setState] = useState<PostCreationState>(initialState);
  const [hashtagHistory, setHashtagHistory] = useState<string[]>(DEFAULT_HASHTAGS);

  /**
   * Load hashtag history from storage on mount
   */
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem(HASHTAG_HISTORY_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as string[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setHashtagHistory(parsed);
          }
        }
      } catch {
        // Use default hashtags on error
      }
    };
    loadHistory();
  }, []);

  /**
   * Save hashtags to history
   */
  const saveHashtagsToHistory = useCallback(async (tags: string[]) => {
    if (tags.length === 0) return;

    try {
      // Add new tags to the front, remove duplicates, limit to MAX_HASHTAG_HISTORY
      const newHistory = [...tags, ...hashtagHistory]
        .filter((tag, index, self) => self.indexOf(tag) === index)
        .slice(0, MAX_HASHTAG_HISTORY);

      await AsyncStorage.setItem(HASHTAG_HISTORY_KEY, JSON.stringify(newHistory));
      setHashtagHistory(newHistory);
    } catch {
      // Silently fail on storage error
    }
  }, [hashtagHistory]);

  /**
   * Build the final post text with hashtags
   */
  const buildPostText = useCallback((): string => {
    const { text, hashtags } = state;
    if (hashtags.length === 0) return text.trim();

    const hashtagText = hashtags
      .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
      .join(' ');

    return `${text.trim()}\n\n${hashtagText}`;
  }, [state.text, state.hashtags]);

  /**
   * Calculate total character count including hashtags
   */
  const characterCount = useMemo(() => {
    return buildPostText().length;
  }, [buildPostText]);

  /**
   * Calculate remaining characters
   */
  const remainingCharacters = useMemo(() => {
    return MAX_CHARACTERS - characterCount;
  }, [characterCount]);

  /**
   * Validate if the post is ready to submit
   */
  const isValid = useMemo(() => {
    const trimmedText = state.text.trim();
    return trimmedText.length > 0 && characterCount <= MAX_CHARACTERS;
  }, [state.text, characterCount]);

  /**
   * Set the post text
   */
  const setText = useCallback((text: string) => {
    setState((prev) => ({ ...prev, text, error: null }));
  }, []);

  /**
   * Add a hashtag to the list
   */
  const addHashtag = useCallback((tag: string) => {
    const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;
    setState((prev) => {
      if (prev.hashtags.includes(normalizedTag)) {
        return prev;
      }
      return {
        ...prev,
        hashtags: [...prev.hashtags, normalizedTag],
        error: null,
      };
    });
  }, []);

  /**
   * Remove a hashtag from the list
   */
  const removeHashtag = useCallback((tag: string) => {
    const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;
    setState((prev) => ({
      ...prev,
      hashtags: prev.hashtags.filter((t) => t !== normalizedTag),
    }));
  }, []);

  /**
   * Submit the post to Bluesky
   */
  const submitPost = useCallback(async (): Promise<boolean> => {
    if (!isValid || state.isPosting) return false;

    setState((prev) => ({ ...prev, isPosting: true, error: null }));

    const postText = buildPostText();
    const result = await createPost(postText);

    if (result.success) {
      // Save used hashtags to history
      if (state.hashtags.length > 0) {
        await saveHashtagsToHistory(state.hashtags);
      }
      setState(initialState);
      return true;
    } else {
      setState((prev) => ({
        ...prev,
        isPosting: false,
        error: result.error,
      }));
      return false;
    }
  }, [isValid, state.isPosting, state.hashtags, buildPostText, saveHashtagsToHistory]);

  /**
   * Reset the state to initial values
   */
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  /**
   * Clear the error state
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    text: state.text,
    hashtags: state.hashtags,
    hashtagHistory,
    isPosting: state.isPosting,
    error: state.error,
    characterCount,
    isValid,
    remainingCharacters,

    // Actions
    setText,
    addHashtag,
    removeHashtag,
    submitPost,
    reset,
    clearError,
  };
}
