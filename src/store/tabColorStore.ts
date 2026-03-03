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

/** Preset accent colors available for tab selection. */
export const TAB_COLOR_PRESETS = [
  '#3B82F6', // Sky
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#F43F5E', // Rose
  '#8B5CF6', // Violet
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#64748B', // Slate
] as const;

export type TabColorPreset = typeof TAB_COLOR_PRESETS[number];

interface TabColorState {
  followingColor: string | null;
  customFeedColor: string | null;
  profileColor: string | null;
  setFollowingColor: (color: string | null) => void;
  setCustomFeedColor: (color: string | null) => void;
  setProfileColor: (color: string | null) => void;
}

export const useTabColorStore = create<TabColorState>()(
  persist(
    (set) => ({
      followingColor: '#3B82F6',
      customFeedColor: '#F59E0B',
      profileColor: '#8B5CF6',
      setFollowingColor: (color) => set({ followingColor: color }),
      setCustomFeedColor: (color) => set({ customFeedColor: color }),
      setProfileColor: (color) => set({ profileColor: color }),
    }),
    {
      name: 'tab-color-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
