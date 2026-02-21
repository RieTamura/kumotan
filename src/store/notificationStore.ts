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

interface NotificationState {
  quizReminderEnabled: boolean;
  setQuizReminderEnabled: (value: boolean) => void;
  wordReminderEnabled: boolean;
  setWordReminderEnabled: (value: boolean) => void;
  reminderHour: number;
  reminderMinute: number;
  setReminderTime: (hour: number, minute: number) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      quizReminderEnabled: false,
      setQuizReminderEnabled: (value) => set({ quizReminderEnabled: value }),
      wordReminderEnabled: false,
      setWordReminderEnabled: (value) => set({ wordReminderEnabled: value }),
      reminderHour: 9,
      reminderMinute: 0,
      setReminderTime: (hour, minute) => set({ reminderHour: hour, reminderMinute: minute }),
    }),
    {
      name: 'notification-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
