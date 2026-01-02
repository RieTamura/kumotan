/**
 * useBlueskyFeed Hook
 * Custom hook for managing Bluesky timeline feed state and operations
 */

import { useState, useCallback, useEffect } from 'react';
import { TimelinePost } from '../types/bluesky';
import { AppError } from '../utils/errors';
import * as FeedService from '../services/bluesky/feed';
import { useAuthStore } from '../store/authStore';
import { networkMonitor } from '../services/network/monitor';

/**
 * Feed state interface
 */
interface FeedState {
  posts: TimelinePost[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: AppError | null;
  cursor: string | undefined;
  hasMore: boolean;
}

/**
 * Feed hook return interface
 */
interface UseFeedReturn extends FeedState {
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  clearError: () => void;
}

/**
 * Initial feed state
 */
const initialState: FeedState = {
  posts: [],
  isLoading: true,
  isRefreshing: false,
  isLoadingMore: false,
  error: null,
  cursor: undefined,
  hasMore: true,
};

/**
 * useBlueskyFeed Hook
 * Manages the Bluesky timeline feed with refresh and pagination support
 */
export function useBlueskyFeed(): UseFeedReturn {
  const [state, setState] = useState<FeedState>(initialState);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  /**
   * Fetch initial timeline
   */
  const fetchTimeline = useCallback(async () => {
    if (!isAuthenticated) {
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
          'オフラインです。フィードを更新できません。'
        ),
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const result = await FeedService.getTimeline();

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
  }, [isAuthenticated]);

  /**
   * Refresh timeline (pull-to-refresh)
   */
  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;

    // Check network connectivity
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

    const result = await FeedService.getTimeline();

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
  }, [isAuthenticated]);

  /**
   * Load more posts (infinite scroll)
   */
  const loadMore = useCallback(async () => {
    if (!isAuthenticated || state.isLoadingMore || !state.hasMore || !state.cursor) {
      return;
    }

    // Check network connectivity
    if (!networkMonitor.getIsConnected()) {
      return;
    }

    setState((prev) => ({ ...prev, isLoadingMore: true }));

    const result = await FeedService.getTimeline(50, state.cursor);

    if (result.success) {
      setState((prev) => ({
        ...prev,
        posts: [...prev.posts, ...result.data.posts],
        isLoadingMore: false,
        cursor: result.data.cursor,
        hasMore: !!result.data.cursor && result.data.posts.length > 0,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        isLoadingMore: false,
        error: result.error,
      }));
    }
  }, [isAuthenticated, state.cursor, state.hasMore, state.isLoadingMore]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Initial fetch on mount and auth change
   */
  useEffect(() => {
    if (isAuthenticated) {
      fetchTimeline();
    } else {
      setState(initialState);
    }
  }, [isAuthenticated, fetchTimeline]);

  return {
    ...state,
    refresh,
    loadMore,
    clearError,
  };
}

/**
 * Export format time helper for use in components
 */
export { formatRelativeTime } from '../services/bluesky/feed';
