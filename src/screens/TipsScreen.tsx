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
import {
  Hand,
  BookSearch,
  Share2,
  GraduationCap,
  Volume2,
  Mic,
  Search,
  MessageSquare,
  SpellCheck2,
  LayoutGrid,
} from 'lucide-react-native';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';

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
  const { colors } = useTheme();
  return (
    <View style={[styles.tipCard, { backgroundColor: colors.card }]}>
      <View style={[styles.tipIconContainer, { backgroundColor: colors.primaryLight }]}>
        {icon}
      </View>
      <View style={styles.tipContent}>
        <Text style={[styles.tipTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.tipDescription, { color: colors.textSecondary }]}>{description}</Text>
      </View>
    </View>
  );
}

/**
 * TipsScreen Component
 */
export function TipsScreen(): React.JSX.Element {
  const { t } = useTranslation('tips');
  const { colors, isDark } = useTheme();
  const iconColor = isDark ? colors.primary : '#FFFFFF';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Word Selection Tip */}
        <TipCard
          icon={<Hand size={24} color={iconColor} />}
          title={t('wordSelection.title')}
          description={t('wordSelection.description')}
        />

        {/* Book Search Tip */}
        <TipCard
          icon={<BookSearch size={24} color={iconColor} />}
          title={t('bookSearch.title')}
          description={t('bookSearch.description')}
        />

        {/* Share Tip */}
        <TipCard
          icon={<Share2 size={24} color={iconColor} />}
          title={t('share.title')}
          description={t('share.description')}
        />

        {/* Quiz Tip */}
        <TipCard
          icon={<GraduationCap size={24} color={iconColor} />}
          title={t('quiz.title')}
          description={t('quiz.description')}
        />

        {/* Text to Speech Tip */}
        <TipCard
          icon={<Volume2 size={24} color={iconColor} />}
          title={t('textToSpeech.title')}
          description={t('textToSpeech.description')}
        />

        {/* Auto Speech Tip */}
        <TipCard
          icon={<Mic size={24} color={iconColor} />}
          title={t('autoSpeech.title')}
          description={t('autoSpeech.description')}
        />

        {/* Word Search Tip */}
        <TipCard
          icon={<Search size={24} color={iconColor} />}
          title={t('wordSearch.title')}
          description={t('wordSearch.description')}
        />

        {/* Reply & Repost Tip */}
        <TipCard
          icon={<MessageSquare size={24} color={iconColor} />}
          title={t('replyRepost.title')}
          description={t('replyRepost.description')}
        />

        {/* Proofreading Tip */}
        <TipCard
          icon={<SpellCheck2 size={24} color={iconColor} />}
          title={t('proofreading.title')}
          description={t('proofreading.description')}
        />

        {/* Custom Feed Tip */}
        <TipCard
          icon={<LayoutGrid size={24} color={iconColor} />}
          title={t('customFeed.title')}
          description={t('customFeed.description')}
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
