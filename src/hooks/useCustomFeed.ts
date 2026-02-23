/**
 * useCustomFeed Hook
 * Custom hook for managing a Bluesky feed generator feed state and operations.
 * Mirrors useBlueskyFeed but accepts a feedUri argument instead of always fetching the home timeline.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { TimelinePost } from '../types/bluesky';
import { AppError } from '../utils/errors';
import * as FeedService from '../services/bluesky/feed';
import { useAuthStore } from '../store/authStore';
import { networkMonitor } from '../services/network/monitor';

interface FeedState {
  posts: TimelinePost[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: AppError | null;
  cursor: string | undefined;
  hasMore: boolean;
}

interface UseCustomFeedReturn extends FeedState {
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  clearError: () => void;
}

const makeInitialState = (feedUri: string | null): FeedState => ({
  posts: [],
  isLoading: feedUri !== null,
  isRefreshing: false,
  isLoadingMore: false,
  error: null,
  cursor: undefined,
  hasMore: feedUri !== null,
});

/**
 * useCustomFeed Hook
 * Manages a custom feed generator with refresh and pagination support.
 * Automatically resets and re-fetches when feedUri changes.
 */
export function useCustomFeed(feedUri: string | null): UseCustomFeedReturn {
  const [state, setState] = useState<FeedState>(() => makeInitialState(feedUri));
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Track the current feedUri to detect changes and avoid stale closures
  const feedUriRef = useRef(feedUri);

  /**
   * Fetch initial feed
   */
  const fetchFeed = useCallback(
    async (uri: string) => {
      if (!isAuthenticated) {
        setState((prev) => ({ ...prev, isLoading: false, posts: [], error: null }));
        return;
      }

      if (!networkMonitor.getIsConnected()) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: new AppError(
            'NETWORK_ERROR' as any,
            'オフラインです。フィードを更新できません。'
          ),
        }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const result = await FeedService.getCustomFeed(uri);

      // Ignore result if feedUri has changed since the request was dispatched
      if (feedUriRef.current !== uri) return;

      if (result.success) {
        setState({
          posts: result.data.posts,
          isLoading: false,
          isRefreshing: false,
          isLoadingMore: false,
          error: null,
          cursor: result.data.cursor,
          hasMore: !!result.data.cursor && result.data.posts.length > 0,
        });
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isRefreshing: false,
          error: result.error,
        }));
      }
    },
    [isAuthenticated]
  );

  /**
   * Pull-to-refresh
   */
  const refresh = useCallback(async () => {
    if (!feedUri || !isAuthenticated) return;

    if (!networkMonitor.getIsConnected()) {
      setState((prev) => ({
        ...prev,
        error: new AppError(
          'NETWORK_ERROR' as any,
          'オフラインです。フィードを更新できません。'
        ),
      }));
      return;
    }

    setState((prev) => ({ ...prev, isRefreshing: true, error: null }));

    const result = await FeedService.getCustomFeed(feedUri);

    if (feedUriRef.current !== feedUri) return;

    if (result.success) {
      setState({
        posts: result.data.posts,
        isLoading: false,
        isRefreshing: false,
        isLoadingMore: false,
        error: null,
        cursor: result.data.cursor,
        hasMore: !!result.data.cursor && result.data.posts.length > 0,
      });
    } else {
      setState((prev) => ({
        ...prev,
        isRefreshing: false,
        error: result.error,
      }));
    }
  }, [feedUri, isAuthenticated]);

  /**
   * Infinite scroll — load next page
   */
  const loadMore = useCallback(async () => {
    if (
      !feedUri ||
      !isAuthenticated ||
      state.isLoadingMore ||
      !state.hasMore ||
      !state.cursor
    ) {
      return;
    }

    if (!networkMonitor.getIsConnected()) return;

    setState((prev) => ({ ...prev, isLoadingMore: true }));

    const result = await FeedService.getCustomFeed(feedUri, 50, state.cursor);

    if (feedUriRef.current !== feedUri) return;

    if (result.success) {
      setState((prev) => {
        const existingUris = new Set(prev.posts.map((p) => p.uri));
        const newPosts = result.data.posts.filter((p) => !existingUris.has(p.uri));

        return {
          ...prev,
          posts: [...prev.posts, ...newPosts],
          isLoadingMore: false,
          cursor: result.data.cursor,
          hasMore: !!result.data.cursor && result.data.posts.length > 0,
        };
      });
    } else {
      setState((prev) => ({
        ...prev,
        isLoadingMore: false,
        error: result.error,
      }));
    }
  }, [feedUri, isAuthenticated, state.cursor, state.hasMore, state.isLoadingMore]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Reset and re-fetch whenever feedUri or auth changes
   */
  useEffect(() => {
    feedUriRef.current = feedUri;

    if (!feedUri || !isAuthenticated) {
      setState(makeInitialState(feedUri));
      return;
    }

    setState(makeInitialState(feedUri));
    fetchFeed(feedUri);
  }, [feedUri, isAuthenticated, fetchFeed]);

  return { ...state, refresh, loadMore, clearError };
}
