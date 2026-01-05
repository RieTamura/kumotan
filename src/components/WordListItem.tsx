/**
 * WordListItem Component
 * Individual word item in the vocabulary list
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,  Animated,
  LayoutAnimation,
  Platform,
  UIManager,  Linking,
  Alert,
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
 * Database stores timestamps in JST (local time), display as-is
 */
function formatDate(dateString: string): string {
  try {
    // SQLite returns timestamps in 'YYYY-MM-DD HH:MM:SS' format (JST)
    // Parse as local time (not UTC) for display
    const localDate = new Date(dateString.replace(' ', 'T'));
    return format(localDate, 'yyyy/M/d HH:mm:ss', { locale: ja });
  } catch {
    return '-';
  }
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
  onPress,
  onToggleRead,
  onDelete,
}: WordListItemProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

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
   * Handle URL press - open in browser
   */
  const handleUrlPress = useCallback(async () => {
    if (word.postUrl) {
      try {
        // Convert AT Protocol URI to HTTPS URL if needed
        let urlToOpen = word.postUrl;
        
        // Check if it's an AT Protocol URI (at://...)
        if (word.postUrl.startsWith('at://')) {
          // Parse: at://did:plc:xxxxx/app.bsky.feed.post/xxxxx
          const match = word.postUrl.match(/^at:\/\/([^\/]+)\/app\.bsky\.feed\.post\/(.+)$/);
          if (match) {
            const [, did, rkey] = match;
            urlToOpen = `https://bsky.app/profile/${did}/post/${rkey}`;
          } else {
            Alert.alert('エラー', '投稿URLの形式が正しくありません');
            return;
          }
        }
        
        console.log('Opening URL:', urlToOpen);
        
        // Try to open the URL - suppress errors as they may be false positives
        await Linking.openURL(urlToOpen).catch((err) => {
          console.warn('Linking.openURL error (may be ignorable):', err);
          // If openURL fails, it might still work, so we don't show an alert
        });
      } catch (error) {
        console.error('Failed to open URL:', error);
        // Only show alert for actual failures
        Alert.alert('エラー', 'URLを開く際にエラーが発生しました');
      }
    }
  }, [word.postUrl]);

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
          numberOfLines={expanded ? undefined : 1}
        >
          {word.japanese || (word.definition ? word.definition.slice(0, 50) : '-')}
        </Text>

        {/* Expanded details */}
        {expanded && (
          <View style={styles.expandedContent}>
            {/* Definition or morphological analysis */}
            {word.definition && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>
                  {word.japanese && word.definition.includes('品詞:') ? '形態素解析結果' : '英語定義'}
                </Text>
                <Text style={styles.detailText}>{word.definition}</Text>
              </View>
            )}

            {/* Post text */}
            {word.postText && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>投稿文章</Text>
                <Text style={styles.detailText}>{word.postText}</Text>
              </View>
            )}

            {/* Post URL */}
            {word.postUrl && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>投稿URL</Text>
                <Pressable 
                  onPress={handleUrlPress}
                  onStartShouldSetResponder={() => true}
                  onResponderTerminationRequest={() => false}
                >
                  <Text style={styles.detailLink} numberOfLines={1}>
                    {word.postUrl}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Created date */}
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>登録日時</Text>
              <Text style={styles.detailText}>
                {new Date(word.createdAt).toLocaleString('ja-JP')}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Expand/Collapse indicator */}
      <Text style={styles.arrow}>{expanded ? '⌄' : '›'}</Text>
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
