/**
 * API Key Setup Screen
 * DeepL API Key configuration and management
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Colors,
  Spacing,
  FontSizes,
  BorderRadius,
  Shadows,
} from '../constants/colors';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import {
  validateApiKey,
  saveApiKey,
  deleteApiKey,
  getApiKey,
  formatUsage,
  isUsageWarning,
  isUsageCritical,
  DeepLUsage,
} from '../services/dictionary/deepl';

/**
 * Navigation prop types
 */
type RootStackParamList = {
  ApiKeySetup: undefined;
  Settings: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'ApiKeySetup'>;

/**
 * API Key Setup Screen Component
 */
export function ApiKeySetupScreen({ navigation }: Props): React.JSX.Element {
  const [apiKey, setApiKey] = useState('');
  const [isKeySet, setIsKeySet] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [usage, setUsage] = useState<DeepLUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check if API key is already set on mount
   */
  useEffect(() => {
    checkExistingKey();
  }, []);

  /**
   * Check for existing API key and get usage
   */
  const checkExistingKey = useCallback(async () => {
    const existingKey = await getApiKey();
    if (existingKey) {
      setIsKeySet(true);
      // Validate and get usage
      const result = await validateApiKey(existingKey);
      if (result.success) {
        setUsage(result.data);
      }
    }
  }, []);

  /**
   * Handle API key validation and save
   */
  const handleValidateAndSave = useCallback(async () => {
    if (!apiKey.trim()) {
      setError('API Keyを入力してください。');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      // Validate the key
      const validateResult = await validateApiKey(apiKey.trim());

      if (!validateResult.success) {
        setError(validateResult.error.message);
        setIsValidating(false);
        return;
      }

      // Save the key
      const saveResult = await saveApiKey(apiKey.trim());

      if (!saveResult.success) {
        setError(saveResult.error.message);
        setIsValidating(false);
        return;
      }

      // Update state
      setUsage(validateResult.data);
      setIsKeySet(true);
      setApiKey('');

      Alert.alert(
        '保存完了',
        'DeepL API Keyが正常に保存されました。',
        [{ text: 'OK' }]
      );
    } finally {
      setIsValidating(false);
    }
  }, [apiKey]);

  /**
   * Handle API key deletion
   */
  const handleDeleteKey = useCallback(async () => {
    Alert.alert(
      'API Keyを削除',
      '本当にDeepL API Keyを削除しますか？日本語翻訳機能が使えなくなります。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            const result = await deleteApiKey();
            setIsDeleting(false);

            if (result.success) {
              setIsKeySet(false);
              setUsage(null);
              Alert.alert('削除完了', 'API Keyが削除されました。');
            } else {
              Alert.alert('エラー', result.error.message);
            }
          },
        },
      ]
    );
  }, []);

  /**
   * Open DeepL signup page
   */
  const handleOpenDeepLSite = useCallback(() => {
    Linking.openURL('https://www.deepl.com/pro-api');
  }, []);

  /**
   * Render usage status
   */
  const renderUsageStatus = () => {
    if (!usage) return null;

    const isWarning = isUsageWarning(usage);
    const isCritical = isUsageCritical(usage);

    let statusColor: string = Colors.success;
    let statusText = '正常';

    if (isCritical) {
      statusColor = Colors.error;
      statusText = '上限に近づいています';
    } else if (isWarning) {
      statusColor = Colors.warning;
      statusText = '注意：使用量が増えています';
    }

    return (
      <View style={styles.usageContainer}>
        <Text style={styles.usageTitle}>今月の使用状況</Text>
        <Text style={styles.usageText}>{formatUsage(usage)}</Text>
        <View style={styles.usageBarContainer}>
          <View
            style={[
              styles.usageBar,
              {
                width: `${Math.min(usage.usagePercentage, 100)}%`,
                backgroundColor: statusColor,
              },
            ]}
          />
        </View>
        <Text style={[styles.usageStatus, { color: statusColor }]}>
          {statusText}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>DeepL API Key設定</Text>
          <Text style={styles.description}>
            日本語翻訳機能を使用するには、DeepL API Keyが必要です。
            無料プランで月50万文字まで翻訳できます。
          </Text>
        </View>

        {/* Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>ステータス</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: isKeySet ? Colors.success : Colors.error },
              ]}
            />
            <Text style={styles.statusText}>
              {isKeySet ? 'API Key設定済み' : 'API Key未設定'}
            </Text>
          </View>
          {isKeySet && renderUsageStatus()}
        </View>

        {/* API Key Input (only show when not set) */}
        {!isKeySet && (
          <View style={styles.inputSection}>
            <Input
              label="DeepL API Key"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
              value={apiKey}
              onChangeText={(text: string) => {
                setApiKey(text);
                setError(null);
              }}
              secureTextEntry
              showPasswordToggle
              error={error ?? undefined}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              title="Keyを検証して保存"
              onPress={handleValidateAndSave}
              loading={isValidating}
              disabled={!apiKey.trim()}
              style={styles.saveButton}
            />
          </View>
        )}

        {/* Delete Key Button (only show when set) */}
        {isKeySet && (
          <Button
            title="API Keyを削除"
            onPress={handleDeleteKey}
            variant="danger"
            loading={isDeleting}
            style={styles.deleteButton}
          />
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>API Keyの取得方法</Text>
          <View style={styles.infoSteps}>
            <Text style={styles.infoStep}>
              1. DeepLの公式サイトでアカウントを作成
            </Text>
            <Text style={styles.infoStep}>
              2. API Free プランに登録（クレジットカード不要）
            </Text>
            <Text style={styles.infoStep}>
              3. アカウント設定からAPI Keyをコピー
            </Text>
            <Text style={styles.infoStep}>
              4. このアプリにAPI Keyを貼り付けて保存
            </Text>
          </View>
          <Button
            title="DeepL APIサイトを開く"
            onPress={handleOpenDeepLSite}
            variant="outline"
            style={styles.linkButton}
          />
        </View>

        {/* Note */}
        <View style={styles.noteSection}>
          <Text style={styles.noteTitle}>📝 注意事項</Text>
          <Text style={styles.noteText}>
            • API Keyは端末に安全に保存されます{'\n'}
            • 無料プランは月50万文字まで翻訳可能{'\n'}
            • 翻訳文字数は毎月1日にリセットされます{'\n'}
            • API Keyが無くても英語の定義は表示されます
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  statusCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  statusLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  usageContainer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  usageTitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  usageText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  usageBarContainer: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  usageBar: {
    height: '100%',
    borderRadius: 4,
  },
  usageStatus: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  inputSection: {
    marginBottom: Spacing.xl,
  },
  saveButton: {
    marginTop: Spacing.md,
  },
  deleteButton: {
    marginBottom: Spacing.xl,
  },
  infoSection: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  infoTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  infoSteps: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  infoStep: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  linkButton: {
    marginTop: Spacing.sm,
  },
  noteSection: {
    backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  noteTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  noteText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});

export default ApiKeySetupScreen;
