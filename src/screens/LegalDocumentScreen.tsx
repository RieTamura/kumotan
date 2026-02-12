/**
 * Legal Document Screen
 * Displays Terms of Service or Privacy Policy
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import type { RootStackParamList } from '../navigation/AppNavigator';

const GITHUB_ISSUES_URL = 'https://github.com/RieTamura/kumotan/issues';

type LegalDocumentRouteProp = RouteProp<RootStackParamList, 'LegalDocument'>;

/**
 * LegalDocumentScreen Component
 */
export function LegalDocumentScreen(): React.JSX.Element {
  const route = useRoute<LegalDocumentRouteProp>();
  const { type } = route.params;
  const { t } = useTranslation('legal');
  const { colors } = useTheme();

  const docKey = type === 'terms' ? 'termsOfService' : 'privacyPolicy';
  const title = t(`${docKey}.title`);
  const intro = t(`${docKey}.intro`);
  const sections = t(`${docKey}.sections`, { returnObjects: true }) as {
    heading: string;
    content: string[];
  }[];
  const footer = t(`${docKey}.footer`, { returnObjects: true }) as {
    operator: string;
    contact: string;
    lastUpdated: string;
  };

  const handleContactPress = async () => {
    try {
      const canOpen = await Linking.canOpenURL(GITHUB_ISSUES_URL);
      if (canOpen) {
        await Linking.openURL(GITHUB_ISSUES_URL);
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Title and Intro */}
        <View style={[styles.headerSection, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>{intro}</Text>
        </View>

        {/* Sections */}
        <View style={styles.sectionsContainer}>
          {sections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.section}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>
                {section.heading}
              </Text>
              {section.content.map((paragraph, paraIndex) => (
                <Text
                  key={paraIndex}
                  style={[styles.paragraph, { color: colors.textSecondary }]}
                >
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {footer.operator}
          </Text>
          <Text
            style={[styles.footerLink, { color: colors.primary }]}
            onPress={handleContactPress}
          >
            {footer.contact}
          </Text>
          <Text style={[styles.footerDate, { color: colors.textTertiary }]}>
            {footer.lastUpdated}
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
  headerSection: {
    padding: Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  introText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  sectionsContainer: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeading: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  paragraph: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginTop: Spacing.sm,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  footerText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
  },
  footerDate: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
});

export default LegalDocumentScreen;
