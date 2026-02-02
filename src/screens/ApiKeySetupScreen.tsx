/**
 * API Key Setup Screen
 * DeepL API Key and Yahoo! Client ID configuration and management
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
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
import { useTranslation } from 'react-i18next';
import {
  Colors,
  Spacing,
  FontSizes,
  BorderRadius,
  Shadows,
} from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
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
import {
  validateClientId,
  saveClientId,
  deleteClientId,
  getClientId,
} from '../services/dictionary/yahooJapan';

/**
 * Navigation prop types
 */
type RootStackParamList = {
  ApiKeySetup: { section?: 'deepl' | 'yahoo' };
  Settings: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'ApiKeySetup'>;

/**
 * API Key Setup Screen Component
 */
export function ApiKeySetupScreen({ navigation, route }: Props): React.JSX.Element {
  const { t: tc } = useTranslation('common');
  const { colors } = useTheme();

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const yahooSectionRef = useRef<View>(null);

  // DeepL state
  const [apiKey, setApiKey] = useState('');
  const [isKeySet, setIsKeySet] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [usage, setUsage] = useState<DeepLUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Yahoo! state
  const [yahooClientId, setYahooClientId] = useState('');
  const [isYahooIdSet, setIsYahooIdSet] = useState(false);
  const [isYahooValidating, setIsYahooValidating] = useState(false);
  const [isYahooDeleting, setIsYahooDeleting] = useState(false);
  const [yahooError, setYahooError] = useState<string | null>(null);

  // Toast notifications
  const { toastState, showSuccess, showError, showWarning, hideToast } = useToast();

  /**
   * Check if API key is already set on mount
   */
  useEffect(() => {
    checkExistingKeys();
  }, []);

  /**
   * Check for existing API keys and Client IDs
   */
  const checkExistingKeys = useCallback(async () => {
    // Check DeepL
    const existingKey = await getApiKey();
    if (existingKey) {
      setIsKeySet(true);
      // Validate and get usage
      const result = await validateApiKey(existingKey);
      if (result.success) {
        setUsage(result.data);
      }
    }

    // Check Yahoo!
    const existingClientId = await getClientId();
    if (existingClientId) {
      setIsYahooIdSet(true);
    }
  }, []);

  /**
   * Scroll to the specified section based on route params
   */
  useEffect(() => {
    if (route.params?.section === 'yahoo') {
      // Wait for layout to complete before scrolling
      const timer = setTimeout(() => {
        yahooSectionRef.current?.measureLayout(
          scrollViewRef.current as any,
          (_x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - 20, animated: true });
          },
          () => { }
        );
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [route.params?.section]);

  /**
   * Handle API key validation and save
   */
  const handleValidateAndSave = useCallback(async () => {
    if (!apiKey.trim()) {
      setError(t('deepl.inputRequired'));
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

      showSuccess(t('deepl.saveSuccess'));
    } finally {
      setIsValidating(false);
    }
  }, [apiKey, showSuccess, t]);

  /**
   * Handle API key deletion
   */
  const handleDeleteKey = useCallback(async () => {
    Alert.alert(
      t('deepl.deleteTitle'),
      t('deepl.deleteMessage'),
      [
        { text: tc('buttons.cancel'), style: 'cancel' },
        {
          text: tc('buttons.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            const result = await deleteApiKey();
            setIsDeleting(false);

            if (result.success) {
              setIsKeySet(false);
              setUsage(null);
              showSuccess(t('deepl.deleteSuccess'));
            } else {
              showError(result.error.message);
            }
          },
        },
      ]
    );
  }, [showSuccess, showError, t, tc]);

  /**
   * Handle Yahoo! Client ID validation and save
   */
  const handleValidateAndSaveYahoo = useCallback(async () => {
    if (!yahooClientId.trim()) {
      setYahooError(t('yahoo.inputRequired'));
      return;
    }

    setIsYahooValidating(true);
    setYahooError(null);

    try {
      // Validate the client ID
      const validateResult = await validateClientId(yahooClientId.trim());

      if (!validateResult.success) {
        setYahooError(validateResult.error.message);
        setIsYahooValidating(false);
        return;
      }

      // Save the client ID
      const saveResult = await saveClientId(yahooClientId.trim());

      if (!saveResult.success) {
        setYahooError(saveResult.error.message);
        setIsYahooValidating(false);
        return;
      }

      // Update state
      setIsYahooIdSet(true);
      setYahooClientId('');

      showSuccess(t('yahoo.saveSuccess'));
    } finally {
      setIsYahooValidating(false);
    }
  }, [yahooClientId, showSuccess, t]);

  /**
   * Handle Yahoo! Client ID deletion
   */
  const handleDeleteYahooId = useCallback(async () => {
    Alert.alert(
      t('yahoo.deleteTitle'),
      t('yahoo.deleteMessage'),
      [
        { text: tc('buttons.cancel'), style: 'cancel' },
        {
          text: tc('buttons.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsYahooDeleting(true);
            const result = await deleteClientId();
            setIsYahooDeleting(false);

            if (result.success) {
              setIsYahooIdSet(false);
              showSuccess(t('yahoo.deleteSuccess'));
            } else {
              showError(result.error.message);
            }
          },
        },
      ]
    );
  }, [showSuccess, showError, t, tc]);

  /**
   * Open DeepL signup page
   */
  const handleOpenDeepLSite = useCallback(() => {
    Linking.openURL('https://www.deepl.com/pro-api');
  }, []);

  /**
   * Open Yahoo! Developer Network page
   */
  const handleOpenYahooSite = useCallback(() => {
    Linking.openURL('https://developer.yahoo.co.jp/start/');
  }, []);

  /**
   * Render usage status
   */
  const renderUsageStatus = () => {
    if (!usage) return null;

    const isWarning = isUsageWarning(usage);
    const isCritical = isUsageCritical(usage);

    let statusColor: string = Colors.success;
    let statusText = t('usage.normal');

    if (isCritical) {
      statusColor = colors.error;
      statusText = t('usage.critical');
    } else if (isWarning) {
      statusColor = colors.warning;
      statusText = t('usage.warning');
    }

    return (
      <View style={[styles.usageContainer, { borderTopColor: colors.border }]}>
        <Text style={[styles.usageTitle, { color: colors.textSecondary }]}>{t('usage.title')}</Text>
        <Text style={[styles.usageText, { color: colors.text }]}>{formatUsage(usage)}</Text>
        <View style={[styles.usageBarContainer, { backgroundColor: colors.border }]}>
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('header')}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {t('description')}
          </Text>
        </View>

        {/* ========== DeepL Section ========== */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('deepl.title')}</Text>

          {/* DeepL Status */}
          <View style={[styles.statusCard, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>{t('status.label')}</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: isKeySet ? colors.success : colors.error },
                ]}
              />
              <Text style={[styles.statusText, { color: colors.text }]}>
                {isKeySet ? t('deepl.statusConfigured') : t('deepl.statusNotConfigured')}
              </Text>
            </View>
            {isKeySet && renderUsageStatus()}
          </View>

          {/* DeepL API Key Input (only show when not set) */}
          {!isKeySet && (
            <View style={styles.inputSection}>
              <Input
                label={t('deepl.inputLabel')}
                placeholder={t('deepl.inputPlaceholder')}
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
                title={t('deepl.validateAndSave')}
                onPress={handleValidateAndSave}
                loading={isValidating}
                disabled={!apiKey.trim()}
                style={styles.saveButton}
              />
            </View>
          )}

          {/* Delete DeepL Key Button (only show when set) */}
          {isKeySet && (
            <Button
              title={t('deepl.delete')}
              onPress={handleDeleteKey}
              variant="danger"
              loading={isDeleting}
              style={styles.deleteButton}
            />
          )}

          {/* DeepL Info Section */}
          <View style={[styles.infoSection, { backgroundColor: colors.backgroundTertiary }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>{t('deepl.howToGetTitle')}</Text>
            <View style={styles.infoSteps}>
              {(t('deepl.howToGetSteps', { returnObjects: true }) as string[]).map((step, index) => (
                <Text key={index} style={[styles.infoStep, { color: colors.textSecondary }]}>
                  {step}
                </Text>
              ))}
            </View>
            <Button
              title={t('deepl.openSite')}
              onPress={handleOpenDeepLSite}
              variant="outline"
              style={styles.linkButton}
            />
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* ========== Yahoo! JAPAN Section ========== */}
        <View ref={yahooSectionRef} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('yahoo.title')}</Text>

          {/* Yahoo! Status */}
          <View style={[styles.statusCard, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>{t('status.label')}</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: isYahooIdSet ? colors.success : colors.error },
                ]}
              />
              <Text style={[styles.statusText, { color: colors.text }]}>
                {isYahooIdSet ? t('yahoo.statusConfigured') : t('yahoo.statusNotConfigured')}
              </Text>
            </View>
          </View>

          {/* Yahoo! Client ID Input (only show when not set) */}
          {!isYahooIdSet && (
            <View style={styles.inputSection}>
              <Input
                label={t('yahoo.inputLabel')}
                placeholder={t('yahoo.inputPlaceholder')}
                value={yahooClientId}
                onChangeText={(text: string) => {
                  setYahooClientId(text);
                  setYahooError(null);
                }}
                error={yahooError ?? undefined}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                title={t('yahoo.validateAndSave')}
                onPress={handleValidateAndSaveYahoo}
                loading={isYahooValidating}
                disabled={!yahooClientId.trim()}
                style={styles.saveButton}
              />
            </View>
          )}

          {/* Delete Yahoo! ID Button (only show when set) */}
          {isYahooIdSet && (
            <Button
              title={t('yahoo.delete')}
              onPress={handleDeleteYahooId}
              variant="danger"
              loading={isYahooDeleting}
              style={styles.deleteButton}
            />
          )}

          {/* Yahoo! Info Section */}
          <View style={[styles.infoSection, { backgroundColor: colors.backgroundTertiary }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>{t('yahoo.howToGetTitle')}</Text>
            <View style={styles.infoSteps}>
              {(t('yahoo.howToGetSteps', { returnObjects: true }) as string[]).map((step, index) => (
                <Text key={index} style={[styles.infoStep, { color: colors.textSecondary }]}>
                  {step}
                </Text>
              ))}
            </View>
            <Button
              title={t('yahoo.openSite')}
              onPress={handleOpenYahooSite}
              variant="outline"
              style={styles.linkButton}
            />
          </View>
        </View>

        {/* Note */}
        <View style={[styles.noteSection, { backgroundColor: colors.warningLight, borderLeftColor: colors.warning }]}>
          <Text style={[styles.noteTitle, { color: colors.text }]}>{t('note.title')}</Text>
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>
            {t('note.content')}
          </Text>
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
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xxl,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.lg,
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
