/**
 * PostCard Component
 * Displays a single post from the Bluesky timeline
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import { TimelinePost } from '../types/bluesky';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { formatRelativeTime } from '../services/bluesky/feed';

/**
 * PostCard props interface
 */
interface PostCardProps {
  post: TimelinePost;
  onWordSelect?: (word: string, postUri: string, postText: string) => void;
}

/**
 * Default avatar placeholder
 */
const DEFAULT_AVATAR = 'https://cdn.bsky.app/img/avatar/plain/did:plc:default/avatar@jpeg';

/**
 * PostCard Component
 */
export function PostCard({ post, onWordSelect }: PostCardProps): React.JSX.Element {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  /**
   * Handle image load error
   */
  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  /**
   * Handle long press on text to select a word
   */
  const handleLongPress = useCallback(
    (event: GestureResponderEvent) => {
      // Get the pressed position
      const { locationX, locationY } = event.nativeEvent;

      // For now, we'll show a simple word extraction
      // In a real implementation, you'd use text layout measurements
      // to determine which word was pressed
      const words = post.text.split(/\s+/).filter((word) => {
        // Filter to only English words (basic check)
        return /^[a-zA-Z][a-zA-Z'-]*$/.test(word);
      });

      if (words.length > 0 && onWordSelect) {
        // For demo purposes, show the first English word
        // In production, implement proper word detection at touch position
        const word = words[0];
        setSelectedWord(word);
        onWordSelect(word, post.uri, post.text);
      }
    },
    [post.text, post.uri, onWordSelect]
  );

  /**
   * Handle press to clear selection
   */
  const handlePress = useCallback(() => {
    setSelectedWord(null);
  }, []);

  /**
   * Render post text with potential highlighting
   */
  const renderText = () => {
    if (!selectedWord) {
      return <Text style={styles.postText}>{post.text}</Text>;
    }

    // Highlight selected word
    const parts = post.text.split(new RegExp(`(${selectedWord})`, 'gi'));

    return (
      <Text style={styles.postText}>
        {parts.map((part, index) =>
          part.toLowerCase() === selectedWord.toLowerCase() ? (
            <Text key={index} style={styles.highlightedWord}>
              {part}
            </Text>
          ) : (
            <Text key={index}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  return (
    <Pressable
      style={styles.container}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={500}
    >
      {/* Author row */}
      <View style={styles.authorRow}>
        <Image
          source={{ uri: imageError ? DEFAULT_AVATAR : (post.author.avatar || DEFAULT_AVATAR) }}
          style={styles.avatar}
          onError={handleImageError}
        />
        <View style={styles.authorInfo}>
          <Text style={styles.displayName} numberOfLines={1}>
            {post.author.displayName}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            @{post.author.handle}
          </Text>
        </View>
        <Text style={styles.timestamp}>
          {formatRelativeTime(post.createdAt)}
        </Text>
      </View>

      {/* Post content */}
      <View style={styles.content}>
        {renderText()}
      </View>

      {/* Engagement metrics */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricIcon}>💬</Text>
          <Text style={styles.metricText}>{post.replyCount ?? 0}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricIcon}>🔁</Text>
          <Text style={styles.metricText}>{post.repostCount ?? 0}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricIcon}>❤️</Text>
          <Text style={styles.metricText}>{post.likeCount ?? 0}</Text>
        </View>
      </View>

      {/* Selection hint */}
      {!selectedWord && (
        <Text style={styles.hint}>
          長押しで単語を選択
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    ...Shadows.sm,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.skeleton,
  },
  authorInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  displayName: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  handle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  timestamp: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
  },
  content: {
    marginBottom: Spacing.md,
  },
  postText: {
    fontSize: FontSizes.lg,
    color: Colors.text,
    lineHeight: 24,
  },
  highlightedWord: {
    backgroundColor: Colors.primaryLight,
    color: Colors.primary,
    fontWeight: '600',
    borderRadius: BorderRadius.sm,
  },
  metricsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.md,
    gap: Spacing.xl,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metricIcon: {
    fontSize: FontSizes.md,
  },
  metricText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  hint: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});

export default PostCard;
