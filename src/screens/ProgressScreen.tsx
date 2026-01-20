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
import { Share as ShareIcon, BookOpen, CheckCircle, BarChart3, Calendar, Flame } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { getCurrentLanguage } from '../locales';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Loading } from '../components/common/Loading';
import { getStats, getCalendarData } from '../services/database/stats';
import { Stats } from '../types/stats';
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
  return (
    <View style={styles.statsCard}>
      <View style={styles.statsIconContainer}>
        <Icon size={24} color={Colors.primary} />
      </View>
      <Text style={styles.statsValue}>{value}</Text>
      <Text style={styles.statsTitle}>{title}</Text>
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
  if (day === null) {
    return <View style={styles.calendarDayEmpty} />;
  }

  return (
    <View style={styles.calendarDay}>
      <View
        style={[
          styles.calendarDayInner,
          isToday && styles.calendarDayInnerToday,
          hasActivity && !isToday && styles.calendarDayInnerActivity,
        ]}
      >
        <Text
          style={[
            styles.calendarDayText,
            isToday && styles.calendarDayTextToday,
            hasActivity && !isToday && styles.calendarDayTextActivity,
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
  const isConnected = useNetworkStatus();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [stats, setStats] = useState<Stats | null>(null);
  const [activityDays, setActivityDays] = useState<number[]>([]);

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
      const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        Image.getSize(
          imageUri,
          (width, height) => resolve({ width, height }),
          (error) => reject(error)
        );
      });

      // Validate image dimensions
      if (!width || !height || width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height)) {
        throw new Error(`Invalid image dimensions: width=${width}, height=${height}`);
      }

      // Capture the share card as base64 image (JPG to avoid transparency issues)
      const imageBase64 = await captureRef(shareCardRef, {
        format: 'jpg',
        quality: 0.9,
        result: 'base64',
      });

      // Debug: Log image info
      console.log('[Share] Image captured:', {
        length: imageBase64.length,
        prefix: imageBase64.substring(0, 50),
        isDataUrl: imageBase64.startsWith('data:'),
        width,
        height,
        aspectRatio: width / height,
      });

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
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('header')}</Text>
        </View>
        <Loading fullScreen message={t('loading')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('header')}</Text>
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
            color={isConnected ? Colors.primary : Colors.textSecondary}
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
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Today's Progress */}
        <View style={styles.section}>
          <View style={styles.todayProgress}>
            <Text style={styles.todayProgressTitle}>{t('today.title')}</Text>
            <Text style={styles.todayProgressValue}>
              {t('today.wordsLearned', { count: stats.todayCount })}
            </Text>
          </View>
        </View>

        {/* Calendar Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('calendar.title')}</Text>

          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <Pressable onPress={goToPrevMonth} style={styles.monthNavButton}>
              <Text style={styles.monthNavButtonText}>◀</Text>
            </Pressable>
            <Text style={styles.monthNavTitle}>{formatMonthYear()}</Text>
            <Pressable onPress={goToNextMonth} style={styles.monthNavButton}>
              <Text style={styles.monthNavButtonText}>▶</Text>
            </Pressable>
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarContainer}>
            {/* Weekday headers */}
            <View style={styles.calendarWeekdays}>
              {(t('calendar.weekdays', { returnObjects: true }) as string[]).map((day, index) => (
                <Text key={index} style={styles.calendarWeekday}>
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
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>{t('calendar.legend')}</Text>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('statistics.title')}</Text>
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
      </ScrollView>

      {/* Share Modal */}
      <Modal
        visible={isShareModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsShareModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('share.title')}</Text>

            {/* Share Text Area */}
            <TouchableOpacity
              style={styles.shareTextContainer}
              onPress={async () => {
                const text = t('share.text', { count: stats.todayCount });
                await Clipboard.setStringAsync(text);
                Alert.alert(t('share.copied'), t('share.copiedMessage'));
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.shareText}>
                {t('share.text', { count: stats.todayCount })}
              </Text>
              <Text style={styles.shareTextHint}>{t('share.tapToCopy')}</Text>
            </TouchableOpacity>
            
            {/* Share Card Preview */}
            <View style={styles.shareCardPreviewWrapper}>
              <ViewShot
                ref={shareCardRef}
                options={{ format: 'jpg', quality: 0.9 }}
                style={styles.shareCard}
              >
                {/* App Logo/Title */}
                <Text style={styles.shareCardAppName}>{t('shareCard.appName')}</Text>

                {/* Date */}
                <Text style={styles.shareCardDate}>
                  {new Date().toLocaleDateString(getCurrentLanguage() === 'ja' ? 'ja-JP' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>

                {/* Main Progress */}
                <View style={styles.shareCardProgress}>
                  <Text style={styles.shareCardProgressValue}>
                    {stats.todayCount}
                  </Text>
                  <Text style={styles.shareCardProgressLabel}>
                    {t('shareCard.wordsLearned')}
                  </Text>
                </View>

                {/* Stats Row */}
                <View style={styles.shareCardStatsRow}>
                  <View style={styles.shareCardStatItem}>
                    <Text style={styles.shareCardStatValue}>
                      {t('statistics.days', { count: stats.streak })}
                    </Text>
                    <Text style={styles.shareCardStatLabel}>{t('shareCard.consecutiveDays')}</Text>
                  </View>
                  <View style={styles.shareCardStatDivider} />
                  <View style={styles.shareCardStatItem}>
                    <Text style={styles.shareCardStatValue}>
                      {stats.totalWords}
                    </Text>
                    <Text style={styles.shareCardStatLabel}>{t('shareCard.totalWords')}</Text>
                  </View>
                  <View style={styles.shareCardStatDivider} />
                  <View style={styles.shareCardStatItem}>
                    <Text style={styles.shareCardStatValue}>
                      {stats.readPercentage}%
                    </Text>
                    <Text style={styles.shareCardStatLabel}>{t('shareCard.readRate')}</Text>
                  </View>
                </View>
              </ViewShot>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setIsShareModalVisible(false)}
                disabled={isCapturing}
                accessible={true}
                accessibilityLabel={t('share.cancel')}
                accessibilityRole="button"
              >
                <Text style={styles.modalButtonCancelText}>{t('share.cancel')}</Text>
              </TouchableOpacity>

              {/* Unified Share Button */}
              <TouchableOpacity
                style={[
                  styles.modalButtonShare,
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
                <ShareIcon size={18} color={Colors.textInverse} />
                <Text style={styles.modalButtonShareText}>
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  shareButton: {
    padding: Spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statsCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statsIconContainer: {
    marginBottom: Spacing.sm,
  },
  statsValue: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  statsTitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  streakContainer: {
    marginTop: Spacing.md,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  monthNavButton: {
    padding: Spacing.sm,
  },
  monthNavButtonText: {
    fontSize: FontSizes.lg,
    color: Colors.primary,
  },
  monthNavTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  calendarContainer: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.primary,
  },
  calendarDayText: {
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  calendarDayTextToday: {
    fontWeight: '700',
    color: Colors.card,
  },
  calendarDayInnerActivity: {
    backgroundColor: Colors.success,
  },
  calendarDayTextActivity: {
    fontWeight: '600',
    color: Colors.card,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  legendText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  todayProgress: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4, // Android用
  },
  todayProgressTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textInverse,
    marginBottom: Spacing.sm,
  },
  todayProgressValue: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  // Share Text styles
  shareTextContainer: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  shareText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  shareTextHint: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  // Share Card styles
  shareCardPreviewWrapper: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  shareCard: {
    backgroundColor: Colors.primary,
    padding: Spacing.xl,
    alignItems: 'center',
    // No borderRadius here - ViewShot captures this as a rectangle
    // The preview shows rounded corners via shareCardPreviewWrapper's overflow:hidden
  },
  shareCardAppName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textInverse,
    marginBottom: Spacing.sm,
  },
  shareCardDate: {
    fontSize: FontSizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: Spacing.lg,
  },
  shareCardProgress: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  shareCardProgressValue: {
    fontSize: 64,
    fontWeight: '700',
    color: Colors.textInverse,
    lineHeight: 72,
  },
  shareCardProgressLabel: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  shareCardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    width: '100%',
  },
  shareCardStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  shareCardStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  shareCardStatValue: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  shareCardStatLabel: {
    fontSize: FontSizes.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  // Modal buttons
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtonCancelText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalButtonShare: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    gap: Spacing.sm,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonShareText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textInverse,
  },
});

export default ProgressScreen;
