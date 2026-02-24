/**
 * Data Management Screen
 * Export, restore, and delete word data
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { exportWords, deleteAllWords } from '../services/database/words';
import { restoreWordsFromPds } from '../services/pds/vocabularySync';
import { getAgent } from '../services/bluesky/auth';
import { useWordStore } from '../store/wordStore';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

interface SettingsItemProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  showArrow?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

function SettingsItem({
  title,
  subtitle,
  onPress,
  showArrow = true,
  danger = false,
  disabled = false,
}: SettingsItemProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <Pressable
      style={[
        styles.settingsItem,
        { borderBottomColor: colors.divider },
        disabled && styles.settingsItemDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.settingsItemContent}>
        <Text
          style={[
            styles.settingsItemTitle,
            { color: danger ? colors.error : colors.text },
          ]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.settingsItemSubtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {showArrow && (
        <Text style={[styles.settingsItemArrow, { color: colors.textTertiary }]}>›</Text>
      )}
    </Pressable>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>{children}</View>
    </View>
  );
}

export function DataManagementScreen(): React.JSX.Element {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { colors } = useTheme();
  const { isAuthenticated } = useAuthStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toastState, showSuccess, showError, hideToast } = useToast();

  /**
   * Handle data export
   */
  const handleExportData = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = await exportWords();

      if (!result.success) {
        showError(result.error.message);
        return;
      }

      const words = result.data;

      if (words.length === 0) {
        Alert.alert(
          t('data.exportEmpty'),
          t('data.exportEmptyMessage'),
          [{ text: tc('buttons.ok') }]
        );
        return;
      }

      const jsonData = JSON.stringify(words, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const fileName = `kumotan-words-${timestamp}.json`;

      const shareResult = await Share.share({
        message: jsonData,
        title: fileName,
      }, {
        dialogTitle: t('data.exportDialogTitle'),
      });

      if (shareResult.action === Share.sharedAction) {
        showSuccess(t('data.exportSuccess', { count: words.length }));
      }
    } catch (error) {
      console.error('Export error:', error);
      showError(t('data.exportError'));
    } finally {
      setIsExporting(false);
    }
  }, [showSuccess, showError, t, tc]);

  /**
   * Handle PDS restore
   */
  const handlePdsRestore = useCallback(() => {
    if (!isAuthenticated) {
      showError(t('pds.restoreError'));
      return;
    }

    Alert.alert(
      t('pds.restoreTitle'),
      t('pds.restoreConfirm'),
      [
        { text: tc('buttons.cancel'), style: 'cancel' },
        {
          text: tc('buttons.ok'),
          onPress: async () => {
            setIsRestoring(true);
            try {
              const agent = getAgent();
              const result = await restoreWordsFromPds(agent);

              await useWordStore.getState().loadWords();

              if (result.total === 0) {
                showSuccess(t('pds.restoreEmpty'));
              } else if (result.untranslated > 0) {
                showSuccess(
                  t('pds.restoreSuccessWithUntranslated', {
                    restored: result.restored,
                    skipped: result.skipped,
                    untranslated: result.untranslated,
                  })
                );
              } else {
                showSuccess(
                  t('pds.restoreSuccess', {
                    restored: result.restored,
                    skipped: result.skipped,
                  })
                );
              }
            } catch (error) {
              console.error('PDS restore error:', error);
              showError(t('pds.restoreError'));
            } finally {
              setIsRestoring(false);
            }
          },
        },
      ]
    );
  }, [isAuthenticated, showSuccess, showError, t, tc]);

  /**
   * Handle delete all data
   */
  const handleDeleteAllData = useCallback(() => {
    Alert.alert(
      t('data.deleteConfirmTitle'),
      t('data.deleteConfirmMessage'),
      [
        { text: tc('buttons.cancel'), style: 'cancel' },
        {
          text: tc('buttons.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const result = await deleteAllWords();

              if (!result.success) {
                showError(result.error.message);
                return;
              }

              showSuccess(t('data.deleteSuccess'));
            } catch (error) {
              console.error('Delete error:', error);
              showError(t('data.deleteError'));
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [showSuccess, showError, t, tc]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <SettingsSection title={t('sections.dataManagement')}>
          <SettingsItem
            title={t('data.export')}
            subtitle={t('data.exportSubtitle')}
            onPress={handleExportData}
            disabled={isExporting}
          />
          <SettingsItem
            title={t('pds.restore')}
            subtitle={t('pds.restoreDescription')}
            onPress={handlePdsRestore}
            disabled={isRestoring || !isAuthenticated}
          />
          <SettingsItem
            title={t('data.deleteAll')}
            onPress={handleDeleteAllData}
            danger
            showArrow={false}
            disabled={isDeleting}
          />
        </SettingsSection>
      </ScrollView>

      <Toast
        visible={toastState.visible}
        message={toastState.message}
        type={toastState.type}
        duration={toastState.duration}
        onDismiss={hideToast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
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
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  sectionContent: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  settingsItemDisabled: {
    opacity: 0.5,
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: FontSizes.lg,
    color: Colors.text,
  },
  settingsItemSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  settingsItemArrow: {
    fontSize: FontSizes.xxl,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm,
  },
});
