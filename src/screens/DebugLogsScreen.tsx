/**
 * Debug Logs Screen
 * Display and share application logs for debugging TestFlight builds
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { getLogsAsString, clearLogs } from '../utils/logger';
import { Colors, FontSizes, Spacing } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';

export function DebugLogsScreen(): React.JSX.Element {
  const { t } = useTranslation('debugLogs');
  const { t: tc } = useTranslation('common');
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const logsString = await getLogsAsString();
      setLogs(logsString || t('empty'));
    } catch (error) {
      setLogs(t('loadError'));
      console.error('Failed to load logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(logs);
      Alert.alert(tc('status.success'), t('alerts.copySuccess'));
    } catch (error) {
      Alert.alert(tc('status.error'), t('alerts.copyError'));
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: logs,
        title: t('share.title'),
      });
    } catch (error) {
      Alert.alert(tc('status.error'), t('alerts.shareError'));
    }
  };

  const handleClearLogs = () => {
    Alert.alert(
      t('alerts.deleteTitle'),
      t('alerts.deleteMessage'),
      [
        {
          text: tc('buttons.cancel'),
          style: 'cancel',
        },
        {
          text: tc('buttons.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await clearLogs();
              setLogs(t('empty'));
              Alert.alert(tc('status.success'), t('alerts.deleteSuccess'));
            } catch (error) {
              Alert.alert(tc('status.error'), t('alerts.deleteError'));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('header')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('subtitle')}</Text>
      </View>

      <View style={[styles.buttonContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleCopyToClipboard}
        >
          <Text style={[styles.buttonText, { color: colors.background }]}>{t('actions.copy')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleShare}
        >
          <Text style={[styles.buttonText, { color: colors.background }]}>{t('actions.share')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.backgroundSecondary }]}
          onPress={loadLogs}
        >
          <Text style={[styles.buttonText, { color: colors.textSecondary }]}>{t('actions.reload')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.error }]}
          onPress={handleClearLogs}
        >
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{t('actions.delete')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.logsContainer}>
        {isLoading ? (
          <Text style={[styles.logsText, { color: colors.textSecondary }]}>{t('loading')}</Text>
        ) : (
          <Text style={[styles.logsText, { color: colors.text }]}>{logs}</Text>
        )}
      </ScrollView>

      <View style={[styles.infoContainer, { backgroundColor: colors.primary + '20', borderTopColor: colors.border }]}>
        <Text style={[styles.infoText, { color: colors.text }]}>
          {t('info')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: Colors.primary,
  },
  buttonSecondary: {
    backgroundColor: Colors.textSecondary,
  },
  buttonDanger: {
    backgroundColor: Colors.error,
  },
  buttonText: {
    color: Colors.textInverse,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  logsContainer: {
    flex: 1,
    padding: Spacing.md,
  },
  logsText: {
    fontSize: FontSizes.xs,
    color: Colors.text,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  infoContainer: {
    padding: Spacing.md,
    backgroundColor: Colors.primary + '20',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  infoText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    textAlign: 'center',
  },
});
