/**
 * QuizShareCard Component
 * Renders a quiz result card for sharing via view-shot capture.
 * Uses React.forwardRef to expose the View ref for captureRef.
 */

import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguage } from '../locales';
import { ThemeColors } from '../constants/colors';
import { QuizResult } from '../types/quiz';
import { formatTimeSpent } from '../services/quiz/quizEngine';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bgImage = require('../../assets/kumotan-share-bg2.png');

const PRIMARY = '#1DA1F2';
const PRIMARY_DARK = '#0d8bd9';

export const QUIZ_SHARE_CARD_WIDTH = 360;
export const QUIZ_SHARE_CARD_HEIGHT = 400;

interface QuizShareCardProps {
  result: QuizResult;
  colors: ThemeColors;
}

export const QuizShareCard = React.forwardRef<View, QuizShareCardProps>(
  function QuizShareCard({ result }, ref) {
    const { t } = useTranslation('quiz');

    const today = new Date();
    const locale = getCurrentLanguage() === 'ja' ? 'ja-JP' : 'en-US';
    const dateStr = today.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const timeFormatted = formatTimeSpent(result.timeSpentSeconds);

    // Quiz day color (matches calendar quiz indicator)
    const QUIZ_DAY_COLOR = '#FFAD1F';

    return (
      <View ref={ref} collapsable={false}>
        <ImageBackground
          source={bgImage}
          style={styles.card}
          imageStyle={styles.cardImage}
          resizeMode="cover"
        >
          {/* Header: title + date (on gradient area) */}
          <Text style={styles.appName}>
            {t('result.header')}
          </Text>
          <Text style={styles.date}>{dateStr}</Text>

          {/* Hero Accuracy Circle */}
          <View style={[styles.hero, { borderColor: QUIZ_DAY_COLOR }]}>
            <Text style={styles.heroNumber}>
              {result.accuracy}%
            </Text>
          </View>

          {/* Score (on white cloud area) */}
          <Text style={styles.scoreLabel}>
            {result.correctCount}/{result.totalQuestions}
          </Text>

          {/* Stats Row (on white cloud area) */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {result.correctCount}
              </Text>
              <Text style={styles.statLabel}>
                {t('result.correctWords')}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {result.incorrectCount}
              </Text>
              <Text style={styles.statLabel}>
                {t('result.incorrectWords')}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {timeFormatted.minutes}:{timeFormatted.seconds.toString().padStart(2, '0')}
              </Text>
              <Text style={styles.statLabel}>
                {t('result.timeLabel')}
              </Text>
            </View>
          </View>
        </ImageBackground>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    width: QUIZ_SHARE_CARD_WIDTH,
    height: QUIZ_SHARE_CARD_HEIGHT,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardImage: {
    borderRadius: 20,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: PRIMARY,
    textAlign: 'center',
  },
  date: {
    fontSize: 14,
    fontWeight: '500',
    color: PRIMARY_DARK,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.7,
  },
  hero: {
    marginTop: 20,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroNumber: {
    fontSize: 40,
    fontWeight: '800',
    color: PRIMARY,
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: PRIMARY_DARK,
    textAlign: 'center',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginTop: 20,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: PRIMARY_DARK,
    marginTop: 2,
    opacity: 0.7,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(29,161,242,0.2)',
  },
});
