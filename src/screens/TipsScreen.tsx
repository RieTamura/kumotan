/**
 * Tips Screen
 * Displays usage tips and hints for the app
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Hand, BookSearch, Share2 } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';

/**
 * Tip card component props
 */
interface TipCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

/**
 * Tip card component
 */
function TipCard({ icon, title, description }: TipCardProps): React.JSX.Element {
  return (
    <View style={styles.tipCard}>
      <View style={styles.tipIconContainer}>
        {icon}
      </View>
      <View style={styles.tipContent}>
        <Text style={styles.tipTitle}>{title}</Text>
        <Text style={styles.tipDescription}>{description}</Text>
      </View>
    </View>
  );
}

/**
 * TipsScreen Component
 */
export function TipsScreen(): React.JSX.Element {
  const { t } = useTranslation('tips');

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Word Selection Tip */}
        <TipCard
          icon={<Hand size={24} color={Colors.primary} />}
          title={t('wordSelection.title')}
          description={t('wordSelection.description')}
        />

        {/* Book Search Tip */}
        <TipCard
          icon={<BookSearch size={24} color={Colors.primary} />}
          title={t('bookSearch.title')}
          description={t('bookSearch.description')}
        />

        {/* Share Tip */}
        <TipCard
          icon={<Share2 size={24} color={Colors.primary} />}
          title={t('share.title')}
          description={t('share.description')}
        />
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
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  tipIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  tipDescription: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});

export default TipsScreen;
