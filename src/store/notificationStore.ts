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
  // Study reminders (existing)
  quizReminderEnabled: boolean;
  setQuizReminderEnabled: (value: boolean) => void;
  wordReminderEnabled: boolean;
  setWordReminderEnabled: (value: boolean) => void;
  reminderHour: number;
  reminderMinute: number;
  setReminderTime: (hour: number, minute: number) => void;

  // Bluesky social push notifications
  blueskyNotificationsEnabled: boolean;
  setBlueskyNotificationsEnabled: (value: boolean) => void;
  notifyOnLike: boolean;
  setNotifyOnLike: (value: boolean) => void;
  notifyOnReply: boolean;
  setNotifyOnReply: (value: boolean) => void;
  notifyOnMention: boolean;
  setNotifyOnMention: (value: boolean) => void;
  notifyOnRepost: boolean;
  setNotifyOnRepost: (value: boolean) => void;
  notifyOnFollow: boolean;
  setNotifyOnFollow: (value: boolean) => void;

  // Unread notification indicator
  hasUnread: boolean;
  setHasUnread: (value: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      // Study reminders
      quizReminderEnabled: false,
      setQuizReminderEnabled: (value) => set({ quizReminderEnabled: value }),
      wordReminderEnabled: false,
      setWordReminderEnabled: (value) => set({ wordReminderEnabled: value }),
      reminderHour: 9,
      reminderMinute: 0,
      setReminderTime: (hour, minute) => set({ reminderHour: hour, reminderMinute: minute }),

      // Bluesky social push notifications
      blueskyNotificationsEnabled: false,
      setBlueskyNotificationsEnabled: (value) => set({ blueskyNotificationsEnabled: value }),
      notifyOnLike: true,
      setNotifyOnLike: (value) => set({ notifyOnLike: value }),
      notifyOnReply: true,
      setNotifyOnReply: (value) => set({ notifyOnReply: value }),
      notifyOnMention: true,
      setNotifyOnMention: (value) => set({ notifyOnMention: value }),
      notifyOnRepost: true,
      setNotifyOnRepost: (value) => set({ notifyOnRepost: value }),
      notifyOnFollow: true,
      setNotifyOnFollow: (value) => set({ notifyOnFollow: value }),

      hasUnread: false,
      setHasUnread: (value) => set({ hasUnread: value }),
    }),
    {
      name: 'notification-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
