/**
 * WordListItem Component
 * Individual word item in the vocabulary list
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable, Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {
  Colors,
  Spacing,
  FontSizes,
  BorderRadius,
} from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import { Word } from '../types/word';
import { MessageSquareShare } from 'lucide-react-native';
import { FeedbackModal } from './FeedbackModal';

/**
 * WordListItem props interface
 */
interface WordListItemProps {
  word: Word;
  onToggleRead?: (word: Word) => void;
  onDelete?: (word: Word) => void;
  onPostPress?: (postUri: string) => void;
}

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * WordListItem Component
 */
export function WordListItem({
  word,
  onToggleRead,
  onDelete,
  onPostPress,
}: WordListItemProps): React.JSX.Element {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);

  /**
   * Handle item press - toggle expansion
   */
  const handlePress = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  }, [expanded]);

  /**
   * Handle checkbox press
   */
  const handleToggleRead = useCallback(() => {
    onToggleRead?.(word);
  }, [word, onToggleRead]);

  /**
   * Handle URL press - open post in Thread screen
   */
  const handleUrlPress = useCallback(() => {
    if (word.postUrl && onPostPress) {
      onPostPress(word.postUrl);
    }
  }, [word.postUrl, onPostPress]);

  return (
    <Pressable
      style={({ pressed }: { pressed: boolean }) => [
        styles.container,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
        pressed && [styles.containerPressed, { backgroundColor: colors.backgroundSecondary }],
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
            { borderColor: colors.border },
            word.isRead && [styles.checkboxChecked, { backgroundColor: colors.success, borderColor: colors.success }],
          ]}
        >
          {word.isRead && (
            <Text style={[styles.checkmark, { color: '#FFFFFF' }]}>✓</Text>
          )}
        </View>
      </Pressable>

      {/* Word content */}
      <View style={styles.content}>
        <Text
          style={[
            styles.english,
            { color: colors.text },
            word.isRead && [styles.textRead, { color: colors.textTertiary }],
          ]}
          numberOfLines={expanded ? undefined : 1}
        >
          {word.english}
        </Text>

        <Text
          style={[
            styles.japanese,
            { color: colors.textSecondary },
            word.isRead && [styles.textRead, { color: colors.textTertiary }],
            !word.japanese && [styles.noTranslation, { color: colors.textTertiary }],
          ]}
          numberOfLines={expanded ? undefined : 1}
        >
          {word.japanese || (word.definition ? word.definition.slice(0, 50) : '-')}
        </Text>

        {/* Expanded details */}
        {expanded && (
          <View style={[styles.expandedContent, { borderTopColor: colors.divider }]}>
            {/* Definition or morphological analysis */}
            {word.definition && (
              <View style={styles.detailSection}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  {word.japanese && word.definition.includes('品詞:') ? '形態素解析結果' : '英語定義'}
                </Text>
                <Text style={[styles.detailText, { color: colors.text }]}>{word.definition}</Text>
              </View>
            )}

            {/* Post text */}
            {word.postText && (
              <View style={styles.detailSection}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>投稿文章</Text>
                <Text style={[styles.detailText, { color: colors.text }]}>{word.postText}</Text>
              </View>
            )}

            {/* Post URL */}
            {word.postUrl && (
              <View style={styles.detailSection}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>投稿URL</Text>
                <Pressable
                  onPress={handleUrlPress}
                  onStartShouldSetResponder={() => true}
                  onResponderTerminationRequest={() => false}
                >
                  <Text style={[styles.detailLink, { color: colors.primary }]} numberOfLines={1}>
                    {word.postUrl}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Feedback button */}
            <Pressable
              onPress={() => setIsFeedbackVisible(true)}
              style={[styles.feedbackButton, { borderColor: colors.border }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onStartShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
            >
              <MessageSquareShare size={16} color={colors.primary} />
              <Text style={[styles.feedbackButtonText, { color: colors.primary }]}>フィードバック</Text>
            </Pressable>

            {/* Created date */}
            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>登録日時</Text>
              <Text style={[styles.detailText, { color: colors.text }]}>
                {new Date(word.createdAt).toLocaleString('ja-JP')}
              </Text>
            </View>
          </View>
        )}

        {/* Feedback Modal */}
        <FeedbackModal
          visible={isFeedbackVisible}
          word={word.english}
          postUrl={word.postUrl || undefined}
          onClose={() => setIsFeedbackVisible(false)}
        />
      </View>

      {/* Expand/Collapse indicator */}
      <Text style={[styles.arrow, { color: colors.textTertiary }]}>{expanded ? '⌄' : '›'}</Text>
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
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { backgroundColor: colors.backgroundSecondary }]}>
      <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>{title}</Text>
      {count !== undefined && (
        <Text style={[styles.headerCount, { color: colors.textTertiary }]}>{count}件</Text>
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
  const { colors } = useTheme();
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📝</Text>
      <Text style={[styles.emptyMessage, { color: colors.text }]}>{message}</Text>
      <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
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
  english: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
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
  expandedContent: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  detailSection: {
    marginBottom: Spacing.sm,
  },
  detailLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  detailLink: {
    fontSize: FontSizes.xs,
    color: Colors.primary,
    lineHeight: 18,
  },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  feedbackButtonText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.primary,
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
