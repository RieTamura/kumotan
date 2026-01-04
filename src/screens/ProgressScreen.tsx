/**
 * Progress Screen
 * Displays learning statistics and calendar view
 */

import React, { useState, useCallback, useEffect } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Share, BookOpen, CheckCircle, BarChart3, Calendar, Flame } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { getStats, getCalendarData } from '../services/database/stats';
import { Stats } from '../types/stats';

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

  /**
   * Handle share button press
   */
  const handleShare = useCallback(() => {
    if (!isConnected) {
      Alert.alert('オフライン', 'シェアするにはネットワーク接続が必要です。');
      return;
    }

    if (!stats) {
      Alert.alert('エラー', '統計データが読み込まれていません。');
      return;
    }

    Alert.alert(
      'シェア',
      `今日は${stats.todayCount}個の単語を学習しました！\n\n#英語学習 #くもたん`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'Blueskyでシェア', onPress: () => {
          // TODO: Implement sharing to Bluesky
          Alert.alert('成功', 'シェアしました！');
        }},
      ]
    );
  }, [isConnected, stats]);

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
        >
          <Share 
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
});

export default ProgressScreen;
