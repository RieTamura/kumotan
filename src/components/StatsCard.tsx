/**
 * StatsCard Component
 * Display a single statistic with icon and value
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import {
  Colors,
  Spacing,
  FontSizes,
  BorderRadius,
  Shadows,
} from '../constants/colors';

/**
 * StatsCard props interface
 */
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  subtitle?: string;
  color?: string;
  style?: ViewStyle;
}

/**
 * StatsCard Component
 */
export function StatsCard({
  title,
  value,
  icon,
  subtitle,
  color = Colors.primary,
  style,
}: StatsCardProps): React.JSX.Element {
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}
    </View>
  );
}

/**
 * StatsCardRow Component
 * Displays multiple stats cards in a row
 */
interface StatsCardRowProps {
  children: React.ReactNode;
}

export function StatsCardRow({ children }: StatsCardRowProps): React.JSX.Element {
  return <View style={styles.row}>{children}</View>;
}

/**
 * StatsSummary Component
 * Displays a full summary of learning stats
 */
interface StatsSummaryProps {
  totalWords: number;
  readWords: number;
  readPercentage: number;
  thisWeekDays: number;
  streak: number;
  todayCount: number;
}

export function StatsSummary({
  totalWords,
  readWords,
  readPercentage,
  thisWeekDays,
  streak,
  todayCount,
}: StatsSummaryProps): React.JSX.Element {
  return (
    <View style={styles.summaryContainer}>
      {/* Main stats row */}
      <View style={styles.row}>
        <StatsCard
          title="総単語数"
          value={totalWords}
          icon="📚"
          style={styles.cardFlex}
        />
        <StatsCard
          title="既読単語"
          value={readWords}
          icon="✅"
          color={Colors.success}
          style={styles.cardFlex}
        />
        <StatsCard
          title="既読率"
          value={`${readPercentage}%`}
          icon="📊"
          color={Colors.warning}
          style={styles.cardFlex}
        />
      </View>

      {/* Secondary stats row */}
      <View style={styles.row}>
        <StatsCard
          title="今週の学習"
          value={`${thisWeekDays}日`}
          icon="📅"
          color={Colors.primary}
          style={styles.cardFlex}
        />
        <StatsCard
          title="連続学習"
          value={`${streak}日`}
          icon="🔥"
          color={Colors.error}
          style={styles.cardFlex}
        />
        <StatsCard
          title="今日"
          value={todayCount}
          icon="⭐"
          subtitle="単語"
          color={Colors.success}
          style={styles.cardFlex}
        />
      </View>
    </View>
  );
}

/**
 * ProgressBar Component
 * Visual representation of progress
 */
interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  color?: string;
}

export function ProgressBar({
  progress,
  label,
  showPercentage = true,
  color = Colors.primary,
}: ProgressBarProps): React.JSX.Element {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <View style={styles.progressContainer}>
      {label && (
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>{label}</Text>
          {showPercentage && (
            <Text style={styles.progressPercentage}>{clampedProgress}%</Text>
          )}
        </View>
      )}
      <View style={styles.progressBarBackground}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${clampedProgress}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  icon: {
    fontSize: 24,
  },
  value: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cardFlex: {
    flex: 1,
  },
  summaryContainer: {
    gap: Spacing.sm,
  },
  progressContainer: {
    width: '100%',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  progressLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  progressPercentage: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});

export default StatsCard;
