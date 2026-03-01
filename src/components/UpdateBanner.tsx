/**
 * UpdateBanner
 * Shown at the top of the notification screen when an app or dictionary update is available.
 * Reads from notificationStore; renders nothing when no updates are detected.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Bell, BookOpen, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Spacing, FontSizes, BorderRadius } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import { useNotificationStore } from '../store/notificationStore';
import { UpdateNotesModal } from './UpdateNotesModal';

export function UpdateBanner(): React.JSX.Element | null {
  const { t } = useTranslation('home');
  const { colors } = useTheme();

  const availableAppVersion = useNotificationStore((s) => s.availableAppVersion);
  const availableAppReleaseNotes = useNotificationStore((s) => s.availableAppReleaseNotes);
  const availableAppReleaseUrl = useNotificationStore((s) => s.availableAppReleaseUrl);
  const clearAppUpdate = useNotificationStore((s) => s.clearAppUpdate);

  const dictionaryUpdateAvailable = useNotificationStore((s) => s.dictionaryUpdateAvailable);
  const dictionaryLatestCommitMessage = useNotificationStore((s) => s.dictionaryLatestCommitMessage);
  const clearDictionaryUpdate = useNotificationStore((s) => s.clearDictionaryUpdate);

  const [appModalVisible, setAppModalVisible] = useState(false);
  const [dictModalVisible, setDictModalVisible] = useState(false);

  if (!availableAppVersion && !dictionaryUpdateAvailable) {
    return null;
  }

  return (
    <>
      <View style={[styles.container, { borderBottomColor: colors.border }]}>
        {availableAppVersion && (
          <View style={[styles.banner, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Bell size={16} color={colors.primary} style={styles.icon} />
            <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
              {t('updates.appUpdate', { version: availableAppVersion })}
            </Text>
            <Pressable
              style={styles.detailsButton}
              onPress={() => setAppModalVisible(true)}
              hitSlop={8}
            >
              <Text style={[styles.detailsText, { color: colors.primary }]}>
                {t('updates.details')}
              </Text>
            </Pressable>
            <Pressable onPress={clearAppUpdate} hitSlop={8} style={styles.dismissButton}>
              <X size={14} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}

        {dictionaryUpdateAvailable && (
          <View style={[styles.banner, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <BookOpen size={16} color={colors.primary} style={styles.icon} />
            <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
              {t('updates.dictionaryUpdate')}
            </Text>
            <Pressable
              style={styles.detailsButton}
              onPress={() => setDictModalVisible(true)}
              hitSlop={8}
            >
              <Text style={[styles.detailsText, { color: colors.primary }]}>
                {t('updates.details')}
              </Text>
            </Pressable>
            <Pressable onPress={clearDictionaryUpdate} hitSlop={8} style={styles.dismissButton}>
              <X size={14} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}
      </View>

      {availableAppVersion && (
        <UpdateNotesModal
          visible={appModalVisible}
          type="app"
          version={availableAppVersion}
          releaseNotes={availableAppReleaseNotes ?? ''}
          releaseUrl={availableAppReleaseUrl ?? ''}
          onClose={() => setAppModalVisible(false)}
        />
      )}

      {dictionaryUpdateAvailable && (
        <UpdateNotesModal
          visible={dictModalVisible}
          type="dictionary"
          commitMessage={dictionaryLatestCommitMessage ?? ''}
          onClose={() => setDictModalVisible(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    marginRight: Spacing.sm,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: FontSizes.sm,
    marginRight: Spacing.sm,
  },
  detailsButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    flexShrink: 0,
  },
  detailsText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  dismissButton: {
    paddingLeft: Spacing.sm,
    paddingVertical: Spacing.xs,
    flexShrink: 0,
  },
});
