/**
 * Tab Order Store
 * Persists the user's preferred home tab order across sessions.
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

/** All possible home tab keys, in default display order. */
export type HomeTabKey = 'following' | 'customFeed' | 'profile';

export const DEFAULT_TAB_ORDER: HomeTabKey[] = ['following', 'customFeed', 'profile'];

interface TabOrderState {
  tabOrder: HomeTabKey[];
  /** Swap the tab at fromIndex with the tab at toIndex. */
  moveTab: (fromIndex: number, toIndex: number) => void;
}

export const useTabOrderStore = create<TabOrderState>()(
  persist(
    (set) => ({
      tabOrder: DEFAULT_TAB_ORDER,
      moveTab: (fromIndex, toIndex) =>
        set((state) => {
          const newOrder = [...state.tabOrder];
          const [moved] = newOrder.splice(fromIndex, 1);
          newOrder.splice(toIndex, 0, moved);
          return { tabOrder: newOrder };
        }),
    }),
    {
      name: 'tab-order-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
