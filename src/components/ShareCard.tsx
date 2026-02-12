/**
 * ShareCard Component
 * Renders a progress statistics card for sharing via view-shot capture.
 * Uses React.forwardRef to expose the View ref for captureRef.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguage } from '../locales';
import { ThemeColors } from '../constants/colors';
import { Stats } from '../types/stats';

export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 400;

interface ShareCardProps {
  stats: Stats;
  colors: ThemeColors;
}

export const ShareCard = React.forwardRef<View, ShareCardProps>(
  function ShareCard({ stats, colors }, ref) {
    const { t } = useTranslation('progress');

    const today = new Date();
    const locale = getCurrentLanguage() === 'ja' ? 'ja-JP' : 'en-US';
    const dateStr = today.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return (
      <View
        ref={ref}
        style={[styles.card, { backgroundColor: colors.primary }]}
        collapsable={false}
      >
        {/* App Name */}
        <Text style={styles.appName}>
          {t('shareCard.appName')}
        </Text>

        {/* Date */}
        <Text style={styles.date}>{dateStr}</Text>

        {/* Hero Number */}
        <View style={styles.hero}>
          <Text style={styles.heroNumber}>
            {stats.todayCount}
          </Text>
        </View>
        <Text style={styles.heroLabel}>
          {t('shareCard.wordsLearned')}
        </Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {t('statistics.days', { count: stats.streak })}
            </Text>
            <Text style={styles.statLabel}>
              {t('shareCard.consecutiveDays')}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {stats.totalWords.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>
              {t('shareCard.totalWords')}
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {stats.readPercentage}%
            </Text>
            <Text style={styles.statLabel}>
              {t('shareCard.readRate')}
            </Text>
          </View>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  date: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 4,
  },
  hero: {
    marginTop: 32,
    alignItems: 'center',
  },
  heroNumber: {
    fontSize: 80,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 88,
  },
  heroLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginTop: 32,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
});
