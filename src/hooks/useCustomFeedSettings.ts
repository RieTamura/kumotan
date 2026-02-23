/**
 * useCustomFeedSettings Hook
 * Provides settings-screen logic for selecting a custom feed:
 *   - loads saved (pinned) feed generators from Bluesky
 *   - persists the selected feed via customFeedStore
 */

import { useState, useCallback } from 'react';
import { FeedInfo, getSavedFeeds } from '../services/bluesky/feed';
import { useAuthStore } from '../store/authStore';
import { useCustomFeedStore } from '../store/customFeedStore';

interface UseCustomFeedSettingsReturn {
  /** URI of the currently selected custom feed, or null */
  selectedFeedUri: string | null;
  /** Display name of the currently selected custom feed, or null */
  selectedFeedDisplayName: string | null;
  /** Pinned feed generators fetched from Bluesky (populated after refreshSavedFeeds) */
  savedFeeds: FeedInfo[];
  /** True while fetching saved feeds from Bluesky */
  isLoading: boolean;
  /** Persist a new selection (pass null to clear) */
  selectFeed: (uri: string | null, displayName: string | null) => void;
  /** Fetch the latest pinned feed generators from Bluesky */
  refreshSavedFeeds: () => Promise<void>;
}

export function useCustomFeedSettings(): UseCustomFeedSettingsReturn {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { selectedFeedUri, selectedFeedDisplayName, selectFeed } = useCustomFeedStore();

  const [savedFeeds, setSavedFeeds] = useState<FeedInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshSavedFeeds = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const result = await getSavedFeeds();
      if (result.success) {
        setSavedFeeds(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  return {
    selectedFeedUri,
    selectedFeedDisplayName,
    savedFeeds,
    isLoading,
    selectFeed,
    refreshSavedFeeds,
  };
}
