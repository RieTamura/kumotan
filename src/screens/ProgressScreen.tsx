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
  Modal,
  Image,
} from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Share as ShareIcon, BookOpen, CheckCircle, BarChart3, Calendar, Flame, HelpCircle, AlertTriangle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguage } from '../locales';
import { useTheme } from '../hooks/useTheme';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Loading } from '../components/common/Loading';
import { getStats, getCalendarData } from '../services/database/stats';
import { getQuizStats } from '../services/database/quiz';
import { Stats } from '../types/stats';
import { QuizStats } from '../types/quiz';
import { ImageAspectRatio } from '../types/word';
import { useAuthStore } from '../store/authStore';
import { shareToBlueskyWithImage, shareTodaysSession } from '../services/learning/session';
import { getAgent } from '../services/bluesky/auth';

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
  isToday: boolean;
}

function CalendarDay({ day, hasActivity, isToday }: CalendarDayProps): React.JSX.Element {
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
        ]}
      >
        <Text
          style={[
            styles.calendarDayText,
            { color: colors.text },
            isToday && [styles.calendarDayTextToday, { color: '#FFFFFF' }],
            hasActivity && !isToday && [styles.calendarDayTextActivity, { color: '#FFFFFF' }],
          ]}
        >
          {day}
        </Text>
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isConnected = useNetworkStatus();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [stats, setStats] = useState<Stats | null>(null);
  const [quizStats, setQuizStats] = useState<QuizStats | null>(null);
  const [activityDays, setActivityDays] = useState<number[]>([]);
  const { colors, isDark } = useTheme();

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
        const activeDays = calendarResult.data.days
          .filter(day => day.wordsReadCount > 0)
          .map(day => {
            const dayNum = parseInt(day.date.split('-')[2], 10);
            return dayNum;
          });
        setActivityDays(activeDays);
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

  // Ref for capturing the share card as an image
  const shareCardRef = useRef<ViewShot>(null);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  /**
   * Capture and share the progress card as an image with text
   */
  const captureAndShare = useCallback(async () => {
    if (!shareCardRef.current || !stats) return;

    setIsCapturing(true);
    try {
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(tc('status.error'), t('errors.shareNotAvailable'));
        return;
      }

      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
      });

      // Create share message and copy to clipboard
      const shareMessage = t('share.text', { count: stats.todayCount });
      await Clipboard.setStringAsync(shareMessage);

      // Share the image (message is copied to clipboard)
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: t('share.dialogTitle'),
      });

      // Notify user that message was copied
      Alert.alert(t('share.messageCopied'), t('share.messageCopiedHint'));
    } catch (error: unknown) {
      console.error('Failed to capture and share:', error);
      Alert.alert(tc('status.error'), t('errors.imageCapture'));
    } finally {
      setIsCapturing(false);
      setIsShareModalVisible(false);
    }
  }, [stats]);

  /**
   * Handle share button press
   */
  const handleShare = useCallback(() => {
    if (!stats) {
      Alert.alert(tc('status.error'), t('errors.noStats'));
      return;
    }

    // Show share modal with preview
    setIsShareModalVisible(true);
  }, [stats, t, tc]);

  /**
   * Share to Bluesky timeline with image and AT Protocol learning session record
   */
  const handleShareToBluesky = useCallback(async () => {
    if (!shareCardRef.current || !stats) {
      Alert.alert(tc('status.error'), t('errors.noStats'));
      return;
    }

    if (!isAuthenticated) {
      Alert.alert(tc('status.error'), t('errors.notLoggedIn'));
      return;
    }

    if (!isConnected) {
      Alert.alert(tc('status.error'), t('errors.noNetwork'));
      return;
    }

    setIsCapturing(true);
    try {
      const agent = getAgent();

      // Capture the share card as URI first to get dimensions
      const imageUri = await captureRef(shareCardRef, {
        format: 'jpg',
        quality: 0.9,
      });

      // Get image dimensions
      const { width, height } = await new Promise<ImageAspectRatio>((resolve, reject) => {
        Image.getSize(
          imageUri,
          (width, height) => resolve({ width, height }),
          (error) => reject(error)
        );
      });

      // Validate image dimensions
      if (!width || !height || width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) {
        throw new Error(`画像の寸法が無効です: width=${width}, height=${height}`);
      }

      // Capture the share card as base64 image (JPG to avoid transparency issues)
      const imageBase64 = await captureRef(shareCardRef, {
        format: 'jpg',
        quality: 0.9,
        result: 'base64',
      });

      // Debug: Log image info in development mode
      if (__DEV__) {
        console.log('[Share] Image captured:', {
          length: imageBase64.length,
          prefix: imageBase64.substring(0, 50),
          isDataUrl: imageBase64.startsWith('data:'),
          width,
          height,
          aspectRatio: width / height,
        });
      }

      // Create learning session record in PDS
      const streakMessage = stats.streak > 1 ? t('share.textWithStreak', { streak: stats.streak }) : undefined;
      await shareTodaysSession(
        agent,
        stats.todayCount,
        0, // timeSpent - we don't track this yet
        streakMessage
      );

      // Share to Bluesky timeline with image and aspect ratio
      await shareToBlueskyWithImage(
        agent,
        stats.todayCount,
        imageBase64,
        { width, height },
        streakMessage
      );

      Alert.alert(tc('status.success'), t('share.blueskySuccess'));
      setIsShareModalVisible(false);
    } catch (error) {
      console.error('Failed to share to Bluesky:', error);
      Alert.alert(tc('status.error'), t('share.blueskyError'));
    } finally {
      setIsCapturing(false);
    }
  }, [stats, isAuthenticated, isConnected, t, tc]);

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

      return (
        <CalendarDay
          key={index}
          day={day}
          hasActivity={hasActivity}
          isToday={isToday}
        />
      );
    });
  }, [currentMonth, activityDays]);

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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('calendar.title')}</Text>

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
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('statistics.title')}</Text>
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('quiz.title')}</Text>

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

      {/* Share Modal */}
      <Modal
        visible={isShareModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsShareModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('share.title')}</Text>

            {/* Share Text Area */}
            <TouchableOpacity
              style={[styles.shareTextContainer, { backgroundColor: colors.backgroundSecondary }]}
              onPress={async () => {
                const text = t('share.text', { count: stats.todayCount });
                await Clipboard.setStringAsync(text);
                Alert.alert(t('share.copied'), t('share.copiedMessage'));
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.shareText, { color: colors.text }]}>
                {t('share.text', { count: stats.todayCount })}
              </Text>
              <Text style={[styles.shareTextHint, { color: colors.textTertiary }]}>{t('share.tapToCopy')}</Text>
            </TouchableOpacity>

            {/* Share Card Preview */}
            <View style={styles.shareCardPreviewWrapper}>
              <ViewShot
                ref={shareCardRef}
                options={{ format: 'jpg', quality: 0.9 }}
                style={[styles.shareCard, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF', borderColor: colors.border }]}
              >
                {/* App Logo/Title */}
                <Text style={[styles.shareCardAppName, { color: colors.primary }]}>{t('shareCard.appName')}</Text>

                {/* Date */}
                <Text style={[styles.shareCardDate, { color: isDark ? '#AAAAAA' : '#666666' }]}>
                  {new Date().toLocaleDateString(getCurrentLanguage() === 'ja' ? 'ja-JP' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>

                {/* Main Progress */}
                <View style={styles.shareCardProgress}>
                  <Text style={[styles.shareCardProgressValue, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                    {stats.todayCount}
                  </Text>
                  <Text style={[styles.shareCardProgressLabel, { color: isDark ? '#BBBBBB' : '#333333' }]}>
                    {t('shareCard.wordsLearned')}
                  </Text>
                </View>

                {/* Stats Row */}
                <View style={[styles.shareCardStatsRow, { borderTopColor: isDark ? '#333333' : '#EEEEEE' }]}>
                  <View style={styles.shareCardStatItem}>
                    <Text style={[styles.shareCardStatValue, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                      {t('statistics.days', { count: stats.streak })}
                    </Text>
                    <Text style={[styles.shareCardStatLabel, { color: isDark ? '#AAAAAA' : '#666666' }]}>{t('shareCard.consecutiveDays')}</Text>
                  </View>
                  <View style={[styles.shareCardStatDivider, { backgroundColor: isDark ? '#333333' : '#EEEEEE' }]} />
                  <View style={styles.shareCardStatItem}>
                    <Text style={[styles.shareCardStatValue, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                      {stats.totalWords}
                    </Text>
                    <Text style={[styles.shareCardStatLabel, { color: isDark ? '#AAAAAA' : '#666666' }]}>{t('shareCard.totalWords')}</Text>
                  </View>
                  <View style={[styles.shareCardStatDivider, { backgroundColor: isDark ? '#333333' : '#EEEEEE' }]} />
                  <View style={styles.shareCardStatItem}>
                    <Text style={[styles.shareCardStatValue, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                      {stats.readPercentage}%
                    </Text>
                    <Text style={[styles.shareCardStatLabel, { color: isDark ? '#AAAAAA' : '#666666' }]}>{t('shareCard.readRate')}</Text>
                  </View>
                </View>
              </ViewShot>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButtonCancel, { backgroundColor: colors.backgroundTertiary }]}
                onPress={() => setIsShareModalVisible(false)}
                disabled={isCapturing}
                accessible={true}
                accessibilityLabel={t('share.cancel')}
                accessibilityRole="button"
              >
                <Text style={[styles.modalButtonCancelText, { color: colors.textSecondary }]}>{t('share.cancel')}</Text>
              </TouchableOpacity>

              {/* Unified Share Button */}
              <TouchableOpacity
                style={[
                  styles.modalButtonShare,
                  { backgroundColor: colors.primary },
                  (isCapturing || (isAuthenticated && !isConnected)) && styles.modalButtonDisabled,
                ]}
                onPress={isAuthenticated ? handleShareToBluesky : captureAndShare}
                disabled={isCapturing || (isAuthenticated && !isConnected)}
                accessible={true}
                accessibilityLabel={isCapturing ? t('share.creating') : t('share.button')}
                accessibilityHint={isAuthenticated ? t('share.blueskyHint') : t('share.imageHint')}
                accessibilityRole="button"
                accessibilityState={{ disabled: isCapturing || (isAuthenticated && !isConnected), busy: isCapturing }}
              >
                <ShareIcon size={18} color="#FFFFFF" />
                <Text style={[styles.modalButtonShareText, { color: '#FFFFFF' }]}>
                  {isCapturing ? t('share.creating') : t('share.button')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 16, // FontSizes.lg
    fontWeight: '600',
    marginBottom: 12, // Spacing.md
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
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12, // Spacing.md
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16, // Spacing.lg
  },
  modalContent: {
    borderRadius: 16, // BorderRadius.xl
    padding: 16, // Spacing.lg
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18, // FontSizes.xl
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12, // Spacing.md
  },
  // Share Text styles
  shareTextContainer: {
    borderRadius: 8, // BorderRadius.md
    padding: 12, // Spacing.md
    marginBottom: 12, // Spacing.md
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  shareText: {
    fontSize: 12, // FontSizes.sm
    lineHeight: 20,
  },
  shareTextHint: {
    fontSize: 10, // FontSizes.xs
    textAlign: 'right',
    marginTop: 4, // Spacing.xs
  },
  // Share Card styles
  shareCardPreviewWrapper: {
    marginBottom: 16, // Spacing.lg
    borderRadius: 12, // BorderRadius.lg
    overflow: 'hidden',
  },
  shareCard: {
    padding: 24, // Spacing.xl
    alignItems: 'center',
  },
  shareCardAppName: {
    fontSize: 16, // FontSizes.lg
    fontWeight: '700',
    marginBottom: 8, // Spacing.sm
  },
  shareCardDate: {
    fontSize: 12, // FontSizes.sm
    marginBottom: 16, // Spacing.lg
  },
  shareCardProgress: {
    alignItems: 'center',
    marginBottom: 24, // Spacing.xl
  },
  shareCardProgressValue: {
    fontSize: 64,
    fontWeight: '700',
    lineHeight: 72,
  },
  shareCardProgressLabel: {
    fontSize: 16, // FontSizes.lg
    fontWeight: '600',
  },
  shareCardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16, // Spacing.lg
    borderRadius: 8, // BorderRadius.md
    paddingVertical: 12, // Spacing.md
    paddingHorizontal: 16, // Spacing.lg
    width: '100%',
  },
  shareCardStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  shareCardStatDivider: {
    width: 1,
    height: 30,
  },
  shareCardStatValue: {
    fontSize: 16, // FontSizes.lg
    fontWeight: '700',
  },
  shareCardStatLabel: {
    fontSize: 10, // FontSizes.xs
    marginTop: 2,
  },
  // Modal buttons
  modalButtons: {
    flexDirection: 'row',
    gap: 12, // Spacing.md
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 12, // Spacing.md
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8, // BorderRadius.md
  },
  modalButtonCancelText: {
    fontSize: 14, // FontSizes.md
    fontWeight: '600',
  },
  modalButtonShare: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12, // Spacing.md
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8, // BorderRadius.md
    gap: 8, // Spacing.sm
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonShareText: {
    fontSize: 14, // FontSizes.md
    fontWeight: '600',
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
