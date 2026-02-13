/**
 * Word List Screen
 * Displays saved vocabulary words with filtering and sorting options
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BookOpen, Trash2, Lightbulb, Search, X } from 'lucide-react-native';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { Word, WordFilter } from '../types/word';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { WordListItem } from '../components/WordListItem';
import { useWordStore } from '../store/wordStore';
import { useTheme } from '../hooks/useTheme';

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
  const { t } = useTranslation('wordList');
  const { t: tc } = useTranslation('common');
  const { t: th } = useTranslation('home');
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Use word store
  const {
    words,
    isLoading,
    loadWords,
    toggleReadStatus: toggleReadStatusStore,
    deleteWord: deleteWordStore,
    setFilter: setStoreFilter
  } = useWordStore();

  // Filter and sort state (local UI state)
  const [filter, setFilter] = useState<FilterOption>('all');
  const [sortBy, setSortBy] = useState<SortOption>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const searchQueryRef = useRef('');
  const searchInputRef = useRef<TextInput>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toast notifications
  const { toastState, showSuccess, showError, hideToast } = useToast();

  /**
   * Build and apply filter to store.
   * Uses ref for searchQuery to avoid re-creating this callback on every keystroke,
   * which would cause useFocusEffect to bypass debounce.
   */
  const applyFilter = useCallback((query?: string) => {
    const currentQuery = query !== undefined ? query : searchQueryRef.current;
    const wordFilter: WordFilter = {
      isRead: filter === 'all' ? null : filter === 'read',
      sortBy,
      sortOrder,
      limit: 1000,
      offset: 0,
      searchQuery: currentQuery || undefined,
    };

    setStoreFilter(wordFilter);
  }, [filter, sortBy, sortOrder, setStoreFilter]);

  /**
   * Handle search input change with debounce
   */
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    searchQueryRef.current = text;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      applyFilter(text);
    }, 300);
  }, [applyFilter]);

  /**
   * Clear search query
   */
  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    searchQueryRef.current = '';
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    applyFilter('');
    searchInputRef.current?.blur();
  }, [applyFilter]);

  /**
   * Cleanup debounce timer
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Load words when screen is focused
   */
  useFocusEffect(
    useCallback(() => {
      applyFilter();
    }, [applyFilter])
  );

  /**
   * Reload when filter or sort changes
   */
  useEffect(() => {
    if (!isLoading) {
      applyFilter();
    }
  }, [filter, sortBy, sortOrder]);

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
      t('sort.title'),
      undefined,
      [
        {
          text: t('sort.dateDesc'),
          onPress: () => {
            setSortBy('created_at');
            setSortOrder('desc');
          },
        },
        {
          text: t('sort.dateAsc'),
          onPress: () => {
            setSortBy('created_at');
            setSortOrder('asc');
          },
        },
        {
          text: t('sort.alphabetAsc'),
          onPress: () => {
            setSortBy('english');
            setSortOrder('asc');
          },
        },
        {
          text: t('sort.alphabetDesc'),
          onPress: () => {
            setSortBy('english');
            setSortOrder('desc');
          },
        },
        { text: tc('buttons.cancel'), style: 'cancel' },
      ]
    );
  }, [t, tc]);

  /**
   * Handle checkbox toggle (read status)
   */
  const handleToggleRead = useCallback(async (word: Word) => {
    const result = await toggleReadStatusStore(word.id);
    if (!result.success) {
      showError(result.error.message);
    }
  }, [toggleReadStatusStore, showError]);

  /**
   * Handle post press - navigate to Thread screen
   */
  const handlePostPress = useCallback((postUri: string) => {
    navigation.navigate('Thread', { postUri });
  }, [navigation]);

  /**
   * Handle word delete
   */
  const handleWordDelete = useCallback(async (word: Word) => {
    Alert.alert(
      t('delete.title'),
      t('delete.message', { word: word.english }),
      [
        { text: tc('buttons.cancel'), style: 'cancel' },
        {
          text: tc('buttons.delete'),
          style: 'destructive',
          onPress: async () => {
            const result = await deleteWordStore(word.id);
            if (result.success) {
              showSuccess(t('delete.success'));
            } else {
              showError(result.error.message);
            }
          },
        },
      ]
    );
  }, [deleteWordStore, showSuccess, showError, t, tc]);

  /**
   * Render word item
   */
  const renderWordItem = useCallback(
    ({ item }: { item: Word }) => (
      <View style={[styles.wordCard, { backgroundColor: colors.card }]}>
        <View style={styles.wordCardWrapper}>
          <WordListItem
            word={item}
            onToggleRead={handleToggleRead}
            onPostPress={handlePostPress}
          />
        </View>
        <Pressable
          style={styles.deleteButton}
          onPress={() => handleWordDelete(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityLabel={`${item.english}を削除`}
          accessibilityHint="単語帳から単語を削除します"
          accessibilityRole="button"
        >
          <Trash2 size={20} color={colors.error} />
        </Pressable>
      </View>
    ),
    [handleToggleRead, handleWordDelete, handlePostPress, colors]
  );

  /**
   * Render empty state
   */
  const renderEmpty = useCallback(() => {
    if (isLoading) return null;

    if (searchQuery.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Search size={64} color={colors.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('search.noResults')}</Text>
          <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
            {t('search.noResultsMessage')}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <BookOpen size={64} color={colors.textSecondary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('empty')}</Text>
        <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
          {t('emptyMessage')}
        </Text>
      </View>
    );
  }, [isLoading, searchQuery, t, colors]);

  /**
   * Get sort label for display
   */
  const getSortLabel = (): string => {
    if (sortBy === 'created_at') {
      return sortOrder === 'desc' ? t('sort.dateDesc') : t('sort.dateAsc');
    }
    return sortOrder === 'asc' ? t('sort.alphabetAsc') : t('sort.alphabetDesc');
  };

  // Show full-screen loading only on initial load (no words yet, no search active)
  if (isLoading && words.length === 0 && !searchQuery) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('header')}</Text>
        </View>
        <Loading fullScreen message={tc('status.loading')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('header')}</Text>
        <Pressable
          onPress={() => navigation.navigate('Tips')}
          style={({ pressed }) => [
            styles.headerIconButton,
            pressed && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
          ]}
          accessible={true}
          accessibilityLabel={th('tips')}
          accessibilityHint={th('tipsHint')}
          accessibilityRole="button"
        >
          <Lightbulb size={24} color={colors.primary} />
        </Pressable>
      </View>

      {/* Search bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary }]}>
        <View
          style={[
            styles.searchInputContainer,
            { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
          ]}
        >
          <View style={styles.searchIconContainer}>
            <Search size={18} color={colors.textSecondary} />
          </View>
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessible={true}
            accessibilityLabel={t('search.placeholder')}
            accessibilityHint={t('search.accessibilityHint')}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={handleSearchClear}
              style={styles.searchClearButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessible={true}
              accessibilityLabel={t('search.clear')}
              accessibilityRole="button"
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Sort indicator */}
      <View style={[styles.sortIndicator, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.sortLabel, { color: colors.textSecondary }]}>{getSortLabel()}</Text>
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterContainer, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.border }]}>
        <View style={styles.filterTabsWrapper}>
          <Pressable
            style={[
              styles.filterTab,
              filter === 'unread' && [styles.filterTabActive, { backgroundColor: colors.primary }],
            ]}
            onPress={() => handleFilterChange('unread')}
            accessible={true}
            accessibilityLabel={t('filters.unread')}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'unread' }}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: colors.textSecondary },
                filter === 'unread' && [styles.filterTabTextActive, { color: '#FFFFFF' }],
              ]}
            >
              {t('filters.unread')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.filterTab,
              filter === 'read' && [styles.filterTabActive, { backgroundColor: colors.primary }],
            ]}
            onPress={() => handleFilterChange('read')}
            accessible={true}
            accessibilityLabel={t('filters.read')}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'read' }}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: colors.textSecondary },
                filter === 'read' && [styles.filterTabTextActive, { color: '#FFFFFF' }],
              ]}
            >
              {t('filters.read')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.filterTab,
              filter === 'all' && [styles.filterTabActive, { backgroundColor: colors.primary }],
            ]}
            onPress={() => handleFilterChange('all')}
            accessible={true}
            accessibilityLabel={t('filters.all')}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'all' }}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: colors.textSecondary },
                filter === 'all' && [styles.filterTabTextActive, { color: '#FFFFFF' }],
              ]}
            >
              {t('filters.all')}
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={handleSortChange}
          style={styles.sortButton}
          accessible={true}
          accessibilityLabel={t('sort.title')}
          accessibilityHint={getSortLabel()}
          accessibilityRole="button"
        >
          <Text style={[styles.sortIcon, { color: colors.primary }]}>⇅</Text>
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

      {/* Toast Notification */}
      <Toast
        visible={toastState.visible}
        message={toastState.message}
        type={toastState.type}
        duration={toastState.duration}
        onDismiss={hideToast}
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
    minHeight: 56,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  headerIconButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    minHeight: 40,
  },
  searchIconContainer: {
    paddingLeft: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  searchClearButton: {
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterTabsWrapper: {
    flexDirection: 'row',
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
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
    overflow: 'hidden',
  },
  wordCardWrapper: {
    flex: 1,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'transparent',
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
