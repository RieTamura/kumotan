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
  unreadCount: number;
  setUnreadCount: (count: number) => void;

  // App update info (not persisted – refreshed on each launch)
  availableAppVersion: string | null;
  availableAppReleaseNotes: string | null;
  availableAppReleaseUrl: string | null;
  setAppUpdate: (version: string, notes: string, url: string) => void;
  clearAppUpdate: () => void;

  // Dictionary update info
  dictionaryUpdateAvailable: boolean;
  lastKnownDictionaryCommit: string | null; // persisted
  dictionaryLatestCommitMessage: string | null;
  setDictionaryUpdateAvailable: (available: boolean, sha: string, message: string) => void;
  clearDictionaryUpdate: () => void;
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
      unreadCount: 0,
      setUnreadCount: (count) => set({ unreadCount: count, hasUnread: count > 0 }),

      // App update (not persisted)
      availableAppVersion: null,
      availableAppReleaseNotes: null,
      availableAppReleaseUrl: null,
      setAppUpdate: (version, notes, url) =>
        set({ availableAppVersion: version, availableAppReleaseNotes: notes, availableAppReleaseUrl: url }),
      clearAppUpdate: () =>
        set({ availableAppVersion: null, availableAppReleaseNotes: null, availableAppReleaseUrl: null }),

      // Dictionary update
      dictionaryUpdateAvailable: false,
      lastKnownDictionaryCommit: null,
      dictionaryLatestCommitMessage: null,
      setDictionaryUpdateAvailable: (available, sha, message) =>
        set({
          dictionaryUpdateAvailable: available,
          lastKnownDictionaryCommit: sha,
          dictionaryLatestCommitMessage: message,
        }),
      clearDictionaryUpdate: () => set({ dictionaryUpdateAvailable: false }),
    }),
    {
      name: 'notification-storage',
      storage: createJSONStorage(() => zustandStorage),
      // アプリ更新情報はセッションをまたいで保持しない
      partialize: (state) => ({
        quizReminderEnabled: state.quizReminderEnabled,
        wordReminderEnabled: state.wordReminderEnabled,
        reminderHour: state.reminderHour,
        reminderMinute: state.reminderMinute,
        blueskyNotificationsEnabled: state.blueskyNotificationsEnabled,
        notifyOnLike: state.notifyOnLike,
        notifyOnReply: state.notifyOnReply,
        notifyOnMention: state.notifyOnMention,
        notifyOnRepost: state.notifyOnRepost,
        notifyOnFollow: state.notifyOnFollow,
        hasUnread: state.hasUnread,
        unreadCount: state.unreadCount,
        lastKnownDictionaryCommit: state.lastKnownDictionaryCommit,
      }),
    }
  )
);
