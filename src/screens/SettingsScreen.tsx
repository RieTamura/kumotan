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
  Switch,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { APP_INFO, EXTERNAL_LINKS } from '../constants/config';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/common/Button';
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
import { ChevronUp, ChevronDown } from 'lucide-react-native';
import { useTutorial } from '../hooks/useTutorial';
import { useTheme } from '../hooks/useTheme';
import { useCustomFeedSettings } from '../hooks/useCustomFeedSettings';
import { useTabOrderStore } from '../store/tabOrderStore';
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
  const { logout, isLoading } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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
    selectedFeedDisplayName,
    savedFeeds,
    isLoading: isLoadingFeeds,
    selectFeed,
    refreshSavedFeeds,
  } = useCustomFeedSettings();

  const { tabOrder, moveTab } = useTabOrderStore();
  const {
    hapticFeedbackEnabled, setHapticFeedbackEnabled,
    autoSpeechOnPopup, setAutoSpeechOnPopup,
    autoSpeechOnQuiz, setAutoSpeechOnQuiz,
  } = useSettingsStore();

  /**
   * Check dictionary status on mount and when screen gains focus
   */
  useEffect(() => {
    const checkDictionary = async () => {
      const status = await getDictionaryStatus();
      setDictStatus(status.status);
      setDictVersion(status.installedVersion);
      setDictAvailableVersion(status.availableVersion);
    };

    checkDictionary();

    const unsubscribe = navigation.addListener('focus', () => {
      checkDictionary();
      refreshSavedFeeds();
    });

    return unsubscribe;
  }, [navigation, refreshSavedFeeds]);

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
   * Handle custom feed selection
   */
  const handleCustomFeedPress = useCallback(() => {
    if (isLoadingFeeds) {
      Alert.alert(t('sections.feed'), t('feed.customFeedLoading'), [
        { text: tc('buttons.ok') },
      ]);
      return;
    }

    const feedButtons = savedFeeds.map((feed) => ({
      text: feed.displayName,
      onPress: () => selectFeed(feed.uri, feed.displayName),
    }));

    Alert.alert(
      t('feed.customFeedSelect'),
      undefined,
      [
        ...feedButtons,
        {
          text: t('feed.customFeedNone'),
          onPress: () => selectFeed(null, null),
        },
        { text: tc('buttons.cancel'), style: 'cancel' as const },
      ]
    );
  }, [isLoadingFeeds, savedFeeds, selectFeed, t, tc]);

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
          <View style={[styles.settingsItem, { borderBottomColor: colors.divider, borderBottomWidth: 0 }]}>
            <View style={styles.settingsItemContent}>
              <Text style={[styles.settingsItemTitle, { color: colors.text }]}>
                {t('haptic.title')}
              </Text>
              <Text style={[styles.settingsItemSubtitle, { color: colors.textSecondary }]}>
                {t('haptic.subtitle')}
              </Text>
            </View>
            <Switch
              value={hapticFeedbackEnabled}
              onValueChange={setHapticFeedbackEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>
          <View style={[styles.settingsItem, { borderBottomColor: colors.divider }]}>
            <View style={styles.settingsItemContent}>
              <Text style={[styles.settingsItemTitle, { color: colors.text }]}>
                {t('autoSpeech.popup.title')}
              </Text>
              <Text style={[styles.settingsItemSubtitle, { color: colors.textSecondary }]}>
                {t('autoSpeech.popup.subtitle')}
              </Text>
            </View>
            <Switch
              value={autoSpeechOnPopup}
              onValueChange={setAutoSpeechOnPopup}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>
          <View style={[styles.settingsItem, { borderBottomColor: colors.divider, borderBottomWidth: 0 }]}>
            <View style={styles.settingsItemContent}>
              <Text style={[styles.settingsItemTitle, { color: colors.text }]}>
                {t('autoSpeech.quiz.title')}
              </Text>
              <Text style={[styles.settingsItemSubtitle, { color: colors.textSecondary }]}>
                {t('autoSpeech.quiz.subtitle')}
              </Text>
            </View>
            <Switch
              value={autoSpeechOnQuiz}
              onValueChange={setAutoSpeechOnQuiz}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>
        </SettingsSection>

        {/* Feed Section */}
        <SettingsSection title={t('sections.feed')}>
          <SettingsItem
            title={t('feed.customFeed')}
            subtitle={selectedFeedDisplayName ?? t('feed.customFeedNone')}
            onPress={handleCustomFeedPress}
            disabled={isLoadingFeeds}
          />
          {/* Tab order */}
          <View style={[styles.settingsItem, { borderBottomColor: colors.divider, borderBottomWidth: 0 }]}>
            <View style={styles.settingsItemContent}>
              <Text style={[styles.settingsItemTitle, { color: colors.text }]}>
                {t('feed.tabOrder')}
              </Text>
            </View>
          </View>
          {tabOrder.map((key, index) => {
            const label =
              key === 'following'
                ? t('feed.tabFollowing')
                : key === 'profile'
                  ? t('feed.tabProfile')
                  : (selectedFeedDisplayName ?? t('feed.customFeedNone'));
            return (
              <View
                key={key}
                style={[styles.settingsItem, { borderBottomColor: colors.divider }]}
              >
                <View style={styles.settingsItemContent}>
                  <Text style={[styles.settingsItemTitle, { color: colors.text }]}>
                    {label}
                  </Text>
                </View>
                <View style={styles.tabOrderButtons}>
                  <Pressable
                    onPress={() => moveTab(index, index - 1)}
                    disabled={index === 0}
                    style={[
                      styles.tabOrderButton,
                      { borderColor: index === 0 ? colors.disabled : colors.border },
                      index === 0 && styles.tabOrderButtonDisabled,
                    ]}
                    accessibilityLabel={t('feed.tabMoveUp')}
                  >
                    <ChevronUp size={16} color={index === 0 ? colors.disabled : colors.text} />
                  </Pressable>
                  <Pressable
                    onPress={() => moveTab(index, index + 1)}
                    disabled={index === tabOrder.length - 1}
                    style={[
                      styles.tabOrderButton,
                      { borderColor: index === tabOrder.length - 1 ? colors.disabled : colors.border },
                      index === tabOrder.length - 1 && styles.tabOrderButtonDisabled,
                    ]}
                    accessibilityLabel={t('feed.tabMoveDown')}
                  >
                    <ChevronDown size={16} color={index === tabOrder.length - 1 ? colors.disabled : colors.text} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </SettingsSection>

        {/* API & Translation Section */}
        <SettingsSection title={t('sections.apiTranslation')}>
          <SettingsItem
            title={t('sections.apiTranslation')}
            subtitle={t('sections.apiTranslationSubtitle')}
            onPress={() => navigation.navigate('ApiTranslationSettings')}
          />
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
            title={t('sections.dataManagement')}
            subtitle={t('sections.dataManagementSubtitle')}
            onPress={() => navigation.navigate('DataManagement')}
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
  tabOrderButtons: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  tabOrderButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabOrderButtonDisabled: {
    opacity: 0.35,
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
