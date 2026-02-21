/**
 * usePostCreation Hook
 * Manages state and logic for creating Bluesky posts
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPost, PostReplySettings, DEFAULT_REPLY_SETTINGS, PostImageAttachment, buildImageEmbed } from '../services/bluesky/feed';
import { ReplyRef } from '../types/bluesky';
import { AppError } from '../utils/errors';

/**
 * Reply target info for creating a reply
 */
export interface ReplyToInfo {
  uri: string;
  cid: string;
  author: { handle: string; displayName: string };
  text: string;
}

/**
 * Quote target info for creating a quote post
 */
export interface QuoteToInfo {
  uri: string;
  cid: string;
  author: { handle: string; displayName: string; avatar?: string };
  text: string;
}

/**
 * Maximum number of images per post
 */
const MAX_IMAGES = 4;

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
  replySettings: PostReplySettings;
  images: PostImageAttachment[];
  selfLabels: string[];
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
  replySettings: PostReplySettings;
  images: PostImageAttachment[];
  canAddImage: boolean;
  selfLabels: string[];

  // Actions
  setText: (text: string) => void;
  addHashtag: (tag: string) => void;
  removeHashtag: (tag: string) => void;
  setReplySettings: (settings: PostReplySettings) => void;
  addImage: (image: PostImageAttachment) => void;
  removeImage: (index: number) => void;
  updateImageAlt: (index: number, alt: string) => void;
  setSelfLabels: (labels: string[]) => void;
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
  replySettings: DEFAULT_REPLY_SETTINGS,
  images: [],
  selfLabels: [],
};

/**
 * Hook for managing post creation state and logic
 *
 * @param initialText - Optional initial text to pre-fill the post
 * @param initialImages - Optional initial images to pre-attach (e.g., from share flow)
 */
export function usePostCreation(
  initialText?: string,
  initialImages?: PostImageAttachment[],
  replyTo?: ReplyToInfo,
  quoteTo?: QuoteToInfo
): UsePostCreationReturn {
  const [state, setState] = useState<PostCreationState>(initialState);
  const [hashtagHistory, setHashtagHistory] = useState<string[]>(DEFAULT_HASHTAGS);

  /**
   * Set initial text when provided (e.g., from share flow)
   */
  useEffect(() => {
    if (initialText !== undefined) {
      setState((prev) => ({ ...prev, text: initialText }));
    }
  }, [initialText]);

  /**
   * Set initial images when provided (e.g., from share flow with captured card)
   */
  useEffect(() => {
    if (initialImages !== undefined && initialImages.length > 0) {
      setState((prev) => ({ ...prev, images: initialImages }));
    }
  }, [initialImages]);

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
   * Set reply and quote settings
   */
  const setReplySettings = useCallback((settings: PostReplySettings) => {
    setState((prev) => ({ ...prev, replySettings: settings }));
  }, []);

  /**
   * Add an image attachment (up to MAX_IMAGES)
   */
  const addImage = useCallback((image: PostImageAttachment) => {
    setState((prev) => {
      if (prev.images.length >= MAX_IMAGES) return prev;
      return { ...prev, images: [...prev.images, image] };
    });
  }, []);

  /**
   * Update the ALT text of an image attachment by index.
   */
  const updateImageAlt = useCallback((index: number, alt: string) => {
    setState((prev) => {
      const newImages = [...prev.images];
      if (newImages[index]) {
        newImages[index] = { ...newImages[index], alt };
      }
      return { ...prev, images: newImages };
    });
  }, []);

  /**
   * Remove an image attachment by index.
   * If all images are removed, selfLabels are automatically reset.
   */
  const removeImage = useCallback((index: number) => {
    setState((prev) => {
      const newImages = prev.images.filter((_, i) => i !== index);
      return {
        ...prev,
        images: newImages,
        selfLabels: newImages.length === 0 ? [] : prev.selfLabels,
      };
    });
  }, []);

  /**
   * Whether additional images can be added
   */
  const canAddImage = useMemo(() => {
    return state.images.length < MAX_IMAGES;
  }, [state.images.length]);

  /**
   * Set self-labels for content warnings
   */
  const setSelfLabels = useCallback((labels: string[]) => {
    setState((prev) => ({ ...prev, selfLabels: labels }));
  }, []);

  /**
   * Extract hashtags from text using regex
   * Supports Unicode characters (Japanese, English, etc.)
   */
  const extractHashtagsFromText = useCallback((text: string): string[] => {
    const hashtagRegex = /#[\p{L}\p{N}_]+/gu;
    const matches = text.match(hashtagRegex);
    return matches?.map((tag) => tag.slice(1)) ?? [];
  }, []);

  /**
   * Submit the post to Bluesky
   */
  const submitPost = useCallback(async (): Promise<boolean> => {
    if (!isValid || state.isPosting) return false;

    setState((prev) => ({ ...prev, isPosting: true, error: null }));

    const postText = buildPostText();
    const settings = state.replySettings;
    const isDefaultSettings = settings.allowAll && settings.allowQuote;

    // Build image embed if images are attached
    let embed: Record<string, unknown> | undefined;
    if (state.images.length > 0) {
      const embedResult = await buildImageEmbed(state.images);
      if (!embedResult.success) {
        setState((prev) => ({
          ...prev,
          isPosting: false,
          error: embedResult.error,
        }));
        return false;
      }
      embed = embedResult.data;
    }

    // Build quote embed if quoting a post
    if (quoteTo && !embed) {
      embed = {
        $type: 'app.bsky.embed.record',
        record: {
          uri: quoteTo.uri,
          cid: quoteTo.cid,
        },
      };
    }

    // Build reply reference
    let replyRef: ReplyRef | undefined;
    if (replyTo) {
      replyRef = {
        root: { uri: replyTo.uri, cid: replyTo.cid },
        parent: { uri: replyTo.uri, cid: replyTo.cid },
      };
    }

    const labelsToSend = state.images.length > 0 && state.selfLabels.length > 0
      ? state.selfLabels
      : undefined;

    const result = await createPost(
      postText,
      isDefaultSettings ? undefined : settings,
      embed,
      labelsToSend,
      replyRef,
    );

    if (result.success) {
      // Extract hashtags from post text and combine with selected hashtags
      const extractedTags = extractHashtagsFromText(postText);
      const allTags = [...new Set([...state.hashtags, ...extractedTags])];

      if (allTags.length > 0) {
        await saveHashtagsToHistory(allTags);
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
  }, [isValid, state.isPosting, state.hashtags, state.replySettings, state.images, state.selfLabels, buildPostText, extractHashtagsFromText, saveHashtagsToHistory]);

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
    replySettings: state.replySettings,
    images: state.images,
    canAddImage,
    selfLabels: state.selfLabels,

    // Actions
    setText,
    addHashtag,
    removeHashtag,
    setReplySettings,
    addImage,
    removeImage,
    updateImageAlt,
    setSelfLabels,
    submitPost,
    reset,
    clearError,
  };
}
