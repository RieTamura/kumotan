/**
 * PostCard Component
 * Displays a single post from the Bluesky timeline
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
} from 'react-native';
import { MessageCircle, Repeat2, Heart } from 'lucide-react-native';
import { TimelinePost } from '../types/bluesky';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { formatRelativeTime } from '../services/bluesky/feed';

/**
 * PostCard props interface
 */
interface PostCardProps {
  post: TimelinePost;
  onWordSelect?: (word: string, postUri: string, postText: string) => void;
  clearSelection?: boolean;
}

/**
 * Default avatar placeholder
 */
const DEFAULT_AVATAR = 'https://cdn.bsky.app/img/avatar/plain/did:plc:default/avatar@jpeg';

/**
 * Token type for text parsing
 */
interface TextToken {
  text: string;
  isEnglishWord: boolean;
  index: number;
}

/**
 * Parse text into tokens (words and non-words)
 */
function parseTextIntoTokens(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  // Match English words or any other characters/sequences
  const regex = /([a-zA-Z][a-zA-Z'-]*)|([^a-zA-Z]+)/g;
  let match;
  let index = 0;

  while ((match = regex.exec(text)) !== null) {
    const isEnglishWord = match[1] !== undefined;
    tokens.push({
      text: match[0],
      isEnglishWord,
      index: index++,
    });
  }

  return tokens;
}

/**
 * PostCard Component
 */
export function PostCard({ post, onWordSelect, clearSelection }: PostCardProps): React.JSX.Element {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  /**
   * Clear selection when clearSelection prop changes to true
   */
  useEffect(() => {
    if (clearSelection) {
      setSelectedWord(null);
    }
  }, [clearSelection]);

  /**
   * Handle image load error
   */
  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  /**
   * Handle word long press - triggered on the specific word element
   */
  const handleWordLongPress = useCallback(
    (word: string) => {
      if (!onWordSelect) return;
      setSelectedWord(word);
      onWordSelect(word, post.uri, post.text);
    },
    [post.uri, post.text, onWordSelect]
  );

  /**
   * Handle press to clear selection
   */
  const handlePress = useCallback(() => {
    setSelectedWord(null);
  }, []);

  /**
   * Render post text with touchable words
   */
  const renderText = () => {
    const tokens = parseTextIntoTokens(post.text);

    return (
      <Text style={styles.postText}>
        {tokens.map((token) => {
          if (token.isEnglishWord) {
            const isSelected = selectedWord?.toLowerCase() === token.text.toLowerCase();
            return (
              <Text
                key={token.index}
                style={isSelected ? styles.highlightedWord : styles.selectableWord}
                onLongPress={() => handleWordLongPress(token.text)}
                suppressHighlighting={false}
              >
                {token.text}
              </Text>
            );
          }
          return <Text key={token.index}>{token.text}</Text>;
        })}
      </Text>
    );
  };

  return (
    <Pressable
      style={styles.container}
      onPress={handlePress}
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
          <MessageCircle size={16} color={Colors.textSecondary} />
          <Text style={styles.metricText}>{post.replyCount ?? 0}</Text>
        </View>
        <View style={styles.metric}>
          <Repeat2 size={16} color={Colors.textSecondary} />
          <Text style={styles.metricText}>{post.repostCount ?? 0}</Text>
        </View>
        <View style={styles.metric}>
          <Heart size={16} color={Colors.textSecondary} />
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
  selectableWord: {
    // Selectable words have same style as regular text but are touchable
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
