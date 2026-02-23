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
  Switch,
  Pressable,
  Alert,
  Linking,
  Image,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { APP_INFO, EXTERNAL_LINKS } from '../constants/config';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/common/Button';
import { hasApiKey, getUsage, formatUsage, isUsageCritical, isUsageWarning, type DeepLUsage } from '../services/dictionary/deepl';
import { hasClientId } from '../services/dictionary/yahooJapan';
import { exportWords, deleteAllWords } from '../services/database/words';
import { restoreWordsFromPds } from '../services/pds/vocabularySync';
import { getAgent } from '../services/bluesky/auth';
import { useWordStore } from '../store/wordStore';
import {
  getDictionaryStatus,
  deleteDictionary,
  type InstallStatus,
} from '../services/dictionary/ExternalDictionaryService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { changeLanguage, getCurrentLanguage, type Language } from '../locales';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { FeedbackModal, type FeedbackType } from '../components/FeedbackModal';
import { GithubIcon } from '../components/common/GithubIcon';
import { useTutorial } from '../hooks/useTutorial';
import { useTheme } from '../hooks/useTheme';
import { useSettingsStore } from '../store/settingsStore';

/**
 * Settings item component props
 */
interface SettingsItemProps {
  title: string;
  subtitle?: string;
  subtitleColor?: string;
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
  subtitleColor,
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
          <Text style={[styles.settingsItemSubtitle, { color: subtitleColor ?? colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {showArrow && <Text style={[styles.settingsItemArrow, { color: colors.textTertiary }]}>›</Text>}
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
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>{children}</View>
    </View>
  );
}

/**
 * SettingsScreen Component
 */
export function SettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { logout, isLoading, isAuthenticated } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [apiKeySet, setApiKeySet] = useState(false);
  const [deepLUsage, setDeepLUsage] = useState<DeepLUsage | null>(null);
  const [yahooClientIdSet, setYahooClientIdSet] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentLang, setCurrentLang] = useState<Language>(getCurrentLanguage());
  const [dictStatus, setDictStatus] = useState<InstallStatus>('not_installed');
  const [dictVersion, setDictVersion] = useState<string | null>(null);
  const [dictAvailableVersion, setDictAvailableVersion] = useState<string | undefined>();
  const [isDeletingDict, setIsDeletingDict] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const { toastState, showSuccess, showError, hideToast } = useToast();
  const { resetTutorial } = useTutorial([], false);
  const { colors, mode, setMode, isDark } = useTheme();
  const {
    translateDefinition, setTranslateDefinition,
    translateSentenceToEnglish, setTranslateSentenceToEnglish,
    translateDefinitionInEnglishSentence, setTranslateDefinitionInEnglishSentence,
  } = useSettingsStore();

  /**
   * Check API key and dictionary status on mount and when screen gains focus
   */
  useEffect(() => {
    const checkApiKeys = async () => {
      const hasKey = await hasApiKey();
      setApiKeySet(hasKey);

      if (hasKey) {
        const usageResult = await getUsage();
        setDeepLUsage(usageResult.success ? usageResult.data : null);
      } else {
        setDeepLUsage(null);
      }

      const hasYahooId = await hasClientId();
      setYahooClientIdSet(hasYahooId);
    };

    const checkDictionary = async () => {
      const status = await getDictionaryStatus();
      setDictStatus(status.status);
      setDictVersion(status.installedVersion);
      setDictAvailableVersion(status.availableVersion);
    };

    checkApiKeys();
    checkDictionary();

    const unsubscribe = navigation.addListener('focus', () => {
      checkApiKeys();
      checkDictionary();
    });

    return unsubscribe;
  }, [navigation]);

  /**
   * Handle language change
   */
  const handleLanguageChange = useCallback(() => {
    Alert.alert(
      t('language.selectTitle'),
      undefined,
      [
        {
          text: t('language.japanese'),
          onPress: async () => {
            await changeLanguage('ja');
            setCurrentLang('ja');
          },
        },
        {
          text: t('language.english'),
          onPress: async () => {
            await changeLanguage('en');
            setCurrentLang('en');
          },
        },
        { text: tc('buttons.cancel'), style: 'cancel' },
      ]
    );
  }, [t, tc]);

  /**
   * Handle theme change
   */
  const handleThemeChange = useCallback(() => {
    Alert.alert(
      t('appearance.selectTheme'),
      undefined,
      [
        {
          text: t('appearance.system'),
          onPress: () => setMode('system'),
        },
        {
          text: t('appearance.light'),
          onPress: () => setMode('light'),
        },
        {
          text: t('appearance.dark'),
          onPress: () => setMode('dark'),
        },
        { text: tc('buttons.cancel'), style: 'cancel' },
      ]
    );
  }, [setMode, t, tc]);

  /**
   * Handle logout button press
   */
  const handleLogout = useCallback(async () => {
    Alert.alert(
      t('logout.confirmTitle'),
      t('logout.confirmMessage'),
      [
        { text: tc('buttons.cancel'), style: 'cancel' },
        {
          text: t('logout.button'),
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            await logout();
            setIsLoggingOut(false);
          },
        },
      ]
    );
  }, [logout, t, tc]);

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
          t('data.exportEmpty'),
          t('data.exportEmptyMessage'),
          [{ text: tc('buttons.ok') }]
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

              // ストアを再読み込みして単語帳ページに反映
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
   * Handle license screen navigation
   */
  const handleLicensePress = useCallback(() => {
    navigation.navigate('License');
  }, [navigation]);

  /**
   * Handle dictionary download navigation
   */
  const handleDictionaryDownload = useCallback(() => {
    navigation.navigate('DictionarySetup');
  }, [navigation]);

  /**
   * Handle dictionary delete
   */
  const handleDictionaryDelete = useCallback(() => {
    Alert.alert(
      t('dictionary.deleteConfirmTitle'),
      t('dictionary.deleteConfirmMessage'),
      [
        { text: tc('buttons.cancel'), style: 'cancel' },
        {
          text: tc('buttons.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsDeletingDict(true);
            try {
              const result = await deleteDictionary();

              if (!result.success) {
                showError(result.error.message);
                return;
              }

              // 状態を更新
              setDictStatus('not_installed');
              setDictVersion(null);
              showSuccess(t('dictionary.deleteSuccess'));
            } catch (error) {
              console.error('Dictionary delete error:', error);
              showError(t('dictionary.deleteError'));
            } finally {
              setIsDeletingDict(false);
            }
          },
        },
      ]
    );
  }, [showSuccess, showError, t, tc]);

  /**
   * Open external link
   */
  const openLink = useCallback(async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(tc('status.error'), t('linkError'));
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  }, [t, tc]);

  /**
   * Handle feedback modal
   */
  const openFeedback = useCallback((type: FeedbackType) => {
    setFeedbackType(type);
    setFeedbackVisible(true);
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('header')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Notifications Section */}
        <SettingsSection title={t('sections.notifications')}>
          <SettingsItem
            title={t('notifications.settingsTitle')}
            subtitle={t('notifications.settingsSubtitle')}
            onPress={() => navigation.navigate('NotificationSettings')}
          />
        </SettingsSection>

        {/* General Section (Language + Appearance) */}
        <SettingsSection title={t('sections.general')}>
          <SettingsItem
            title={t('language.title')}
            subtitle={currentLang === 'ja' ? t('language.japanese') : t('language.english')}
            onPress={handleLanguageChange}
          />
          <SettingsItem
            title={t('appearance.theme')}
            subtitle={
              mode === 'system'
                ? t('appearance.system')
                : mode === 'light'
                  ? t('appearance.light')
                  : t('appearance.dark')
            }
            onPress={handleThemeChange}
          />
        </SettingsSection>

        {/* API & Translation Section */}
        <SettingsSection title={t('sections.apiTranslation')}>
          <SettingsItem
            title={t('api.deepLKey')}
            subtitle={
              apiKeySet && deepLUsage
                ? formatUsage(deepLUsage)
                : apiKeySet
                  ? t('api.configured')
                  : t('api.notConfigured')
            }
            subtitleColor={
              apiKeySet && deepLUsage
                ? isUsageCritical(deepLUsage)
                  ? colors.error
                  : isUsageWarning(deepLUsage)
                    ? colors.warning
                    : undefined
                : undefined
            }
            onPress={handleDeepLApiKeySettings}
          />
          <SettingsItem
            title={t('api.yahooClientId')}
            subtitle={yahooClientIdSet ? t('api.configured') : t('api.notConfigured')}
            onPress={handleYahooApiKeySettings}
          />
          <View style={[styles.settingsItem, { borderBottomColor: colors.divider }]}>
            <View style={styles.settingsItemContent}>
              <Text style={[styles.settingsItemTitle, { color: apiKeySet ? colors.text : colors.textTertiary }]}>
                {t('translation.translateDefinition')}
              </Text>
              <Text style={[styles.settingsItemSubtitle, { color: colors.textSecondary }]}>
                {apiKeySet
                  ? t('translation.translateDefinitionDescription')
                  : t('translation.translateDefinitionNoApiKey')}
              </Text>
            </View>
            <Switch
              value={apiKeySet ? translateDefinition : false}
              onValueChange={setTranslateDefinition}
              disabled={!apiKeySet}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>
          <View style={[styles.settingsItem, { borderBottomColor: colors.divider }]}>
            <View style={styles.settingsItemContent}>
              <Text style={[styles.settingsItemTitle, { color: apiKeySet ? colors.text : colors.textTertiary }]}>
                {t('translation.translateSentenceToEnglish')}
              </Text>
              <Text style={[styles.settingsItemSubtitle, { color: colors.textSecondary }]}>
                {apiKeySet
                  ? t('translation.translateSentenceToEnglishDescription')
                  : t('translation.translateSentenceToEnglishNoApiKey')}
              </Text>
            </View>
            <Switch
              value={apiKeySet ? translateSentenceToEnglish : false}
              onValueChange={setTranslateSentenceToEnglish}
              disabled={!apiKeySet}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>
          <View style={[styles.settingsItem, { borderBottomColor: colors.divider }]}>
            <View style={styles.settingsItemContent}>
              <Text style={[styles.settingsItemTitle, { color: apiKeySet ? colors.text : colors.textTertiary }]}>
                {t('translation.translateDefinitionInEnglishSentence')}
              </Text>
              <Text style={[styles.settingsItemSubtitle, { color: colors.textSecondary }]}>
                {apiKeySet
                  ? t('translation.translateDefinitionInEnglishSentenceDescription')
                  : t('translation.translateDefinitionInEnglishSentenceNoApiKey')}
              </Text>
            </View>
            <Switch
              value={apiKeySet ? translateDefinitionInEnglishSentence : false}
              onValueChange={setTranslateDefinitionInEnglishSentence}
              disabled={!apiKeySet}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>
        </SettingsSection>

        {/* Dictionary Section */}
        <SettingsSection title={t('sections.dictionary')}>
          {dictStatus === 'installed' || dictStatus === 'update_available' ? (
            <>
              <SettingsItem
                title={t('dictionary.title')}
                subtitle={
                  dictStatus === 'update_available' && dictAvailableVersion
                    ? t('dictionary.updateSubtitle', { version: dictAvailableVersion })
                    : t('dictionary.installed', { version: dictVersion ?? '?' })
                }
                onPress={
                  dictStatus === 'update_available'
                    ? handleDictionaryDownload
                    : () => { }
                }
                showArrow={dictStatus === 'update_available'}
              />
              <SettingsItem
                title={t('dictionary.delete')}
                onPress={handleDictionaryDelete}
                danger
                showArrow={false}
                disabled={isDeletingDict}
              />
            </>
          ) : (
            <SettingsItem
              title={t('dictionary.download')}
              subtitle={t('dictionary.downloadSubtitle')}
              onPress={handleDictionaryDownload}
            />
          )}
        </SettingsSection>

        {/* Data Management Section */}
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

        {/* Support Section (Tips + Feedback) */}
        <SettingsSection title={t('sections.support')}>
          <SettingsItem
            title={t('tips.title')}
            subtitle={t('tips.subtitle')}
            onPress={() => navigation.navigate('Tips')}
          />
          <SettingsItem
            title={t('tips.reset')}
            subtitle={t('tips.resetSubtitle')}
            onPress={() => {
              Alert.alert(
                t('tips.resetConfirmTitle'),
                t('tips.resetConfirmMessage'),
                [
                  { text: tc('buttons.cancel'), style: 'cancel' },
                  {
                    text: tc('buttons.ok'),
                    onPress: async () => {
                      await resetTutorial();
                      showSuccess(t('tips.resetSuccess'));
                    },
                  },
                ]
              );
            }}
          />
          <SettingsItem
            title={t('feedbackItems.reportBug')}
            subtitle={t('feedbackItems.reportBugSubtitle')}
            onPress={() => openFeedback('bug')}
          />
          <SettingsItem
            title={t('feedbackItems.suggest')}
            subtitle={t('feedbackItems.suggestSubtitle')}
            onPress={() => openFeedback('feature')}
          />
        </SettingsSection>

        {/* Other Section (Moderation + About) */}
        <SettingsSection title={t('sections.other')}>
          <SettingsItem
            title={t('moderation.title')}
            subtitle={t('moderation.subtitle')}
            onPress={() => openLink(EXTERNAL_LINKS.BLUESKY_MODERATION)}
          />
          <SettingsItem
            title={t('other.debugLogs')}
            subtitle={t('other.debugLogsSubtitle')}
            onPress={() => navigation.navigate('DebugLogs')}
          />
          <SettingsItem
            title={t('other.license')}
            onPress={handleLicensePress}
          />
          <SettingsItem
            title={t('support.donate')}
            subtitle={t('support.donateSubtitle')}
            onPress={() => openLink(EXTERNAL_LINKS.GITHUB_SPONSORS)}
          />
          <SettingsItem
            title={t('support.star')}
            subtitle={t('support.starSubtitle')}
            onPress={() => openLink(EXTERNAL_LINKS.GITHUB_REPO)}
          />
        </SettingsSection>

        {/* Logout Button */}
        <View style={styles.logoutButtonContainer}>
          <Button
            title={isLoggingOut ? t('logout.loggingOut') : t('logout.button')}
            onPress={handleLogout}
            variant="outline"
            fullWidth
            loading={isLoggingOut}
            disabled={isLoading || isLoggingOut}
          />
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appName, { color: colors.primary }]}>{APP_INFO.NAME}</Text>
          <Text style={[styles.appVersion, { color: colors.textSecondary }]}>
            {t('version', { version: APP_INFO.VERSION })}
          </Text>
          <Text style={[styles.appTagline, { color: colors.textTertiary }]}>{APP_INFO.DESCRIPTION}</Text>

          <View style={styles.legalLinksContainer}>
            <Pressable onPress={() => navigation.navigate('LegalDocument', { type: 'terms' })}>
              <Text style={[styles.legalLink, { color: colors.textTertiary }]}>
                {t('legal:links.termsOfService')}
              </Text>
            </Pressable>
            <Text style={[styles.legalSeparator, { color: colors.textTertiary }]}>|</Text>
            <Pressable onPress={() => navigation.navigate('LegalDocument', { type: 'privacy' })}>
              <Text style={[styles.legalLink, { color: colors.textTertiary }]}>
                {t('legal:links.privacyPolicy')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.socialIconsContainer}>
            <Pressable
              onPress={() => openLink(EXTERNAL_LINKS.BLUESKY_ACCOUNT)}
              style={styles.socialIconWrapper}
            >
              <Image
                source={require('../../assets/bluesky-logo.png')}
                style={[styles.blueskyIcon, isDark && { tintColor: colors.text }]}
              />
            </Pressable>

            <Pressable
              onPress={() => openLink(EXTERNAL_LINKS.GITHUB_REPO)}
              style={styles.socialIconWrapper}
            >
              <GithubIcon size={28} color={isDark ? colors.text : '#181717'} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Feedback Modal */}
      <FeedbackModal
        visible={feedbackVisible}
        type={feedbackType}
        onClose={() => setFeedbackVisible(false)}
      />

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
    minHeight: 56,
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
  legalLinksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  legalLink: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  socialIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    gap: Spacing.xl,
  },
  socialIconWrapper: {
    padding: Spacing.sm,
  },
  blueskyIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
});

export default SettingsScreen;
