import { useCallback, useEffect } from 'react';
import { Alert, Linking, Platform, type AlertButton } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../store/notificationStore';

const QUIZ_REMINDER_ID = 'kumotan-quiz-reminder';
const WORD_REMINDER_ID = 'kumotan-word-reminder';

// Preset time options shown in the time picker Alert
const TIME_PRESETS: { hour: number; minute: number }[] = [
  { hour: 6, minute: 0 },
  { hour: 7, minute: 0 },
  { hour: 8, minute: 0 },
  { hour: 9, minute: 0 },
  { hour: 10, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 18, minute: 0 },
  { hour: 19, minute: 0 },
  { hour: 20, minute: 0 },
  { hour: 21, minute: 0 },
  { hour: 22, minute: 0 },
];

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
    setReminderTime,
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

  const handleSelectTime = useCallback(() => {
    const buttons: AlertButton[] = TIME_PRESETS.map(({ hour, minute }) => {
      const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      return { text: label, onPress: () => setReminderTime(hour, minute) };
    });
    buttons.push({ text: tc('buttons.cancel'), style: 'cancel' });

    Alert.alert(t('notifications.reminderTime'), undefined, buttons);
  }, [setReminderTime, t, tc]);

  return {
    handleToggleQuizReminder,
    handleToggleWordReminder,
    handleSelectTime,
  };
}
