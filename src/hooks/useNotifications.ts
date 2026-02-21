import { useCallback, useEffect } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../store/notificationStore';

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
  } = useNotificationStore();

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

  return {
    handleToggleQuizReminder,
    handleToggleWordReminder,
  };
}
