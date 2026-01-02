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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';

/**
 * Stats Card Component
 */
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
}

function StatsCard({ title, value, icon }: StatsCardProps): React.JSX.Element {
  return (
    <View style={styles.statsCard}>
      <Text style={styles.statsIcon}>{icon}</Text>
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
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Mock stats data (will be replaced with real data from database)
  const [stats, setStats] = useState({
    totalWords: 42,
    readWords: 28,
    readPercentage: 67,
    thisWeekDays: 5,
    streak: 12,
    todayCount: 3,
  });

  // Mock calendar data
  const [activityDays, setActivityDays] = useState<number[]>([3, 5, 7, 8, 12, 13, 14]);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  /**
   * Handle share button press
   */
  const handleShare = useCallback(() => {
    if (!isConnected) {
      Alert.alert('オフライン', 'シェアするにはネットワーク接続が必要です。');
      return;
    }

    Alert.alert(
      'シェア',
      `今日は${stats.todayCount}個の単語を学習しました！\n\n#英語学習 #ソラたん`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'Blueskyでシェア', onPress: () => {
          // TODO: Implement sharing to Bluesky
          Alert.alert('成功', 'シェアしました！');
        }},
      ]
    );
  }, [isConnected, stats.todayCount]);

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

  if (isLoading) {
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
        <Button
          title="シェア"
          onPress={handleShare}
          variant="ghost"
          size="small"
          disabled={!isConnected}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
              icon="📚"
            />
            <StatsCard
              title="既読"
              value={stats.readWords}
              icon="✅"
            />
            <StatsCard
              title="既読率"
              value={`${stats.readPercentage}%`}
              icon="📊"
            />
            <StatsCard
              title="今週の学習日"
              value={`${stats.thisWeekDays}日`}
              icon="📅"
            />
          </View>

          <View style={styles.streakContainer}>
            <StatsCard
              title="連続学習日数"
              value={`${stats.streak}日`}
              icon="🔥"
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
  statsIcon: {
    fontSize: 24,
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
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
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
