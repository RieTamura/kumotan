/**
 * Custom Feed Store
 * Persists the user's selected custom feed (URI + display name) across sessions.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const zustandStorage = {
  setItem: async (name: string, value: string) => {
    await AsyncStorage.setItem(name, value);
  },
  getItem: async (name: string) => {
    const value = await AsyncStorage.getItem(name);
    return value ?? null;
  },
  removeItem: async (name: string) => {
    await AsyncStorage.removeItem(name);
  },
};

interface CustomFeedState {
  /** URI of the selected custom feed generator, or null if none */
  selectedFeedUri: string | null;
  /** Display name of the selected custom feed, or null if none */
  selectedFeedDisplayName: string | null;
  /** Save a custom feed selection. Pass null to clear. */
  selectFeed: (uri: string | null, displayName: string | null) => void;
}

export const useCustomFeedStore = create<CustomFeedState>()(
  persist(
    (set) => ({
      selectedFeedUri: null,
      selectedFeedDisplayName: null,
      selectFeed: (uri, displayName) =>
        set({ selectedFeedUri: uri, selectedFeedDisplayName: displayName }),
    }),
    {
      name: 'custom-feed-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
