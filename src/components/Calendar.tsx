/**
 * Calendar Component
 * Monthly calendar view with activity indicators
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import {
  Colors,
  Spacing,
  FontSizes,
  BorderRadius,
  Shadows,
} from '../constants/colors';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { ja } from 'date-fns/locale';

/**
 * Calendar props interface
 */
interface CalendarProps {
  currentMonth: Date;
  activityDates: Date[];
  onMonthChange?: (date: Date) => void;
  onDatePress?: (date: Date) => void;
}

/**
 * Weekday labels
 */
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * Calendar Day Component
 */
interface CalendarDayProps {
  date: Date;
  isCurrentMonth: boolean;
  hasActivity: boolean;
  isToday: boolean;
  onPress?: () => void;
}

function CalendarDay({
  date,
  isCurrentMonth,
  hasActivity,
  isToday,
  onPress,
}: CalendarDayProps): React.JSX.Element {
  const dayNumber = date.getDate();
  const isSunday = date.getDay() === 0;
  const isSaturday = date.getDay() === 6;

  return (
    <Pressable
      style={[
        styles.dayContainer,
        isToday && styles.dayContainerToday,
      ]}
      onPress={onPress}
      disabled={!isCurrentMonth}
    >
      <Text
        style={[
          styles.dayText,
          !isCurrentMonth && styles.dayTextOtherMonth,
          isToday && styles.dayTextToday,
          isSunday && isCurrentMonth && styles.dayTextSunday,
          isSaturday && isCurrentMonth && styles.dayTextSaturday,
        ]}
      >
        {dayNumber}
      </Text>
      {hasActivity && isCurrentMonth && (
        <View style={styles.activityDot} />
      )}
    </Pressable>
  );
}

/**
 * Calendar Component
 */
export function Calendar({
  currentMonth,
  activityDates,
  onMonthChange,
  onDatePress,
}: CalendarProps): React.JSX.Element {
  const today = new Date();

  /**
   * Generate all days to display in the calendar
   */
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  /**
   * Check if a date has activity
   */
  const hasActivityOnDate = useCallback(
    (date: Date) => {
      return activityDates.some((activityDate) => isSameDay(date, activityDate));
    },
    [activityDates]
  );

  /**
   * Navigate to previous month
   */
  const goToPrevMonth = useCallback(() => {
    onMonthChange?.(subMonths(currentMonth, 1));
  }, [currentMonth, onMonthChange]);

  /**
   * Navigate to next month
   */
  const goToNextMonth = useCallback(() => {
    onMonthChange?.(addMonths(currentMonth, 1));
  }, [currentMonth, onMonthChange]);

  /**
   * Render calendar grid in rows
   */
  const renderCalendarRows = () => {
    const rows: React.JSX.Element[] = [];
    let currentRow: React.JSX.Element[] = [];

    calendarDays.forEach((date: Date, index: number) => {
      const dayElement = (
        <CalendarDay
          date={date}
          isCurrentMonth={isSameMonth(date, currentMonth)}
          hasActivity={hasActivityOnDate(date)}
          isToday={isSameDay(date, today)}
          onPress={() => onDatePress?.(date)}
        />
      );
      currentRow.push(
        <View key={date.toISOString()}>
          {dayElement}
        </View>
      );

      if ((index + 1) % 7 === 0) {
        rows.push(
          <View key={`row-${index}`} style={styles.weekRow}>
            {currentRow}
          </View>
        );
        currentRow = [];
      }
    });

    return rows;
  };

  return (
    <View style={styles.container}>
      {/* Month navigation header */}
      <View style={styles.header}>
        <Pressable
          style={styles.navButton}
          onPress={goToPrevMonth}
        >
          <Text style={styles.navButtonText}>‹</Text>
        </Pressable>

        <Text style={styles.monthTitle}>
          {format(currentMonth, 'yyyy年M月', { locale: ja })}
        </Text>

        <Pressable
          style={styles.navButton}
          onPress={goToNextMonth}
        >
          <Text style={styles.navButtonText}>›</Text>
        </Pressable>
      </View>

      {/* Weekday labels */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day, index) => (
          <View key={day} style={styles.weekdayCell}>
            <Text
              style={[
                styles.weekdayText,
                index === 0 && styles.weekdayTextSunday,
                index === 6 && styles.weekdayTextSaturday,
              ]}
            >
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.calendarGrid}>
        {renderCalendarRows()}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={styles.legendText}>学習した日</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSecondary,
  },
  navButtonText: {
    fontSize: 24,
    color: Colors.text,
    fontWeight: '300',
  },
  monthTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  weekdayText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  weekdayTextSunday: {
    color: Colors.error,
  },
  weekdayTextSaturday: {
    color: Colors.primary,
  },
  calendarGrid: {
    gap: Spacing.xs,
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayContainer: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  dayContainerToday: {
    backgroundColor: Colors.primaryLight,
  },
  dayText: {
    fontSize: FontSizes.md,
    color: Colors.text,
  },
  dayTextOtherMonth: {
    color: Colors.textTertiary,
  },
  dayTextToday: {
    color: Colors.primary,
    fontWeight: '700',
  },
  dayTextSunday: {
    color: Colors.error,
  },
  dayTextSaturday: {
    color: Colors.primary,
  },
  activityDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
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
  },
  legendText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
});

export default Calendar;
