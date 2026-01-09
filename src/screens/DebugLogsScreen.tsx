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
import * as Clipboard from 'expo-clipboard';
import { getLogs, getLogsAsString, clearLogs } from '../utils/logger';
import { Colors, FontSizes, Spacing } from '../constants/colors';

export function DebugLogsScreen(): React.JSX.Element {
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const logsString = await getLogsAsString();
      setLogs(logsString || 'ログがありません');
    } catch (error) {
      setLogs('ログの読み込みに失敗しました');
      console.error('Failed to load logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(logs);
      Alert.alert('成功', 'ログをクリップボードにコピーしました');
    } catch (error) {
      Alert.alert('エラー', 'コピーに失敗しました');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: logs,
        title: 'くもたん デバッグログ',
      });
    } catch (error) {
      Alert.alert('エラー', '共有に失敗しました');
    }
  };

  const handleClearLogs = () => {
    Alert.alert(
      'ログを削除',
      '全てのログを削除しますか？',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
        },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearLogs();
              setLogs('ログがありません');
              Alert.alert('成功', 'ログを削除しました');
            } catch (error) {
              Alert.alert('エラー', 'ログの削除に失敗しました');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>デバッグログ</Text>
        <Text style={styles.subtitle}>TestFlight デバッグ用</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleCopyToClipboard}
        >
          <Text style={styles.buttonText}>コピー</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleShare}
        >
          <Text style={styles.buttonText}>共有</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={loadLogs}
        >
          <Text style={styles.buttonText}>再読み込み</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonDanger]}
          onPress={handleClearLogs}
        >
          <Text style={styles.buttonText}>削除</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.logsContainer}>
        {isLoading ? (
          <Text style={styles.logsText}>読み込み中...</Text>
        ) : (
          <Text style={styles.logsText}>{logs}</Text>
        )}
      </ScrollView>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          ℹ️ このログを共有またはコピーして、開発者に送信してください
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
