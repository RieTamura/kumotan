/**
 * License Screen
 * Displays open source licenses for third-party libraries used in the app
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';

/**
 * License information for each library
 */
interface LicenseInfo {
  name: string;
  version?: string;
  license: string;
  url?: string;
  description?: string;
}

/**
 * API services URLs (descriptions come from translations)
 */
const API_URLS: Record<string, string> = {
  deepl: 'https://www.deepl.com/pro-api',
  yahoo: 'https://developer.yahoo.co.jp/webapi/jlp/',
  dictionary: 'https://dictionaryapi.dev/',
  jmdict: 'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project',
  bluesky: 'https://atproto.com/',
};

/**
 * List of open source libraries used in this app
 */
const LICENSES: LicenseInfo[] = [
  {
    name: '@atproto/api',
    license: 'MIT / Apache-2.0',
    url: 'https://github.com/bluesky-social/atproto',
    description: 'Bluesky AT Protocol SDK',
  },
  {
    name: 'React Native',
    license: 'MIT',
    url: 'https://github.com/facebook/react-native',
    description: 'A framework for building native apps using React',
  },
  {
    name: 'React',
    license: 'MIT',
    url: 'https://github.com/facebook/react',
    description: 'A JavaScript library for building user interfaces',
  },
  {
    name: 'Expo',
    license: 'MIT',
    url: 'https://github.com/expo/expo',
    description: 'An open-source platform for making universal native apps',
  },
  {
    name: '@react-navigation/native',
    license: 'MIT',
    url: 'https://github.com/react-navigation/react-navigation',
    description: 'Routing and navigation for React Native apps',
  },
  {
    name: '@react-navigation/native-stack',
    license: 'MIT',
    url: 'https://github.com/react-navigation/react-navigation',
    description: 'Native stack navigator for React Navigation',
  },
  {
    name: '@react-navigation/bottom-tabs',
    license: 'MIT',
    url: 'https://github.com/react-navigation/react-navigation',
    description: 'Bottom tab navigator for React Navigation',
  },
  {
    name: '@react-native-async-storage/async-storage',
    license: 'MIT',
    url: 'https://github.com/react-native-async-storage/async-storage',
    description: 'Asynchronous, persistent, key-value storage system',
  },
  {
    name: '@react-native-community/netinfo',
    license: 'MIT',
    url: 'https://github.com/react-native-netinfo/react-native-netinfo',
    description: 'Network connectivity information API',
  },
  {
    name: 'expo-sqlite',
    license: 'MIT',
    url: 'https://github.com/expo/expo',
    description: 'SQLite database for Expo apps',
  },
  {
    name: 'expo-secure-store',
    license: 'MIT',
    url: 'https://github.com/expo/expo',
    description: 'Secure storage for sensitive data',
  },
  {
    name: 'expo-clipboard',
    license: 'MIT',
    url: 'https://github.com/expo/expo',
    description: 'Clipboard API for Expo apps',
  },
  {
    name: 'expo-linking',
    license: 'MIT',
    url: 'https://github.com/expo/expo',
    description: 'Deep linking and URL handling',
  },
  {
    name: 'expo-sharing',
    license: 'MIT',
    url: 'https://github.com/expo/expo',
    description: 'Share content with other apps',
  },
  {
    name: 'expo-splash-screen',
    license: 'MIT',
    url: 'https://github.com/expo/expo',
    description: 'Splash screen management for Expo apps',
  },
  {
    name: 'expo-status-bar',
    license: 'MIT',
    url: 'https://github.com/expo/expo',
    description: 'Status bar customization for Expo apps',
  },
  {
    name: 'date-fns',
    license: 'MIT',
    url: 'https://github.com/date-fns/date-fns',
    description: 'Modern JavaScript date utility library',
  },
  {
    name: 'lucide-react-native',
    license: 'ISC',
    url: 'https://github.com/lucide-icons/lucide',
    description: 'Beautiful & consistent icon toolkit',
  },
  {
    name: 'react-native-pager-view',
    license: 'MIT',
    url: 'https://github.com/callstack/react-native-pager-view',
    description: 'Pager view component for React Native',
  },
  {
    name: 'react-native-safe-area-context',
    license: 'MIT',
    url: 'https://github.com/th3rdwave/react-native-safe-area-context',
    description: 'Safe area insets handling for React Native',
  },
  {
    name: 'react-native-screens',
    license: 'MIT',
    url: 'https://github.com/software-mansion/react-native-screens',
    description: 'Native navigation primitives for React Native',
  },
  {
    name: 'react-native-view-shot',
    license: 'MIT',
    url: 'https://github.com/gre/react-native-view-shot',
    description: 'Snapshot a React Native view and save it to an image',
  },
  {
    name: 'zustand',
    license: 'MIT',
    url: 'https://github.com/pmndrs/zustand',
    description: 'Small, fast and scalable state management',
  },
];

/**
 * Section header component
 */
function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

/**
 * License item component
 */
function LicenseItem({ license }: { license: LicenseInfo }): React.JSX.Element {
  const handlePress = async () => {
    if (license.url) {
      try {
        const canOpen = await Linking.canOpenURL(license.url);
        if (canOpen) {
          await Linking.openURL(license.url);
        }
      } catch (error) {
        console.error('Failed to open URL:', error);
      }
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.licenseItem,
        pressed && license.url && styles.licenseItemPressed,
      ]}
      onPress={handlePress}
      disabled={!license.url}
    >
      <View style={styles.licenseHeader}>
        <Text style={styles.licenseName}>{license.name}</Text>
        <Text style={styles.licenseType}>{license.license}</Text>
      </View>
      {license.description && (
        <Text style={styles.licenseDescription}>{license.description}</Text>
      )}
      {license.url && (
        <Text style={styles.licenseUrl}>{license.url}</Text>
      )}
    </Pressable>
  );
}

/**
 * LicenseScreen Component
 */
export function LicenseScreen(): React.JSX.Element {
  const { t } = useTranslation('license');

  // Build API licenses from translations
  const apiLicenses: LicenseInfo[] = [
    {
      name: t('apis.deepl.name'),
      license: t('apis.deepl.license'),
      url: API_URLS.deepl,
      description: t('apis.deepl.description'),
    },
    {
      name: t('apis.yahoo.name'),
      license: t('apis.yahoo.license'),
      url: API_URLS.yahoo,
      description: t('apis.yahoo.description'),
    },
    {
      name: t('apis.dictionary.name'),
      license: t('apis.dictionary.license'),
      url: API_URLS.dictionary,
      description: t('apis.dictionary.description'),
    },
    {
      name: t('apis.jmdict.name'),
      license: t('apis.jmdict.license'),
      url: API_URLS.jmdict,
      description: t('apis.jmdict.description'),
    },
    {
      name: t('apis.bluesky.name'),
      license: t('apis.bluesky.license'),
      url: API_URLS.bluesky,
      description: t('apis.bluesky.description'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Info */}
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{t('header')}</Text>
          <Text style={styles.headerDescription}>
            {t('description')}
          </Text>
        </View>

        {/* API Services Section */}
        <SectionHeader title={t('sections.apis')} />
        <View style={styles.licenseList}>
          {apiLicenses.map((license, index) => (
            <LicenseItem key={`api-${license.name}-${index}`} license={license} />
          ))}
        </View>

        {/* Open Source Libraries Section */}
        <SectionHeader title={t('sections.libraries')} />
        {/* License List */}
        <View style={styles.licenseList}>
          {LICENSES.map((license, index) => (
            <LicenseItem key={`lib-${license.name}-${index}`} license={license} />
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('footer')}
          </Text>
        </View>
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
  headerInfo: {
    padding: Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  headerDescription: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  licenseList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.backgroundSecondary,
  },
  sectionHeaderText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  licenseItem: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  licenseItemPressed: {
    backgroundColor: Colors.hover,
  },
  licenseHeader: {
    flexDirection: 'column',
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  licenseName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  licenseType: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.primary,
    backgroundColor: Colors.hover,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  licenseDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  licenseUrl: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
  },
  footer: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});

export default LicenseScreen;
