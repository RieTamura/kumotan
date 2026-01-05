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
import { splitIntoSentences } from '../utils/validators';

/**
 * PostCard props interface
 */
interface PostCardProps {
  post: TimelinePost;
  onWordSelect?: (word: string, postUri: string, postText: string) => void;
  onSentenceSelect?: (sentence: string, postUri: string, postText: string) => void;
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
  isJapaneseWord: boolean;
  isEnglishSentence: boolean;
  index: number;
}

/**
 * Parse text into tokens (sentences and words)
 */
function parseTextIntoTokens(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  const sentences = splitIntoSentences(text);
  
  if (sentences.length === 0) {
    return tokens;
  }
  
  let index = 0;
  let currentPos = 0;
  
  for (const sentence of sentences) {
    const sentenceStart = text.indexOf(sentence, currentPos);
    
    // Add any text before this sentence
    if (sentenceStart > currentPos) {
      const beforeText = text.substring(currentPos, sentenceStart);
      if (beforeText.trim()) {
        tokens.push({
          text: beforeText,
          isEnglishWord: false,
          isJapaneseWord: false,
          isEnglishSentence: false,
          index: index++,
        });
      }
    }
    
    // Check if sentence contains English words
    const hasEnglish = /[a-zA-Z]/.test(sentence);
    const isEnglishSentence = hasEnglish && /[.!?]$/.test(sentence.trim());
    
    if (isEnglishSentence) {
      // English sentence - parse into words and spaces
      const wordPattern = /([a-zA-Z][a-zA-Z'-]*)|(\s+)|([^\sa-zA-Z]+)/g;
      let match;
      
      while ((match = wordPattern.exec(sentence)) !== null) {
        const isWord = match[1] !== undefined;
        const isSpace = match[2] !== undefined;
        tokens.push({
          text: match[0],
          isEnglishWord: isWord,
          isJapaneseWord: false,
          isEnglishSentence: false,
          index: index++,
        });
      }
    } else {
      // Japanese or non-English sentence
      const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
      tokens.push({
        text: sentence,
        isEnglishWord: false,
        isJapaneseWord: japanesePattern.test(sentence),
        isEnglishSentence: false,
        index: index++,
      });
    }
    
    currentPos = sentenceStart + sentence.length;
  }
  
  // Add any remaining text
  if (currentPos < text.length) {
    const remaining = text.substring(currentPos);
    if (remaining.trim()) {
      tokens.push({
        text: remaining,
        isEnglishWord: false,
        isJapaneseWord: false,
        isEnglishSentence: false,
        index: index++,
      });
    }
  }
  
  return tokens;
}

/**
 * PostCard Component
 */
export function PostCard({ post, onWordSelect, onSentenceSelect, clearSelection }: PostCardProps): React.JSX.Element {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  /**
   * Clear selection when clearSelection prop changes to true
   */
  useEffect(() => {
    if (clearSelection) {
      setSelectedWord(null);
      setSelectedSentence(null);
    }
  }, [clearSelection]);

  /**
   * Cleanup timer on unmount to prevent memory leaks
   */
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

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
      setSelectedSentence(null);
      onWordSelect(word, post.uri, post.text);
    },
    [post.uri, post.text, onWordSelect]
  );

  /**
   * Get full sentence containing the word
   */
  const getSentenceContainingWord = useCallback((wordText: string): string | null => {
    const sentences = splitIntoSentences(post.text);
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(wordText.toLowerCase())) {
        return sentence;
      }
    }
    return null;
  }, [post.text]);

  /**
   * Handle sentence selection (double tap on word)
   */
  const handleWordDoubleTap = useCallback(
    (word: string) => {
      if (!onSentenceSelect) return;
      
      const sentence = getSentenceContainingWord(word);
      if (sentence) {
        setSelectedSentence(sentence);
        setSelectedWord(null);
        onSentenceSelect(sentence, post.uri, post.text);
      }
    },
    [post.uri, post.text, onSentenceSelect, getSentenceContainingWord]
  );

  /**
   * Handle Japanese sentence long press
   */
  const handleJapaneseSentenceLongPress = useCallback(
    (sentence: string) => {
      if (!onSentenceSelect) return;
      setSelectedSentence(sentence);
      setSelectedWord(null);
      onSentenceSelect(sentence, post.uri, post.text);
    },
    [post.uri, post.text, onSentenceSelect]
  );

  /**
   * Handle word press with double-tap detection
   */
  const handleWordPress = useCallback(
    (word: string) => {
      if (longPressTimer) {
        // Second tap within timer - treat as double tap
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
        handleWordDoubleTap(word);
      } else {
        // First tap - start timer for double-tap detection
        const timer = setTimeout(() => {
          setLongPressTimer(null);
        }, 300); // 300ms window for double tap
        setLongPressTimer(timer);
      }
    },
    [longPressTimer, handleWordDoubleTap]
  );

  /**
   * Handle press to clear selection
   */
  const handlePress = useCallback(() => {
    setSelectedWord(null);
    setSelectedSentence(null);
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  /**
   * Render post text with touchable words
   */
  const renderText = () => {
    const tokens = parseTextIntoTokens(post.text);

    return (
      <Text style={styles.postText}>
        {tokens.map((token) => {
          if (token.isEnglishWord) {
            const isWordSelected = selectedWord?.toLowerCase() === token.text.toLowerCase();
            const sentence = getSentenceContainingWord(token.text);
            const isSentenceSelected = selectedSentence && sentence === selectedSentence;
            
            return (
              <Text
                key={token.index}
                style={
                  isWordSelected
                    ? styles.highlightedWord
                    : isSentenceSelected
                    ? styles.highlightedSentence
                    : styles.selectableWord
                }
                onLongPress={() => handleWordLongPress(token.text)}
                onPress={() => handleWordPress(token.text)}
                suppressHighlighting={false}
              >
                {token.text}
              </Text>
            );
          }
          
          if (token.isJapaneseWord) {
            const isSentenceSelected = selectedSentence === token.text;
            
            return (
              <Text
                key={token.index}
                style={
                  isSentenceSelected
                    ? styles.highlightedSentence
                    : styles.selectableJapanese
                }
                onLongPress={() => handleJapaneseSentenceLongPress(token.text)}
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
      {!selectedWord && !selectedSentence && (
        <Text style={styles.hint}>
          長押しで単語選択。ダブルタップで文章を選択 ※英文のみ
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
  selectableJapanese: {
    // Selectable Japanese sentences have same style as regular text but are touchable
  },
  highlightedWord: {
    backgroundColor: Colors.primaryLight,
    color: Colors.primary,
    fontWeight: '600',
    borderRadius: BorderRadius.sm,
  },
  highlightedSentence: {
    backgroundColor: '#FFF3E0', // Light orange for sentence highlighting
    color: Colors.text,
    fontWeight: '500',
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
