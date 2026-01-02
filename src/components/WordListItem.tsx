/**
 * WordListItem Component
 * Individual word item in the vocabulary list
 */

import React, { useCallback } from 'react';
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
} from '../constants/colors';
import { Word } from '../types/word';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

/**
 * WordListItem props interface
 */
interface WordListItemProps {
  word: Word;
  onPress?: (word: Word) => void;
  onToggleRead?: (word: Word) => void;
  onDelete?: (word: Word) => void;
}

/**
 * Format the date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return format(date, 'M/d', { locale: ja });
  } catch {
    return '-';
  }
}

/**
 * WordListItem Component
 */
export function WordListItem({
  word,
  onPress,
  onToggleRead,
  onDelete,
}: WordListItemProps): React.JSX.Element {
  /**
   * Handle item press
   */
  const handlePress = useCallback(() => {
    onPress?.(word);
  }, [word, onPress]);

  /**
   * Handle checkbox press
   */
  const handleToggleRead = useCallback(() => {
    onToggleRead?.(word);
  }, [word, onToggleRead]);

  return (
    <Pressable
      style={({ pressed }: { pressed: boolean }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
      onPress={handlePress}
    >
      {/* Read status checkbox */}
      <Pressable
        style={styles.checkboxContainer}
        onPress={handleToggleRead}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View
          style={[
            styles.checkbox,
            word.isRead && styles.checkboxChecked,
          ]}
        >
          {word.isRead && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </View>
      </Pressable>

      {/* Word content */}
      <View style={styles.content}>
        <View style={styles.wordRow}>
          <Text
            style={[
              styles.english,
              word.isRead && styles.textRead,
            ]}
            numberOfLines={1}
          >
            {word.english}
          </Text>
          <Text style={styles.date}>
            {formatDate(word.createdAt)}
          </Text>
        </View>

        <Text
          style={[
            styles.japanese,
            word.isRead && styles.textRead,
            !word.japanese && styles.noTranslation,
          ]}
          numberOfLines={1}
        >
          {word.japanese || (word.definition ? word.definition.slice(0, 50) : '-')}
        </Text>
      </View>

      {/* Arrow indicator */}
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

/**
 * WordListHeader Component
 * Section header for grouping words
 */
interface WordListHeaderProps {
  title: string;
  count?: number;
}

export function WordListHeader({
  title,
  count,
}: WordListHeaderProps): React.JSX.Element {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      {count !== undefined && (
        <Text style={styles.headerCount}>{count}件</Text>
      )}
    </View>
  );
}

/**
 * WordListEmpty Component
 * Empty state for word list
 */
interface WordListEmptyProps {
  message?: string;
}

export function WordListEmpty({
  message = '単語がまだ登録されていません',
}: WordListEmptyProps): React.JSX.Element {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📝</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      <Text style={styles.emptyHint}>
        ホームのタイムラインで単語を長押しして追加しましょう
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  containerPressed: {
    backgroundColor: Colors.backgroundSecondary,
  },
  checkboxContainer: {
    marginRight: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkmark: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  wordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  english: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  date: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm,
  },
  japanese: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  noTranslation: {
    fontStyle: 'italic',
    color: Colors.textTertiary,
  },
  textRead: {
    color: Colors.textTertiary,
  },
  arrow: {
    fontSize: FontSizes.xl,
    color: Colors.textTertiary,
    fontWeight: '300',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
  },
  headerTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerCount: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyMessage: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emptyHint: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default WordListItem;
