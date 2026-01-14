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
} from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Share as ShareIcon, BookOpen, CheckCircle, BarChart3, Calendar, Flame } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Loading } from '../components/common/Loading';
import { getStats, getCalendarData } from '../services/database/stats';
import { Stats } from '../types/stats';
import { useAuthStore } from '../store/authStore';
import { shareToBlueskyTimeline, shareTodaysSession } from '../services/learning/session';
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
        Alert.alert('エラー', '統計の取得に失敗しました。');
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
      Alert.alert('エラー', 'データの読み込み中にエラーが発生しました。');
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
        Alert.alert('エラー', 'このデバイスでは共有機能が利用できません。');
        return;
      }

      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
      });

      // Create share message and copy to clipboard
      const shareMessage = `今日は${stats.todayCount}個の単語を学習しました！\n\n#くもたん #言語学習 #langsky`;
      await Clipboard.setStringAsync(shareMessage);

      // Share the image (message is copied to clipboard)
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: '今日の学習進捗',
      });

      // Notify user that message was copied
      Alert.alert('メッセージをコピーしました', 'テキストがクリップボードにコピーされました。共有先で貼り付けてください。');
    } catch (error: unknown) {
      console.error('Failed to capture and share:', error);
      Alert.alert('エラー', '画像の作成または共有に失敗しました。');
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
      Alert.alert('エラー', '統計データが読み込まれていません。');
      return;
    }

    // Show share modal with preview
    setIsShareModalVisible(true);
  }, [stats]);

  /**
   * Share to Bluesky timeline with AT Protocol learning session record
   */
  const handleShareToBluesky = useCallback(async () => {
    if (!stats) {
      Alert.alert('エラー', '統計データが読み込まれていません。');
      return;
    }

    if (!isAuthenticated) {
      Alert.alert('エラー', 'Blueskyにログインしてください。');
      return;
    }

    if (!isConnected) {
      Alert.alert('エラー', 'ネットワークに接続してください。');
      return;
    }

    try {
      const agent = getAgent();

      // Create learning session record in PDS
      await shareTodaysSession(
        agent,
        stats.todayCount,
        0, // timeSpent - we don't track this yet
        stats.streak > 1 ? `${stats.streak}日連続学習達成！` : undefined
      );

      // Share to Bluesky timeline
      await shareToBlueskyTimeline(
        agent,
        stats.todayCount,
        stats.streak > 1 ? `${stats.streak}日連続学習達成！` : undefined
      );

      Alert.alert('成功', 'Blueskyに投稿しました！');
      setIsShareModalVisible(false);
    } catch (error) {
      console.error('Failed to share to Bluesky:', error);
      Alert.alert('エラー', 'Blueskyへの投稿に失敗しました。');
    }
  }, [stats, isAuthenticated, isConnected]);

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
    return currentMonth.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
    });
  }, [currentMonth]);

  if (isLoading || !stats) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>進捗</Text>
        </View>
        <Loading fullScreen message="統計を読み込み中..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>進捗</Text>
        <TouchableOpacity
          onPress={handleShare}
          disabled={!isConnected}
          style={styles.shareButton}
          accessible={true}
          accessibilityLabel="進捗をシェア"
          accessibilityHint="学習進捗を画像またはBlueskyに共有します"
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
            <Text style={styles.todayProgressTitle}>今日の進捗</Text>
            <Text style={styles.todayProgressValue}>
              {stats.todayCount}個の単語を学習
            </Text>
          </View>
        </View>

        {/* Calendar Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>【カレンダー】</Text>

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
              {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                <Text key={day} style={styles.calendarWeekday}>
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
              <Text style={styles.legendText}>学習した日</Text>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>【統計】</Text>
          <View style={styles.statsGrid}>
            <StatsCard
              title="総単語"
              value={stats.totalWords}
              Icon={BookOpen}
            />
            <StatsCard
              title="既読"
              value={stats.readWords}
              Icon={CheckCircle}
            />
            <StatsCard
              title="既読率"
              value={`${stats.readPercentage}%`}
              Icon={BarChart3}
            />
            <StatsCard
              title="今週の学習日"
              value={`${stats.thisWeekDays}日`}
              Icon={Calendar}
            />
          </View>

          <View style={styles.streakContainer}>
            <StatsCard
              title="連続学習日数"
              value={`${stats.streak}日`}
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
            <Text style={styles.modalTitle}>進捗をシェア</Text>
            
            {/* Share Text Area */}
            <TouchableOpacity
              style={styles.shareTextContainer}
              onPress={async () => {
                const text = `今日は${stats.todayCount}個の単語を学習しました！\n\n#くもたん #言語学習 #langsky`;
                await Clipboard.setStringAsync(text);
                Alert.alert('コピーしました', '投稿文をクリップボードにコピーしました');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.shareText}>
                今日は{stats.todayCount}個の単語を学習しました！{"\n\n"}#くもたん #言語学習 #langsky
              </Text>
              <Text style={styles.shareTextHint}>タップでコピー</Text>
            </TouchableOpacity>
            
            {/* Share Card Preview */}
            <ViewShot
              ref={shareCardRef}
              options={{ format: 'png', quality: 1 }}
              style={styles.shareCard}
            >
              <View style={styles.shareCardInner}>
                {/* App Logo/Title */}
                <Text style={styles.shareCardAppName}>☁️ くもたん</Text>
                
                {/* Date */}
                <Text style={styles.shareCardDate}>
                  {new Date().toLocaleDateString('ja-JP', {
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
                    個の単語を学習
                  </Text>
                </View>
                
                {/* Stats Row */}
                <View style={styles.shareCardStatsRow}>
                  <View style={styles.shareCardStatItem}>
                    <Text style={styles.shareCardStatValue}>
                      {stats.streak}日
                    </Text>
                    <Text style={styles.shareCardStatLabel}>連続学習</Text>
                  </View>
                  <View style={styles.shareCardStatDivider} />
                  <View style={styles.shareCardStatItem}>
                    <Text style={styles.shareCardStatValue}>
                      {stats.totalWords}語
                    </Text>
                    <Text style={styles.shareCardStatLabel}>総単語数</Text>
                  </View>
                  <View style={styles.shareCardStatDivider} />
                  <View style={styles.shareCardStatItem}>
                    <Text style={styles.shareCardStatValue}>
                      {stats.readPercentage}%
                    </Text>
                    <Text style={styles.shareCardStatLabel}>既読率</Text>
                  </View>
                </View>
              </View>
            </ViewShot>

            {/* Action Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setIsShareModalVisible(false)}
                disabled={isCapturing}
                accessible={true}
                accessibilityLabel="キャンセル"
                accessibilityRole="button"
              >
                <Text style={styles.modalButtonCancelText}>キャンセル</Text>
              </TouchableOpacity>

              {/* Bluesky Direct Post Button */}
              {isAuthenticated && (
                <TouchableOpacity
                  style={[
                    styles.modalButtonBluesky,
                    (!isConnected || isCapturing) && styles.modalButtonDisabled,
                  ]}
                  onPress={handleShareToBluesky}
                  disabled={!isConnected || isCapturing}
                  accessible={true}
                  accessibilityLabel="Blueskyに投稿"
                  accessibilityHint="学習記録をBlueskyタイムラインに投稿します"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !isConnected || isCapturing }}
                >
                  <Text style={styles.modalButtonBlueskyText}>
                    Blueskyに投稿
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.modalButtonShare,
                  isCapturing && styles.modalButtonDisabled,
                ]}
                onPress={captureAndShare}
                disabled={isCapturing}
                accessible={true}
                accessibilityLabel={isCapturing ? '作成中' : '画像をシェア'}
                accessibilityHint="進捗を画像として共有します"
                accessibilityRole="button"
                accessibilityState={{ disabled: isCapturing, busy: isCapturing }}
              >
                <ShareIcon size={18} color={Colors.textInverse} />
                <Text style={styles.modalButtonShareText}>
                  {isCapturing ? '作成中...' : '画像をシェア'}
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
  shareCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  shareCardInner: {
    backgroundColor: Colors.primary,
    padding: Spacing.xl,
    alignItems: 'center',
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
  modalButtonBluesky: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: '#0085FF', // Bluesky brand color
  },
  modalButtonBlueskyText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textInverse,
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
