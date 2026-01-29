/**
 * PostCard Component
 * Displays a single post from the Bluesky timeline
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Linking,
} from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { MessageCircle, Repeat2, Heart, BookSearch, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { TimelinePost } from '../types/bluesky';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { formatRelativeTime } from '../services/bluesky/feed';
import { splitIntoSentences } from '../utils/validators';
import { tokenizeJapanese, isMeaningfulToken } from '../utils/japaneseTokenizer';

/**
 * PostCard props interface
 */
interface PostCardProps {
  post: TimelinePost;
  onWordSelect?: (word: string, postUri: string, postText: string) => void;
  onSentenceSelect?: (sentence: string, postUri: string, postText: string) => void;
  onPostPress?: (postUri: string) => void;
  onLikePress?: (post: TimelinePost, isLiked: boolean) => void;
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
  isUrl: boolean;
  isHashtag: boolean;
  hashtagValue?: string; // The hashtag without the # prefix
  index: number;
}

/**
 * URL regex pattern for detecting links in text
 */
const URL_REGEX = /https?:\/\/[^\s<>"\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g;

/**
 * Hashtag regex pattern for detecting hashtags in text
 */
const HASHTAG_REGEX = /#[\p{L}\p{N}_]+/gu;

/**
 * Parse text segment into tokens (words, Japanese text, etc.)
 * Used for non-URL text segments
 */
function parseTextSegmentIntoTokens(text: string, startIndex: number): { tokens: TextToken[]; nextIndex: number } {
  const tokens: TextToken[] = [];
  const sentences = splitIntoSentences(text);

  // If no sentences found but text exists (e.g., only whitespace/newlines), preserve it
  if (sentences.length === 0) {
    if (text.length > 0) {
      tokens.push({
        text,
        isEnglishWord: false,
        isJapaneseWord: false,
        isEnglishSentence: false,
        isUrl: false,
        isHashtag: false,
        index: startIndex,
      });
      return { tokens, nextIndex: startIndex + 1 };
    }
    return { tokens, nextIndex: startIndex };
  }

  let index = startIndex;
  let currentPos = 0;

  for (const sentence of sentences) {
    const sentenceStart = text.indexOf(sentence, currentPos);

    // Add any text before this sentence (including whitespace/newlines)
    if (sentenceStart > currentPos) {
      const beforeText = text.substring(currentPos, sentenceStart);
      if (beforeText.length > 0) {
        tokens.push({
          text: beforeText,
          isEnglishWord: false,
          isJapaneseWord: false,
          isEnglishSentence: false,
          isUrl: false,
          isHashtag: false,
          index: index++,
        });
      }
    }

    // Check if sentence contains English words
    const hasEnglish = /[a-zA-Z]/.test(sentence);
    const hasTerminalPunctuation = /[.!?]$/.test(sentence.trim());
    // 句読点がない場合でも、単一文章なら英文として扱う
    const isOnlySentence = sentences.length === 1;
    const isEnglishSentence = hasEnglish && (hasTerminalPunctuation || isOnlySentence);

    if (isEnglishSentence) {
      // English sentence - parse into words and spaces
      const wordPattern = /([a-zA-Z][a-zA-Z'-]*)|(\s+)|([^\sa-zA-Z]+)/g;
      let match;

      while ((match = wordPattern.exec(sentence)) !== null) {
        const isWord = match[1] !== undefined;
        tokens.push({
          text: match[0],
          isEnglishWord: isWord,
          isJapaneseWord: false,
          isEnglishSentence: false,
          isUrl: false,
          isHashtag: false,
          index: index++,
        });
      }
    } else {
      // Japanese or non-English sentence - tokenize into word units
      const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
      const hasJapanese = japanesePattern.test(sentence);

      if (hasJapanese) {
        // Tokenize Japanese text into word-like units
        const japaneseTokens = tokenizeJapanese(sentence);
        for (const jToken of japaneseTokens) {
          tokens.push({
            text: jToken.text,
            isEnglishWord: false,
            isJapaneseWord: isMeaningfulToken(jToken),
            isEnglishSentence: false,
            isUrl: false,
            isHashtag: false,
            index: index++,
          });
        }
      } else {
        // Non-Japanese, non-English text
        tokens.push({
          text: sentence,
          isEnglishWord: false,
          isJapaneseWord: false,
          isEnglishSentence: false,
          isUrl: false,
          isHashtag: false,
          index: index++,
        });
      }
    }

    currentPos = sentenceStart + sentence.length;
  }

  // Add any remaining text (including whitespace/newlines)
  if (currentPos < text.length) {
    const remaining = text.substring(currentPos);
    if (remaining.length > 0) {
      tokens.push({
        text: remaining,
        isEnglishWord: false,
        isJapaneseWord: false,
        isEnglishSentence: false,
        isUrl: false,
        isHashtag: false,
        index: index++,
      });
    }
  }

  return { tokens, nextIndex: index };
}

/**
 * Special match type for URLs and hashtags
 */
interface SpecialMatch {
  text: string;
  start: number;
  end: number;
  type: 'url' | 'hashtag';
  value?: string; // For hashtags, the tag without #
}

/**
 * Parse text into tokens (sentences, words, URLs, and hashtags)
 * URLs and hashtags are extracted first and then remaining text is parsed
 */
function parseTextIntoTokens(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  let index = 0;

  // Find all URLs and hashtags in the text
  const specialMatches: SpecialMatch[] = [];
  let urlMatch: RegExpExecArray | null;
  let hashtagMatch: RegExpExecArray | null;

  // Find URLs
  const urlRegex = new RegExp(URL_REGEX.source, 'g');
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    specialMatches.push({
      text: urlMatch[0],
      start: urlMatch.index,
      end: urlMatch.index + urlMatch[0].length,
      type: 'url',
    });
  }

  // Find hashtags
  const hashtagRegex = new RegExp(HASHTAG_REGEX.source, 'gu');
  while ((hashtagMatch = hashtagRegex.exec(text)) !== null) {
    // Don't add if it overlaps with a URL
    const overlapsWithUrl = specialMatches.some(
      (m) => m.type === 'url' && hashtagMatch!.index >= m.start && hashtagMatch!.index < m.end
    );
    if (!overlapsWithUrl) {
      specialMatches.push({
        text: hashtagMatch[0],
        start: hashtagMatch.index,
        end: hashtagMatch.index + hashtagMatch[0].length,
        type: 'hashtag',
        value: hashtagMatch[0].slice(1), // Remove # prefix
      });
    }
  }

  // If no special matches, parse the entire text as before
  if (specialMatches.length === 0) {
    const result = parseTextSegmentIntoTokens(text, 0);
    return result.tokens;
  }

  // Sort by start position
  specialMatches.sort((a, b) => a.start - b.start);

  // Process text with special matches
  let currentPos = 0;

  for (const specialMatch of specialMatches) {
    // Process text before this match
    if (specialMatch.start > currentPos) {
      const beforeText = text.substring(currentPos, specialMatch.start);
      const result = parseTextSegmentIntoTokens(beforeText, index);
      tokens.push(...result.tokens);
      index = result.nextIndex;
    }

    // Add special token
    if (specialMatch.type === 'url') {
      tokens.push({
        text: specialMatch.text,
        isEnglishWord: false,
        isJapaneseWord: false,
        isEnglishSentence: false,
        isUrl: true,
        isHashtag: false,
        index: index++,
      });
    } else {
      tokens.push({
        text: specialMatch.text,
        isEnglishWord: false,
        isJapaneseWord: false,
        isEnglishSentence: false,
        isUrl: false,
        isHashtag: true,
        hashtagValue: specialMatch.value,
        index: index++,
      });
    }

    currentPos = specialMatch.end;
  }

  // Process text after the last match
  if (currentPos < text.length) {
    const afterText = text.substring(currentPos);
    const result = parseTextSegmentIntoTokens(afterText, index);
    tokens.push(...result.tokens);
  }

  return tokens;
}

/**
 * PostCard Component (internal)
 */
function PostCardComponent({ post, onWordSelect, onSentenceSelect, onPostPress, onLikePress, clearSelection }: PostCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation(['home', 'common']);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  // Like state - track locally for immediate UI feedback
  const [isLiked, setIsLiked] = useState(!!post.viewer?.like);
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [isLikeLoading, setIsLikeLoading] = useState(false);

  // Image viewer state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  // Sync like state with post prop changes
  useEffect(() => {
    setIsLiked(!!post.viewer?.like);
    setLikeCount(post.likeCount ?? 0);
  }, [post.viewer?.like, post.likeCount]);

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
   * Handle Japanese word press (single tap) - triggers word mode
   */
  const handleJapaneseWordPress = useCallback(
    (word: string) => {
      if (!onWordSelect) return;
      setSelectedWord(word);
      setSelectedSentence(null);
      onWordSelect(word, post.uri, post.text);
    },
    [post.uri, post.text, onWordSelect]
  );

  /**
   * Handle Japanese sentence long press - triggers sentence mode
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
   * Handle BookSearch button press - select entire post as sentence
   */
  const handleBookSearchPress = useCallback(() => {
    if (!onSentenceSelect) return;
    const fullText = post.text.trim();
    if (fullText) {
      setSelectedSentence(fullText);
      setSelectedWord(null);
      onSentenceSelect(fullText, post.uri, post.text);
    }
  }, [post.uri, post.text, onSentenceSelect]);

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
   * Handle press to clear selection or navigate to thread
   */
  const handlePress = useCallback(() => {
    // If there's a selection, clear it first
    if (selectedWord || selectedSentence) {
      setSelectedWord(null);
      setSelectedSentence(null);
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      return;
    }

    // If no selection and we have a double-tap timer pending, don't navigate yet
    if (longPressTimer) {
      return;
    }

    // Navigate to thread
    if (onPostPress) {
      onPostPress(post.uri);
    }
  }, [selectedWord, selectedSentence, longPressTimer, onPostPress, post.uri]);

  /**
   * Handle URL press - open in browser
   */
  const handleUrlPress = useCallback((url: string) => {
    Linking.openURL(url).catch((err) => {
      if (__DEV__) {
        console.error('Failed to open URL:', err);
      }
    });
  }, []);

  /**
   * Handle hashtag press - open Bluesky search
   */
  const handleHashtagPress = useCallback((tag: string) => {
    const searchUrl = `https://bsky.app/search?q=%23${encodeURIComponent(tag)}`;
    Linking.openURL(searchUrl).catch((err) => {
      if (__DEV__) {
        console.error('Failed to open hashtag search:', err);
      }
    });
  }, []);

  /**
   * Handle like button press
   */
  const handleLikePress = useCallback(() => {
    if (isLikeLoading || !onLikePress) return;

    // Optimistic update
    setIsLikeLoading(true);
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikeCount((prev) => newIsLiked ? prev + 1 : Math.max(0, prev - 1));

    // Call parent handler
    onLikePress(post, newIsLiked);

    // Reset loading state after a short delay
    setTimeout(() => setIsLikeLoading(false), 500);
  }, [isLiked, isLikeLoading, onLikePress, post]);

  /**
   * Memoize parsed tokens to avoid re-parsing on every render
   */
  const tokens = useMemo(() => parseTextIntoTokens(post.text), [post.text]);

  /**
   * Render post text with touchable words
   */
  const renderText = () => {

    return (
      <Text style={styles.postText}>
        {tokens.map((token) => {
          // URL tokens - make them tappable links
          if (token.isUrl) {
            return (
              <Text
                key={token.index}
                style={styles.urlText}
                onPress={() => handleUrlPress(token.text)}
                suppressHighlighting={false}
              >
                {token.text}
              </Text>
            );
          }

          // Hashtag tokens - make them tappable links
          if (token.isHashtag && token.hashtagValue) {
            return (
              <Text
                key={token.index}
                style={styles.hashtagText}
                onPress={() => handleHashtagPress(token.hashtagValue!)}
                suppressHighlighting={false}
              >
                {token.text}
              </Text>
            );
          }

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
            const isWordSelected = selectedWord === token.text;
            const isSentenceSelected = selectedSentence && post.text.includes(selectedSentence) && selectedSentence.includes(token.text);

            return (
              <Text
                key={token.index}
                style={
                  isWordSelected
                    ? styles.highlightedWord
                    : isSentenceSelected
                    ? styles.highlightedSentence
                    : styles.selectableJapanese
                }
                onPress={() => handleJapaneseWordPress(token.text)}
                onLongPress={() => handleJapaneseSentenceLongPress(post.text)}
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

  /**
   * Handle image press - open image viewer
   */
  const handleImagePress = useCallback((index: number) => {
    setImageViewerIndex(index);
    setImageViewerVisible(true);
  }, []);

  /**
   * Prepare images for the image viewer
   */
  const imageViewerImages = useMemo(() => {
    const images = post.embed?.images;
    if (!images || images.length === 0) return [];
    return images.map((image) => ({
      uri: image.fullsize || image.thumb,
    }));
  }, [post.embed?.images]);

  /**
   * Render embedded images
   */
  const renderImages = () => {
    const images = post.embed?.images;
    if (!images || images.length === 0) return null;

    const imageCount = images.length;

    // Single image
    if (imageCount === 1) {
      const image = images[0];
      return (
        <Pressable
          style={styles.singleImageContainer}
          onPress={() => handleImagePress(0)}
          accessible={true}
          accessibilityLabel={image.alt || '投稿画像'}
          accessibilityRole="image"
        >
          <Image
            source={{ uri: image.thumb }}
            style={styles.singleImage}
            resizeMode="cover"
          />
          {image.alt ? (
            <View style={styles.altBadge}>
              <Text style={styles.altBadgeText}>ALT</Text>
            </View>
          ) : null}
        </Pressable>
      );
    }

    // Two images - side by side
    if (imageCount === 2) {
      return (
        <View style={styles.twoImageContainer}>
          {images.map((image, index) => (
            <Pressable
              key={index}
              style={styles.twoImageItem}
              onPress={() => handleImagePress(index)}
              accessible={true}
              accessibilityLabel={image.alt || `投稿画像 ${index + 1}`}
              accessibilityRole="image"
            >
              <Image
                source={{ uri: image.thumb }}
                style={styles.gridImage}
                resizeMode="cover"
              />
              {image.alt ? (
                <View style={styles.altBadge}>
                  <Text style={styles.altBadgeText}>ALT</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      );
    }

    // Three or four images - grid
    return (
      <View style={styles.gridContainer}>
        {images.slice(0, 4).map((image, index) => (
          <Pressable
            key={index}
            style={[
              styles.gridItem,
              imageCount === 3 && index === 0 && styles.gridItemLarge,
            ]}
            onPress={() => handleImagePress(index)}
            accessible={true}
            accessibilityLabel={image.alt || `投稿画像 ${index + 1}`}
            accessibilityRole="image"
          >
            <Image
              source={{ uri: image.thumb }}
              style={styles.gridImage}
              resizeMode="cover"
            />
            {image.alt ? (
              <View style={styles.altBadge}>
                <Text style={styles.altBadgeText}>ALT</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <Pressable
      style={styles.container}
      onPress={handlePress}
      accessible={true}
      accessibilityLabel={`${post.author.displayName}の投稿: ${post.text.substring(0, 100)}`}
      accessibilityHint="長押しで単語を選択できます"
      accessibilityRole="button"
    >
      <View style={styles.postLayout}>
        {/* Avatar column */}
        <Image
          source={{ uri: imageError ? DEFAULT_AVATAR : (post.author.avatar || DEFAULT_AVATAR) }}
          style={styles.avatar}
          onError={handleImageError}
        />

        {/* Content column */}
        <View style={styles.contentColumn}>
          {/* Author row */}
          <View style={styles.authorRow}>
            <View style={styles.authorInfo}>
              <Text style={styles.displayName} numberOfLines={1}>
                {post.author.displayName}
              </Text>
              <Text style={styles.handle} numberOfLines={1}>
                @{post.author.handle}
              </Text>
            </View>
            <Text style={styles.timestamp}>
              {formatRelativeTime(post.createdAt, t, i18n.language)}
            </Text>
          </View>

          {/* Post content */}
          <View style={styles.content}>
            {renderText()}
          </View>

          {/* Embedded images */}
          {renderImages()}

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
            <Pressable
              style={styles.likeButton}
              onPress={handleLikePress}
              disabled={isLikeLoading || !onLikePress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessible={true}
              accessibilityLabel={isLiked ? t('home:unlike') : t('home:like')}
              accessibilityRole="button"
            >
              <Heart
                size={16}
                color={isLiked ? Colors.error : Colors.textSecondary}
                fill={isLiked ? Colors.error : 'none'}
              />
              <Text style={[styles.metricText, isLiked && styles.likedText]}>
                {likeCount}
              </Text>
            </Pressable>
            {onSentenceSelect && (
              <Pressable
                style={styles.bookSearchButton}
                onPress={handleBookSearchPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessible={true}
                accessibilityLabel={t('home:lookupPost')}
                accessibilityRole="button"
              >
                <BookSearch size={16} color={Colors.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Image Viewer Modal */}
      <ImageViewing
        images={imageViewerImages}
        imageIndex={imageViewerIndex}
        visible={imageViewerVisible}
        onRequestClose={() => setImageViewerVisible(false)}
        backgroundColor="rgba(0, 0, 0, 0.85)"
        HeaderComponent={({ imageIndex }) => (
          <View style={styles.imageViewerHeader}>
            <Text style={styles.imageViewerTitle}>
              {t('home:imagePreview', '画像プレビュー')}
              {imageViewerImages.length > 1 && ` (${imageIndex + 1}/${imageViewerImages.length})`}
            </Text>
            <Pressable
              onPress={() => setImageViewerVisible(false)}
              style={styles.imageViewerCloseButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color="#fff" />
            </Pressable>
          </View>
        )}
      />
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
  postLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.skeleton,
    marginRight: Spacing.md,
  },
  contentColumn: {
    flex: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  authorInfo: {
    flex: 1,
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
  urlText: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  hashtagText: {
    color: Colors.primary,
  },
  metricsRow: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
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
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  likedText: {
    color: Colors.error,
  },
  bookSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xs,
  },
  // Image styles
  singleImageContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  singleImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
  },
  twoImageContainer: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  twoImageItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  gridItem: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  gridItemLarge: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  altBadge: {
    position: 'absolute',
    bottom: Spacing.xs,
    left: Spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  altBadgeText: {
    color: Colors.textInverse,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  // Image viewer header styles
  imageViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  imageViewerTitle: {
    color: '#fff',
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  imageViewerCloseButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});

/**
 * PostCard with React.memo for performance optimization
 * Only re-renders when props change
 */
export const PostCard = React.memo(PostCardComponent);

export default PostCard;
