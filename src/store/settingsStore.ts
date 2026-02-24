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

interface SettingsState {
  translateDefinition: boolean;
  setTranslateDefinition: (value: boolean) => void;
  translateSentenceToEnglish: boolean;
  setTranslateSentenceToEnglish: (value: boolean) => void;
  translateDefinitionInEnglishSentence: boolean;
  setTranslateDefinitionInEnglishSentence: (value: boolean) => void;
  hapticFeedbackEnabled: boolean;
  setHapticFeedbackEnabled: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      translateDefinition: true,
      setTranslateDefinition: (value) => set({ translateDefinition: value }),
      translateSentenceToEnglish: true,
      setTranslateSentenceToEnglish: (value) => set({ translateSentenceToEnglish: value }),
      translateDefinitionInEnglishSentence: true,
      setTranslateDefinitionInEnglishSentence: (value) => set({ translateDefinitionInEnglishSentence: value }),
      hapticFeedbackEnabled: true,
      setHapticFeedbackEnabled: (value) => set({ hapticFeedbackEnabled: value }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
