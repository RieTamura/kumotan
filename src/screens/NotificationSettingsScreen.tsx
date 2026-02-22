/**
 * Notification Settings Screen
 * Bluesky social push notifications + study reminders
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import { useNotificationStore } from '../store/notificationStore';
import { useNotifications } from '../hooks/useNotifications';
import { TimePickerModal } from '../components/TimePickerModal';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
  );
}

function SectionCard({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
      {children}
    </View>
  );
}

interface SwitchRowProps {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
}

function SwitchRow({ title, subtitle, value, onValueChange, disabled, isLast }: SwitchRowProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: isLast ? 'transparent' : colors.divider },
        disabled && styles.rowDisabled,
      ]}
    >
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: disabled ? colors.textTertiary : colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.card}
      />
    </View>
  );
}

interface NavRowProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  isLast?: boolean;
}

function NavRow({ title, subtitle, onPress, isLast }: NavRowProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      style={[styles.row, { borderBottomColor: isLast ? 'transparent' : colors.divider }]}
      onPress={onPress}
    >
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Text style={[styles.arrow, { color: colors.textTertiary }]}>›</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function NotificationSettingsScreen(): React.JSX.Element {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  const {
    // Bluesky push
    blueskyNotificationsEnabled,
    setBlueskyNotificationsEnabled,
    notifyOnLike,
    setNotifyOnLike,
    notifyOnReply,
    setNotifyOnReply,
    notifyOnMention,
    setNotifyOnMention,
    notifyOnRepost,
    setNotifyOnRepost,
    notifyOnFollow,
    setNotifyOnFollow,
    // Reminders
    quizReminderEnabled,
    wordReminderEnabled,
    reminderHour,
    reminderMinute,
    setReminderTime,
  } = useNotificationStore();

  const {
    handleToggleQuizReminder,
    handleToggleWordReminder,
    registerForBlueskyPush,
    unregisterFromBlueskyPush,
    updateBlueskyPushSettings,
  } = useNotifications();

  const currentSettings = {
    notifyOnLike,
    notifyOnReply,
    notifyOnMention,
    notifyOnRepost,
    notifyOnFollow,
  };

  const handleToggleBluesky = useCallback(
    async (value: boolean) => {
      if (value) {
        await registerForBlueskyPush(currentSettings);
      } else {
        await unregisterFromBlueskyPush();
      }
    },
    [registerForBlueskyPush, unregisterFromBlueskyPush, currentSettings]
  );

  const handleToggleNotifyType = useCallback(
    (setter: (v: boolean) => void, key: keyof typeof currentSettings) =>
      async (value: boolean) => {
        setter(value);
        if (blueskyNotificationsEnabled) {
          await updateBlueskyPushSettings({ ...currentSettings, [key]: value });
        }
      },
    [blueskyNotificationsEnabled, updateBlueskyPushSettings, currentSettings]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Bluesky push notifications */}
        <View style={styles.section}>
          <SectionHeader title={t('notifications.bluesky.sectionTitle')} />
          <SectionCard>
            <SwitchRow
              title={t('notifications.bluesky.enable')}
              subtitle={t('notifications.bluesky.enableSubtitle')}
              value={blueskyNotificationsEnabled}
              onValueChange={handleToggleBluesky}
            />
            {blueskyNotificationsEnabled && (
              <>
                <SwitchRow
                  title={t('notifications.bluesky.like')}
                  value={notifyOnLike}
                  onValueChange={handleToggleNotifyType(setNotifyOnLike, 'notifyOnLike')}
                />
                <SwitchRow
                  title={t('notifications.bluesky.reply')}
                  value={notifyOnReply}
                  onValueChange={handleToggleNotifyType(setNotifyOnReply, 'notifyOnReply')}
                />
                <SwitchRow
                  title={t('notifications.bluesky.mention')}
                  value={notifyOnMention}
                  onValueChange={handleToggleNotifyType(setNotifyOnMention, 'notifyOnMention')}
                />
                <SwitchRow
                  title={t('notifications.bluesky.repost')}
                  value={notifyOnRepost}
                  onValueChange={handleToggleNotifyType(setNotifyOnRepost, 'notifyOnRepost')}
                />
                <SwitchRow
                  title={t('notifications.bluesky.follow')}
                  value={notifyOnFollow}
                  onValueChange={handleToggleNotifyType(setNotifyOnFollow, 'notifyOnFollow')}
                  isLast
                />
              </>
            )}
          </SectionCard>
        </View>

        {/* Study reminders */}
        <View style={styles.section}>
          <SectionHeader title={t('sections.notifications')} />
          <SectionCard>
            <SwitchRow
              title={t('notifications.quizReminder')}
              subtitle={t('notifications.quizReminderSubtitle')}
              value={quizReminderEnabled}
              onValueChange={handleToggleQuizReminder}
            />
            <SwitchRow
              title={t('notifications.wordReminder')}
              subtitle={t('notifications.wordReminderSubtitle')}
              value={wordReminderEnabled}
              onValueChange={handleToggleWordReminder}
              isLast={!(quizReminderEnabled || wordReminderEnabled)}
            />
            {(quizReminderEnabled || wordReminderEnabled) && (
              <NavRow
                title={t('notifications.reminderTime')}
                subtitle={`${String(reminderHour).padStart(2, '0')}:${String(reminderMinute).padStart(2, '0')}`}
                onPress={() => setTimePickerVisible(true)}
                isLast
              />
            )}
          </SectionCard>
        </View>
      </ScrollView>

      <TimePickerModal
        visible={timePickerVisible}
        initialHour={reminderHour}
        initialMinute={reminderMinute}
        onConfirm={(hour, minute) => {
          setReminderTime(hour, minute);
          setTimePickerVisible(false);
        }}
        onCancel={() => setTimePickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    color: Colors.textSecondary,
  },
  sectionContent: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: FontSizes.lg,
    color: Colors.text,
  },
  rowSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  arrow: {
    fontSize: FontSizes.xxl,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm,
  },
});

export default NotificationSettingsScreen;
