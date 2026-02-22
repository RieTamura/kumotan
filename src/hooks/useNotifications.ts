import { useCallback, useEffect } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import {
  registerPushToken,
  unregisterPushToken,
  type BlueskyNotificationSettings,
} from '../services/notifications/pushToken';

const QUIZ_REMINDER_ID = 'kumotan-quiz-reminder';
const WORD_REMINDER_ID = 'kumotan-word-reminder';

async function requestPermissionIfNeeded(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function scheduleReminder(
  id: string,
  hour: number,
  minute: number,
  title: string,
  body: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

async function cancelReminder(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

export function useNotifications() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const {
    quizReminderEnabled,
    wordReminderEnabled,
    reminderHour,
    reminderMinute,
    setQuizReminderEnabled,
    setWordReminderEnabled,
    setBlueskyNotificationsEnabled,
    notifyOnLike,
    notifyOnReply,
    notifyOnMention,
    notifyOnRepost,
    notifyOnFollow,
  } = useNotificationStore();
  const { user } = useAuthStore();

  // Sync scheduled notifications whenever relevant state changes
  useEffect(() => {
    if (quizReminderEnabled) {
      scheduleReminder(
        QUIZ_REMINDER_ID,
        reminderHour,
        reminderMinute,
        t('notifications.quizReminder'),
        t('notifications.quizReminderBody')
      ).catch(() => {});
    } else {
      cancelReminder(QUIZ_REMINDER_ID).catch(() => {});
    }
  }, [quizReminderEnabled, reminderHour, reminderMinute, t]);

  useEffect(() => {
    if (wordReminderEnabled) {
      scheduleReminder(
        WORD_REMINDER_ID,
        reminderHour,
        reminderMinute,
        t('notifications.wordReminder'),
        t('notifications.wordReminderBody')
      ).catch(() => {});
    } else {
      cancelReminder(WORD_REMINDER_ID).catch(() => {});
    }
  }, [wordReminderEnabled, reminderHour, reminderMinute, t]);

  const showPermissionDeniedAlert = useCallback(() => {
    Alert.alert(
      t('notifications.permissionDeniedTitle'),
      t('notifications.permissionDeniedMessage'),
      [
        {
          text: t('notifications.openSettings'),
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          },
        },
        { text: tc('buttons.cancel'), style: 'cancel' },
      ]
    );
  }, [t, tc]);

  const handleToggleQuizReminder = useCallback(
    async (value: boolean) => {
      if (value) {
        const granted = await requestPermissionIfNeeded();
        if (!granted) {
          showPermissionDeniedAlert();
          return;
        }
      }
      setQuizReminderEnabled(value);
    },
    [setQuizReminderEnabled, showPermissionDeniedAlert]
  );

  const handleToggleWordReminder = useCallback(
    async (value: boolean) => {
      if (value) {
        const granted = await requestPermissionIfNeeded();
        if (!granted) {
          showPermissionDeniedAlert();
          return;
        }
      }
      setWordReminderEnabled(value);
    },
    [setWordReminderEnabled, showPermissionDeniedAlert]
  );

  /**
   * Register for Bluesky push notifications.
   * Requests OS permission, gets Expo Push Token, and registers with the server.
   * Returns true on success, false if permission was denied.
   */
  const registerForBlueskyPush = useCallback(
    async (settings: BlueskyNotificationSettings): Promise<boolean> => {
      const granted = await requestPermissionIfNeeded();
      if (!granted) {
        showPermissionDeniedAlert();
        return false;
      }

      if (!user?.did) {
        Alert.alert(t('notifications.bluesky.errorTitle'), t('notifications.bluesky.errorNotLoggedIn'));
        return false;
      }

      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        await registerPushToken(user.did, tokenData.data, settings);
        setBlueskyNotificationsEnabled(true);
        return true;
      } catch (e) {
        console.error('Failed to register for push notifications:', e);
        Alert.alert(t('notifications.bluesky.errorTitle'), t('notifications.bluesky.errorRegistrationFailed'));
        return false;
      }
    },
    [user, setBlueskyNotificationsEnabled, showPermissionDeniedAlert, t]
  );

  /**
   * Unregister from Bluesky push notifications.
   */
  const unregisterFromBlueskyPush = useCallback(async (): Promise<void> => {
    if (!user?.did) return;
    try {
      await unregisterPushToken(user.did);
    } catch (e) {
      console.error('Failed to unregister push token:', e);
    }
    setBlueskyNotificationsEnabled(false);
  }, [user, setBlueskyNotificationsEnabled]);

  /**
   * Re-register with the server whenever notification type settings change.
   * Called by NotificationSettingsScreen after toggling individual notification types.
   */
  const updateBlueskyPushSettings = useCallback(
    async (settings: BlueskyNotificationSettings): Promise<void> => {
      if (!user?.did) return;
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        await registerPushToken(user.did, tokenData.data, settings);
      } catch (e) {
        console.error('Failed to update push settings:', e);
      }
    },
    [user, notifyOnLike, notifyOnReply, notifyOnMention, notifyOnRepost, notifyOnFollow]
  );

  return {
    handleToggleQuizReminder,
    handleToggleWordReminder,
    registerForBlueskyPush,
    unregisterFromBlueskyPush,
    updateBlueskyPushSettings,
  };
}
