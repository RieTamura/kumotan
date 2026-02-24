/**
 * API & Translation Settings Screen
 * API key configuration and translation toggle options
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import { useSettingsStore } from '../store/settingsStore';
import {
  hasApiKey,
  getUsage,
  formatUsage,
  isUsageCritical,
  isUsageWarning,
  type DeepLUsage,
} from '../services/dictionary/deepl';
import { hasClientId } from '../services/dictionary/yahooJapan';
import type { RootStackParamList } from '../navigation/AppNavigator';

interface SettingsItemProps {
  title: string;
  subtitle?: string;
  subtitleColor?: string;
  onPress: () => void;
  showArrow?: boolean;
  disabled?: boolean;
}

function SettingsItem({
  title,
  subtitle,
  subtitleColor,
  onPress,
  showArrow = true,
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
        <Text style={[styles.settingsItemTitle, { color: colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.settingsItemSubtitle, { color: subtitleColor ?? colors.textSecondary }]}>
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

export function ApiTranslationSettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const [apiKeySet, setApiKeySet] = useState(false);
  const [deepLUsage, setDeepLUsage] = useState<DeepLUsage | null>(null);
  const [yahooClientIdSet, setYahooClientIdSet] = useState(false);
  const {
    translateDefinition, setTranslateDefinition,
    translateSentenceToEnglish, setTranslateSentenceToEnglish,
    translateDefinitionInEnglishSentence, setTranslateDefinitionInEnglishSentence,
  } = useSettingsStore();

  const checkApiKeys = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    checkApiKeys();
    const unsubscribe = navigation.addListener('focus', checkApiKeys);
    return unsubscribe;
  }, [navigation, checkApiKeys]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* API Keys Section */}
        <SettingsSection title={t('api.sectionTitle')}>
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
            onPress={() => navigation.navigate('ApiKeySetup', { section: 'deepl' })}
          />
          <SettingsItem
            title={t('api.yahooClientId')}
            subtitle={yahooClientIdSet ? t('api.configured') : t('api.notConfigured')}
            onPress={() => navigation.navigate('ApiKeySetup', { section: 'yahoo' })}
          />
        </SettingsSection>

        {/* Translation Options Section */}
        <SettingsSection title={t('translation.sectionTitle')}>
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
      </ScrollView>
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
