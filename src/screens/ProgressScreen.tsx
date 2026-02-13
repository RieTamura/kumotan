/**
 * Progress Screen
 * Displays learning statistics and calendar view
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Share as ShareIcon, BookOpen, CheckCircle, BarChart3, Calendar, Flame, HelpCircle, AlertTriangle, Lightbulb } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguage } from '../locales';
import { useTheme } from '../hooks/useTheme';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Loading } from '../components/common/Loading';
import { PostCreationModal } from '../components/PostCreationModal';
import { ShareCard, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT } from '../components/ShareCard';
import { PostImageAttachment } from '../services/bluesky/feed';
import { getStats, getCalendarData } from '../services/database/stats';
import { getQuizStats } from '../services/database/quiz';
import { Stats } from '../types/stats';
import { QuizStats } from '../types/quiz';

/**
 * Stats Card Component
 */
interface StatsCardProps {
  title: string;
  value: string | number;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}

function StatsCard({ title, value, Icon }: StatsCardProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
      <View style={styles.statsIconContainer}>
        <Icon size={24} color={colors.primary} />
      </View>
      <Text style={[styles.statsValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statsTitle, { color: colors.textSecondary }]}>{title}</Text>
    </View>
  );
}

/**
 * Calendar Day Component
 */
interface CalendarDayProps {
  day: number | null;
  hasActivity: boolean;
  hasQuiz: boolean;
  isToday: boolean;
}

function CalendarDay({ day, hasActivity, hasQuiz, isToday }: CalendarDayProps): React.JSX.Element {
  const { colors } = useTheme();
  if (day === null) {
    return <View style={styles.calendarDayEmpty} />;
  }

  return (
    <View style={styles.calendarDay}>
      <View
        style={[
          styles.calendarDayInner,
          isToday && [styles.calendarDayInnerToday, { backgroundColor: colors.primary }],
          hasActivity && !isToday && [styles.calendarDayInnerActivity, { backgroundColor: colors.success }],
          !hasActivity && hasQuiz && !isToday && [styles.calendarDayInnerActivity, { backgroundColor: colors.warning }],
        ]}
      >
        {/* Inner quiz indicator circle (nested inside study circle) */}
        {hasActivity && hasQuiz && !isToday ? (
          <View style={[styles.calendarDayQuizInner, { backgroundColor: colors.warning }]}>
            <Text
              style={[
                styles.calendarDayText,
                styles.calendarDayTextActivity,
                { color: '#FFFFFF' },
              ]}
            >
              {day}
            </Text>
          </View>
        ) : (
          <Text
            style={[
              styles.calendarDayText,
              { color: colors.text },
              isToday && [styles.calendarDayTextToday, { color: '#FFFFFF' }],
              (hasActivity || hasQuiz) && !isToday && [styles.calendarDayTextActivity, { color: '#FFFFFF' }],
            ]}
          >
            {day}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * ProgressScreen Component
 */
export function ProgressScreen(): React.JSX.Element {
  const { t } = useTranslation('progress');
  const { t: tc } = useTranslation('common');
  const { t: th } = useTranslation('home');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isConnected = useNetworkStatus();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [stats, setStats] = useState<Stats | null>(null);
  const [quizStats, setQuizStats] = useState<QuizStats | null>(null);
  const [activityDays, setActivityDays] = useState<number[]>([]);
  const [quizDays, setQuizDays] = useState<number[]>([]);
  const { colors } = useTheme();

  /**
   * Load all data (stats and calendar)
   */
  const loadAllData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      // Load stats
      const statsResult = await getStats();
      if (statsResult.success) {
        setStats(statsResult.data);
      } else {
        Alert.alert(tc('status.error'), t('errors.statsLoad'));
      }

      // Load quiz stats
      const quizStatsResult = await getQuizStats();
      if (quizStatsResult.success) {
        setQuizStats(quizStatsResult.data);
      }

      // Load calendar data
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const calendarResult = await getCalendarData(year, month);

      if (calendarResult.success) {
        const studyDays = calendarResult.data.days
          .filter(day => day.wordsReadCount > 0)
          .map(day => parseInt(day.date.split('-')[2], 10));
        setActivityDays(studyDays);

        const quizActiveDays = calendarResult.data.days
          .filter(day => day.quizCompleted)
          .map(day => parseInt(day.date.split('-')[2], 10));
        setQuizDays(quizActiveDays);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert(tc('status.error'), t('errors.dataLoad'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentMonth]);

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = useCallback(() => {
    loadAllData(true);
  }, [loadAllData]);

  /**
   * Load data when screen is focused
   */
  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [loadAllData])
  );

  /**
   * Reload calendar data when month changes
   */
  useEffect(() => {
    if (!isLoading && stats) {
      loadAllData();
    }
  }, [currentMonth]);

  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [shareInitialText, setShareInitialText] = useState('');
  const [shareInitialImages, setShareInitialImages] = useState<PostImageAttachment[]>([]);
  const shareCardRef = useRef<View>(null);

  /**
   * Handle share button press - capture ShareCard and open PostCreationModal
   */
  const handleShare = useCallback(async () => {
    if (!stats) {
      Alert.alert(tc('status.error'), t('errors.noStats'));
      return;
    }

    // Build default share text with streak info if applicable
    let text = t('share.text', { count: stats.todayCount });
    if (stats.streak > 1) {
      text = t('share.textWithStreak', { streak: stats.streak }) + '\n' + text;
    }

    setShareInitialText(text);

    // Capture ShareCard as image
    try {
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      setShareInitialImages([{
        uri,
        mimeType: 'image/png',
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        alt: t('share.imageAlt'),
      }]);
    } catch {
      // Graceful degradation: proceed with text only
      setShareInitialImages([]);
    }

    setIsShareModalVisible(true);
  }, [stats, t, tc]);

  /**
   * Navigate to previous month
   */
  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  }, []);

  /**
   * Navigate to next month
   */
  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  }, []);

  /**
   * Generate calendar days for current month
   */
  const generateCalendarDays = useCallback(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const days: (number | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days.map((day, index) => {
      const isToday =
        day !== null &&
        year === today.getFullYear() &&
        month === today.getMonth() &&
        day === today.getDate();

      const hasActivity = day !== null && activityDays.includes(day);
      const hasQuiz = day !== null && quizDays.includes(day);

      return (
        <CalendarDay
          key={index}
          day={day}
          hasActivity={hasActivity}
          hasQuiz={hasQuiz}
          isToday={isToday}
        />
      );
    });
  }, [currentMonth, activityDays, quizDays]);

  /**
   * Format month and year for display
   */
  const formatMonthYear = useCallback(() => {
    const locale = getCurrentLanguage() === 'ja' ? 'ja-JP' : 'en-US';
    return currentMonth.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
    });
  }, [currentMonth]);

  if (isLoading || !stats) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('header')}</Text>
        </View>
        <Loading fullScreen message={t('loading')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('header')}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleShare}
            disabled={!isConnected}
            style={styles.shareButton}
            accessible={true}
            accessibilityLabel={t('share.accessibilityLabel')}
            accessibilityHint={t('share.accessibilityHint')}
            accessibilityRole="button"
          >
            <ShareIcon
              size={24}
              color={isConnected ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Tips')}
            style={[
              styles.headerIconButton,
            ]}
            accessible={true}
            accessibilityLabel={th('tips')}
            accessibilityHint={th('tipsHint')}
            accessibilityRole="button"
          >
            <Lightbulb size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Today's Progress */}
        <View style={styles.section}>
          <View style={[styles.todayProgress, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.todayProgressTitle, { color: colors.textSecondary }]}>{t('today.title')}</Text>
            <Text style={[styles.todayProgressValue, { color: colors.text }]}>
              {t('today.wordsLearned', { count: stats.todayCount })}
            </Text>
          </View>
        </View>

        {/* Calendar Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('calendar.title')}</Text>

          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <Pressable onPress={goToPrevMonth} style={styles.monthNavButton}>
              <Text style={[styles.monthNavButtonText, { color: colors.primary }]}>◀</Text>
            </Pressable>
            <Text style={[styles.monthNavTitle, { color: colors.text }]}>{formatMonthYear()}</Text>
            <Pressable onPress={goToNextMonth} style={styles.monthNavButton}>
              <Text style={[styles.monthNavButtonText, { color: colors.primary }]}>▶</Text>
            </Pressable>
          </View>

          {/* Calendar Grid */}
          <View style={[styles.calendarContainer, { backgroundColor: colors.card }]}>
            {/* Weekday headers */}
            <View style={styles.calendarWeekdays}>
              {(t('calendar.weekdays', { returnObjects: true }) as string[]).map((day, index) => (
                <Text key={index} style={[styles.calendarWeekday, { color: colors.textSecondary }]}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Calendar days */}
            <View style={styles.calendarGrid}>
              {generateCalendarDays()}
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('calendar.legend')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('calendar.legendQuiz')}</Text>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('statistics.title')}</Text>
          <View style={styles.statsGrid}>
            <StatsCard
              title={t('statistics.totalWords')}
              value={stats.totalWords}
              Icon={BookOpen}
            />
            <StatsCard
              title={t('statistics.readWords')}
              value={stats.readWords}
              Icon={CheckCircle}
            />
            <StatsCard
              title={t('statistics.readRate')}
              value={`${stats.readPercentage}%`}
              Icon={BarChart3}
            />
            <StatsCard
              title={t('statistics.studyDaysThisWeek')}
              value={t('statistics.days', { count: stats.thisWeekDays })}
              Icon={Calendar}
            />
          </View>

          <View style={styles.streakContainer}>
            <StatsCard
              title={t('statistics.streak')}
              value={t('statistics.days', { count: stats.streak })}
              Icon={Flame}
            />
          </View>
        </View>

        {/* Quiz Stats Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('quiz.title')}</Text>

          {quizStats && quizStats.totalAttempts > 0 ? (
            <>
              <View style={styles.statsGrid}>
                <StatsCard
                  title={t('quiz.sessionsCompleted')}
                  value={quizStats.sessionsCompleted}
                  Icon={HelpCircle}
                />
                <StatsCard
                  title={t('quiz.accuracy')}
                  value={`${quizStats.overallAccuracy}%`}
                  Icon={CheckCircle}
                />
              </View>

              {/* Weak Words */}
              {quizStats.weakWords.length > 0 && (
                <View style={[styles.weakWordsContainer, { backgroundColor: colors.card }]}>
                  <View style={styles.weakWordsHeader}>
                    <AlertTriangle size={16} color={colors.warning} />
                    <Text style={[styles.weakWordsTitle, { color: colors.text }]}>
                      {t('quiz.weakWords')}
                    </Text>
                  </View>
                  <View style={styles.weakWordsList}>
                    {quizStats.weakWords.slice(0, 5).map((item) => (
                      <View key={item.word.id} style={styles.weakWordItem}>
                        <Text style={[styles.weakWordText, { color: colors.text }]}>
                          {item.word.english}
                        </Text>
                        <Text style={[styles.weakWordAccuracy, { color: colors.textSecondary }]}>
                          {item.accuracy}%
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.noQuizData, { backgroundColor: colors.card }]}>
              <HelpCircle size={32} color={colors.textSecondary} />
              <Text style={[styles.noQuizDataText, { color: colors.textSecondary }]}>
                {t('quiz.noData')}
              </Text>
            </View>
          )}

          {/* Start Quiz Button */}
          <TouchableOpacity
            style={[styles.startQuizButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('QuizSetup')}
          >
            <HelpCircle size={20} color="#FFFFFF" />
            <Text style={styles.startQuizButtonText}>{t('quiz.startQuiz')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Offscreen ShareCard for view-shot capture */}
      {stats && (
        <View style={styles.offscreen}>
          <ShareCard ref={shareCardRef} stats={stats} colors={colors} />
        </View>
      )}

      {/* Share via PostCreationModal */}
      <PostCreationModal
        visible={isShareModalVisible}
        onClose={() => {
          setIsShareModalVisible(false);
          setShareInitialImages([]);
        }}
        initialText={shareInitialText}
        initialImages={shareInitialImages}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    opacity: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, // Spacing.lg
    paddingVertical: 12, // Spacing.md
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18, // FontSizes.xl
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Spacing.xs
  },
  headerIconButton: {
    padding: 8, // Spacing.sm
    borderRadius: 9999, // BorderRadius.full
  },
  shareButton: {
    padding: 8, // Spacing.sm
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16, // Spacing.lg
  },
  section: {
    marginBottom: 24, // Spacing.xl
  },
  sectionTitle: {
    fontSize: 12, // FontSizes.sm
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8, // Spacing.sm
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12, // Spacing.md
  },
  statsCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12, // BorderRadius.lg
    padding: 16, // Spacing.lg
    alignItems: 'center',
  },
  statsIconContainer: {
    marginBottom: 8, // Spacing.sm
  },
  statsValue: {
    fontSize: 24, // FontSizes.xxl
    fontWeight: '700',
  },
  statsTitle: {
    fontSize: 12, // FontSizes.sm
    marginTop: 4, // Spacing.xs
  },
  streakContainer: {
    marginTop: 12, // Spacing.md
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12, // Spacing.md
  },
  monthNavButton: {
    padding: 8, // Spacing.sm
  },
  monthNavButtonText: {
    fontSize: 16, // FontSizes.lg
  },
  monthNavTitle: {
    fontSize: 16, // FontSizes.lg
    fontWeight: '600',
  },
  calendarContainer: {
    borderRadius: 12, // BorderRadius.lg
    padding: 12, // Spacing.md
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 8, // Spacing.sm
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12, // FontSizes.sm
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  calendarDayEmpty: {
    width: '14.28%',
    aspectRatio: 1,
  },
  calendarDayInner: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  calendarDayInnerToday: {
    // Background color set dynamically
  },
  calendarDayText: {
    fontSize: 14, // FontSizes.md
  },
  calendarDayTextToday: {
    fontWeight: '700',
  },
  calendarDayInnerActivity: {
    // Background color set dynamically
  },
  calendarDayTextActivity: {
    fontWeight: '600',
  },
  calendarDayQuizInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12, // Spacing.md
    gap: 16, // Spacing.lg
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Spacing.xs
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12, // FontSizes.sm
  },
  todayProgress: {
    borderRadius: 12, // BorderRadius.lg
    padding: 24, // Spacing.xl
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  todayProgressTitle: {
    fontSize: 16, // FontSizes.lg
    fontWeight: '600',
    marginBottom: 8, // Spacing.sm
  },
  todayProgressValue: {
    fontSize: 24, // FontSizes.xxl
    fontWeight: '700',
  },
  // Quiz Stats styles
  weakWordsContainer: {
    marginTop: 12, // Spacing.md
    borderRadius: 12, // BorderRadius.lg
    padding: 16, // Spacing.lg
  },
  weakWordsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Spacing.sm
    marginBottom: 12, // Spacing.md
  },
  weakWordsTitle: {
    fontSize: 14, // FontSizes.md
    fontWeight: '600',
  },
  weakWordsList: {
    gap: 8, // Spacing.sm
  },
  weakWordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weakWordText: {
    fontSize: 14, // FontSizes.md
  },
  weakWordAccuracy: {
    fontSize: 12, // FontSizes.sm
  },
  noQuizData: {
    borderRadius: 12, // BorderRadius.lg
    padding: 24, // Spacing.xl
    alignItems: 'center',
    gap: 8, // Spacing.sm
  },
  noQuizDataText: {
    fontSize: 14, // FontSizes.md
    textAlign: 'center',
  },
  startQuizButton: {
    marginTop: 12, // Spacing.md
    borderRadius: 8, // BorderRadius.md
    paddingVertical: 12, // Spacing.md
    paddingHorizontal: 16, // Spacing.lg
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8, // Spacing.sm
  },
  startQuizButtonText: {
    color: '#FFFFFF',
    fontSize: 14, // FontSizes.md
    fontWeight: '600',
  },
});

export default ProgressScreen;
