/**
 * Word List Screen
 * Displays saved vocabulary words with filtering and sorting options
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, Check } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { Word, WordFilter } from '../types/word';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';

/**
 * Filter options type
 */
type FilterOption = 'all' | 'unread' | 'read';

/**
 * Sort options type
 */
type SortOption = 'created_at' | 'english';

/**
 * WordListScreen Component
 */
export function WordListScreen(): React.JSX.Element {
  // State for words list (placeholder)
  const [words, setWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter and sort state
  const [filter, setFilter] = useState<FilterOption>('all');
  const [sortBy, setSortBy] = useState<SortOption>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  /**
   * Handle filter change
   */
  const handleFilterChange = useCallback((newFilter: FilterOption) => {
    setFilter(newFilter);
  }, []);

  /**
   * Handle sort change
   */
  const handleSortChange = useCallback(() => {
    Alert.alert(
      'ソート順',
      '並び順を選択してください',
      [
        {
          text: '登録日時（新しい順）',
          onPress: () => {
            setSortBy('created_at');
            setSortOrder('desc');
          },
        },
        {
          text: '登録日時（古い順）',
          onPress: () => {
            setSortBy('created_at');
            setSortOrder('asc');
          },
        },
        {
          text: 'アルファベット順（A-Z）',
          onPress: () => {
            setSortBy('english');
            setSortOrder('asc');
          },
        },
        {
          text: 'アルファベット順（Z-A）',
          onPress: () => {
            setSortBy('english');
            setSortOrder('desc');
          },
        },
        { text: 'キャンセル', style: 'cancel' },
      ]
    );
  }, []);

  /**
   * Handle word tap to toggle read status
   */
  const handleWordTap = useCallback((word: Word) => {
    // TODO: Implement toggle read status
    Alert.alert(
      word.isRead ? '未読にする' : '既読にする',
      `"${word.english}" を${word.isRead ? '未読' : '既読'}にしますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'OK',
          onPress: () => {
            // TODO: Call database service to toggle
          },
        },
      ]
    );
  }, []);

  /**
   * Handle word delete
   */
  const handleWordDelete = useCallback((word: Word) => {
    Alert.alert(
      '単語を削除',
      `"${word.english}" を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            // TODO: Call database service to delete
          },
        },
      ]
    );
  }, []);

  /**
   * Render word item
   */
  const renderWordItem = useCallback(
    ({ item }: { item: Word }) => (
      <Pressable
        style={styles.wordCard}
        onPress={() => handleWordTap(item)}
        onLongPress={() => handleWordDelete(item)}
      >
        <View style={styles.wordHeader}>
          <View style={styles.checkboxContainer}>
            <View
              style={[
                styles.checkbox,
                item.isRead && styles.checkboxChecked,
              ]}
            >
              {item.isRead && <Check size={16} color={Colors.card} />}
            </View>
          </View>
          <View style={styles.wordContent}>
            <Text style={styles.englishText}>{item.english}</Text>
            <Text style={styles.japaneseText}>
              {item.japanese || '翻訳なし'}
            </Text>
          </View>
        </View>
        <Text style={styles.dateText}>
          {new Date(item.createdAt).toLocaleDateString('ja-JP')}
        </Text>
      </Pressable>
    ),
    [handleWordTap, handleWordDelete]
  );

  /**
   * Render empty state
   */
  const renderEmpty = useCallback(() => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <BookOpen size={64} color={Colors.textSecondary} />
        </View>
        <Text style={styles.emptyTitle}>単語がまだ登録されていません</Text>
        <Text style={styles.emptyMessage}>
          HOMEからBlueskyの投稿で{'\n'}
          気になる単語を登録しましょう
        </Text>
      </View>
    );
  }, [isLoading]);

  /**
   * Get sort label for display
   */
  const getSortLabel = (): string => {
    if (sortBy === 'created_at') {
      return sortOrder === 'desc' ? '登録日時（新しい順）' : '登録日時（古い順）';
    }
    return sortOrder === 'asc' ? 'アルファベット順（A-Z）' : 'アルファベット順（Z-A）';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>単語帳</Text>
        </View>
        <Loading fullScreen message="単語を読み込み中..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>単語帳</Text>
        <Pressable onPress={handleSortChange} style={styles.sortButton}>
          <Text style={styles.sortIcon}>⇅</Text>
        </Pressable>
      </View>

      {/* Sort indicator */}
      <View style={styles.sortIndicator}>
        <Text style={styles.sortLabel}>{getSortLabel()}</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        <Pressable
          style={[
            styles.filterTab,
            filter === 'all' && styles.filterTabActive,
          ]}
          onPress={() => handleFilterChange('all')}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'all' && styles.filterTabTextActive,
            ]}
          >
            すべて
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.filterTab,
            filter === 'unread' && styles.filterTabActive,
          ]}
          onPress={() => handleFilterChange('unread')}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'unread' && styles.filterTabTextActive,
            ]}
          >
            未読
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.filterTab,
            filter === 'read' && styles.filterTabActive,
          ]}
          onPress={() => handleFilterChange('read')}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'read' && styles.filterTabTextActive,
            ]}
          >
            既読
          </Text>
        </Pressable>
      </View>

      {/* Word list */}
      <FlatList
        data={words}
        renderItem={renderWordItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
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
  sortButton: {
    padding: Spacing.sm,
  },
  sortIcon: {
    fontSize: FontSizes.xl,
    color: Colors.primary,
  },
  sortIndicator: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
  },
  sortLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterTab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterTabText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: Colors.textInverse,
  },
  listContent: {
    flexGrow: 1,
    padding: Spacing.md,
  },
  wordCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxContainer: {
    marginRight: Spacing.md,
    paddingTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  wordContent: {
    flex: 1,
  },
  englishText: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  japaneseText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  dateText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    textAlign: 'right',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    marginTop: Spacing.xxl,
  },
  emptyIconContainer: {
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default WordListScreen;
