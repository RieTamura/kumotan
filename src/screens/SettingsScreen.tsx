/**
 * Settings Screen
 * App settings, account management, and data operations
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Image,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { APP_INFO, EXTERNAL_LINKS } from '../constants/config';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/common/Button';
import { hasApiKey } from '../services/dictionary/deepl';
import { hasClientId } from '../services/dictionary/yahooJapan';
import { exportWords, deleteAllWords } from '../services/database/words';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import type { RootStackParamList } from '../navigation/AppNavigator';

/**
 * Settings item component props
 */
interface SettingsItemProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  showArrow?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Settings item component
 */
function SettingsItem({
  title,
  subtitle,
  onPress,
  showArrow = true,
  danger = false,
  disabled = false,
}: SettingsItemProps): React.JSX.Element {
  return (
    <Pressable
      style={[styles.settingsItem, disabled && styles.settingsItemDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.settingsItemContent}>
        <Text
          style={[
            styles.settingsItemTitle,
            danger && styles.settingsItemTitleDanger,
          ]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.settingsItemSubtitle}>{subtitle}</Text>
        )}
      </View>
      {showArrow && <Text style={styles.settingsItemArrow}>›</Text>}
    </Pressable>
  );
}

/**
 * Settings section component
 */
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

/**
 * SettingsScreen Component
 */
export function SettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout, isLoading, profile, isProfileLoading } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [apiKeySet, setApiKeySet] = useState(false);
  const [yahooClientIdSet, setYahooClientIdSet] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toastState, showSuccess, showError, hideToast } = useToast();

  /**
   * Check API key status on mount and when screen gains focus
   */
  useEffect(() => {
    const checkApiKeys = async () => {
      const hasKey = await hasApiKey();
      setApiKeySet(hasKey);
      
      const hasYahooId = await hasClientId();
      setYahooClientIdSet(hasYahooId);
    };
    checkApiKeys();

    const unsubscribe = navigation.addListener('focus', () => {
      checkApiKeys();
    });

    return unsubscribe;
  }, [navigation]);

  /**
   * Handle logout button press
   */
  const handleLogout = useCallback(async () => {
    Alert.alert(
      'ログアウトしますか？',
      '単語帳データは保持されます',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            await logout();
            setIsLoggingOut(false);
          },
        },
      ]
    );
  }, [logout]);

  /**
   * Handle DeepL API Key settings
   */
  const handleDeepLApiKeySettings = useCallback(() => {
    navigation.navigate('ApiKeySetup', { section: 'deepl' });
  }, [navigation]);

  /**
   * Handle Yahoo JAPAN Client ID settings
   */
  const handleYahooApiKeySettings = useCallback(() => {
    navigation.navigate('ApiKeySetup', { section: 'yahoo' });
  }, [navigation]);

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
          '単語帳が空です',
          'エクスポートする単語がありません。',
          [{ text: 'OK' }]
        );
        return;
      }

      const jsonData = JSON.stringify(words, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const fileName = `kumotan-words-${timestamp}.json`;

      // Share the JSON data
      const shareResult = await Share.share({
        message: jsonData,
        title: fileName,
      }, {
        dialogTitle: '単語データをエクスポート',
      });

      if (shareResult.action === Share.sharedAction) {
        showSuccess(`${words.length}個の単語をエクスポートしました`);
      }
    } catch (error) {
      console.error('Export error:', error);
      showError('エクスポートに失敗しました');
    } finally {
      setIsExporting(false);
    }
  }, [showSuccess, showError]);

  /**
   * Handle delete all data
   */
  const handleDeleteAllData = useCallback(() => {
    Alert.alert(
      'すべてのデータを削除',
      'この操作は取り消せません。本当にすべての単語データを削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const result = await deleteAllWords();

              if (!result.success) {
                showError(result.error.message);
                return;
              }

              showSuccess('すべてのデータを削除しました');
            } catch (error) {
              console.error('Delete error:', error);
              showError('削除に失敗しました');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [showSuccess, showError]);

  /**
   * Handle license screen navigation
   */
  const handleLicensePress = useCallback(() => {
    navigation.navigate('License');
  }, [navigation]);

  /**
   * Open external link
   */
  const openLink = useCallback(async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('エラー', 'リンクを開けませんでした。');
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>設定</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Account Section */}
        <SettingsSection title="アカウント">
          <View style={styles.accountInfo}>
            {isProfileLoading ? (
              <View style={styles.accountLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.accountLoadingText}>読み込み中...</Text>
              </View>
            ) : (
              <>
                {/* Avatar */}
                {profile?.avatar ? (
                  <Image
                    source={{ uri: profile.avatar }}
                    style={styles.accountAvatar}
                  />
                ) : (
                  <View style={styles.accountAvatarPlaceholder}>
                    <Text style={styles.accountAvatarText}>
                      {profile?.handle?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                )}

                {/* Profile Details */}
                <View style={styles.accountDetails}>
                  {profile?.displayName && (
                    <Text style={styles.accountDisplayName}>
                      {profile.displayName}
                    </Text>
                  )}
                  <Text style={styles.accountHandle}>
                    @{profile?.handle ?? user?.handle ?? 'unknown'}
                  </Text>
                  {profile?.description && (
                    <Text style={styles.accountDescription} numberOfLines={2}>
                      {profile.description}
                    </Text>
                  )}
                  {/* Stats */}
                  {(profile?.followersCount !== undefined || profile?.followsCount !== undefined) && (
                    <View style={styles.accountStats}>
                      {profile.postsCount !== undefined && (
                        <Text style={styles.accountStat}>
                          <Text style={styles.accountStatValue}>{profile.postsCount}</Text>
                          {' 投稿'}
                        </Text>
                      )}
                      {profile.followersCount !== undefined && (
                        <Text style={styles.accountStat}>
                          <Text style={styles.accountStatValue}>{profile.followersCount}</Text>
                          {' フォロワー'}
                        </Text>
                      )}
                      {profile.followsCount !== undefined && (
                        <Text style={styles.accountStat}>
                          <Text style={styles.accountStatValue}>{profile.followsCount}</Text>
                          {' フォロー中'}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </SettingsSection>

        {/* API Settings Section */}
        <SettingsSection title="API設定">
          <SettingsItem
            title="DeepL API Key"
            subtitle={apiKeySet ? '設定済み ✓' : '未設定'}
            onPress={handleDeepLApiKeySettings}
          />
          <SettingsItem
            title="Yahoo JAPAN Client ID"
            subtitle={yahooClientIdSet ? '設定済み ✓' : '未設定'}
            onPress={handleYahooApiKeySettings}
          />
        </SettingsSection>

        {/* Data Management Section */}
        <SettingsSection title="データ管理">
          <SettingsItem
            title="データをエクスポート"
            subtitle="JSON形式で出力"
            onPress={handleExportData}
            disabled={isExporting}
          />
          <SettingsItem
            title="すべてのデータを削除"
            onPress={handleDeleteAllData}
            danger
            showArrow={false}
            disabled={isDeleting}
          />
        </SettingsSection>

        {/* About Section */}
        <SettingsSection title="その他">
          <SettingsItem
            title="デバッグログ"
            subtitle="TestFlight デバッグ用"
            onPress={() => navigation.navigate('DebugLogs')}
          />
          <SettingsItem
            title="ライセンス"
            onPress={handleLicensePress}
          />
          <SettingsItem
            title="Bluesky API ドキュメント"
            subtitle={EXTERNAL_LINKS.BLUESKY_DOCS}
            onPress={() => openLink(EXTERNAL_LINKS.BLUESKY_DOCS)}
          />
          <SettingsItem
            title="DeepL API ドキュメント"
            subtitle={EXTERNAL_LINKS.DEEPL_DOCS}
            onPress={() => openLink(EXTERNAL_LINKS.DEEPL_DOCS)}
          />
        </SettingsSection>

        {/* Logout Button */}
        <View style={styles.logoutButtonContainer}>
          <Button
            title={isLoggingOut ? 'ログアウト中...' : 'ログアウト'}
            onPress={handleLogout}
            variant="outline"
            fullWidth
            loading={isLoggingOut}
            disabled={isLoading || isLoggingOut}
          />
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>{APP_INFO.NAME}</Text>
          <Text style={styles.appVersion}>
            バージョン {APP_INFO.VERSION}
          </Text>
          <Text style={styles.appTagline}>{APP_INFO.DESCRIPTION}</Text>
        </View>
      </ScrollView>

      {/* Toast Notification */}
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
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
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
  settingsItemTitleDanger: {
    color: Colors.error,
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
  accountInfo: {
    flexDirection: 'row',
    padding: Spacing.lg,
  },
  accountLoading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  accountLoadingText: {
    marginLeft: Spacing.sm,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  accountAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  accountAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountAvatarText: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  accountDetails: {
    marginLeft: Spacing.md,
    flex: 1,
    justifyContent: 'center',
  },
  accountDisplayName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  accountHandle: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  accountDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  accountStats: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  accountStat: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  accountStatValue: {
    fontWeight: '600',
    color: Colors.text,
  },
  logoutButtonContainer: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  appName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  appVersion: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  appTagline: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
});

export default SettingsScreen;
