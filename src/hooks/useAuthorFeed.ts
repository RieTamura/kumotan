/**
 * useAuthorFeed Hook
 * Custom hook for managing a specific user's feed state and operations
 */

import { useState, useCallback, useEffect } from 'react';
import { TimelinePost } from '../types/bluesky';
import { AppError } from '../utils/errors';
import * as FeedService from '../services/bluesky/feed';
import { AuthorFeedFilter } from '../services/bluesky/feed';
import { useAuthStore } from '../store/authStore';
import { networkMonitor } from '../services/network/monitor';

/**
 * Author feed state interface
 */
interface AuthorFeedState {
  posts: TimelinePost[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: AppError | null;
  cursor: string | undefined;
  hasMore: boolean;
}

/**
 * Author feed hook return interface
 */
interface UseAuthorFeedReturn extends AuthorFeedState {
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  clearError: () => void;
}

/**
 * Initial author feed state
 */
const initialState: AuthorFeedState = {
  posts: [],
  isLoading: true,
  isRefreshing: false,
  isLoadingMore: false,
  error: null,
  cursor: undefined,
  hasMore: true,
};

/**
 * useAuthorFeed Hook
 * Manages a specific user's feed with refresh and pagination support
 * @param actor - User DID or handle (optional, defaults to current user)
 * @param filter - Feed filter type (default: 'posts_no_replies')
 */
export function useAuthorFeed(
  actor?: string,
  filter: AuthorFeedFilter = 'posts_no_replies'
): UseAuthorFeedReturn {
  const [state, setState] = useState<AuthorFeedState>(initialState);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  // Determine the actor to fetch (current user if not specified)
  const targetActor = actor || user?.did;

  /**
   * Fetch initial author feed
   */
  const fetchAuthorFeed = useCallback(async () => {
    if (!isAuthenticated || !targetActor) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        posts: [],
        error: null,
      }));
      return;
    }

    // Check network connectivity
    if (!networkMonitor.getIsConnected()) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: new AppError(
          'NETWORK_ERROR' as any,
          'Offline. Cannot fetch posts.'
        ),
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const result = await FeedService.getAuthorFeed(targetActor, 20, undefined, filter);

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
  }, [isAuthenticated, targetActor, filter]);

  /**
   * Refresh author feed (pull-to-refresh)
   */
  const refresh = useCallback(async () => {
    if (!isAuthenticated || !targetActor) return;

    // Check network connectivity
    if (!networkMonitor.getIsConnected()) {
      setState((prev) => ({
        ...prev,
        error: new AppError(
          'NETWORK_ERROR' as any,
          'Offline. Cannot refresh posts.'
        ),
      }));
      return;
    }

    setState((prev) => ({ ...prev, isRefreshing: true, error: null }));

    const result = await FeedService.getAuthorFeed(targetActor, 20, undefined, filter);

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
  }, [isAuthenticated, targetActor, filter]);

  /**
   * Load more posts (infinite scroll)
   */
  const loadMore = useCallback(async () => {
    if (!isAuthenticated || !targetActor || state.isLoadingMore || !state.hasMore || !state.cursor) {
      return;
    }

    // Check network connectivity
    if (!networkMonitor.getIsConnected()) {
      return;
    }

    setState((prev) => ({ ...prev, isLoadingMore: true }));

    const result = await FeedService.getAuthorFeed(targetActor, 20, state.cursor, filter);

    if (result.success) {
      setState((prev) => {
        // Filter out duplicate posts by URI
        const existingUris = new Set(prev.posts.map(p => p.uri));
        const newPosts = result.data.posts.filter(p => !existingUris.has(p.uri));

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
  }, [isAuthenticated, targetActor, state.cursor, state.hasMore, state.isLoadingMore, filter]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Initial fetch on mount and when dependencies change
   */
  useEffect(() => {
    if (isAuthenticated && targetActor) {
      fetchAuthorFeed();
    } else {
      setState(initialState);
    }
  }, [isAuthenticated, targetActor, fetchAuthorFeed]);

  return {
    ...state,
    refresh,
    loadMore,
    clearError,
  };
}
