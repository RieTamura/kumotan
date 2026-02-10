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
import { MessageCircle, MessageCircleDashed, MessageCircleOff, Repeat2, Heart, BookSearch, X, ExternalLink } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { TimelinePost } from '../types/bluesky';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../constants/colors';
import { formatRelativeTime } from '../services/bluesky/feed';
import { splitIntoSentences } from '../utils/validators';
import { tokenizeJapanese, isMeaningfulToken } from '../utils/japaneseTokenizer';
import { useTheme } from '../hooks/useTheme';

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
  onLayoutElements?: (elements: {
    bookIcon?: { x: number; y: number; width: number; height: number };
    firstWord?: { x: number; y: number; width: number; height: number };
    contentColumn?: { x: number; y: number; width: number; height: number };
  }) => void;
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
  isMention: boolean;
  hashtagValue?: string; // The hashtag without the # prefix
  mentionHandle?: string; // The handle without the @ prefix
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
 * Mention regex pattern for detecting @handle mentions in text
 * Handles patterns like @handle.domain.tld
 * Pattern: @ followed by word chars, dots, and hyphens, ending with a word char
 */
const MENTION_REGEX = /@[\w](?:[\w.-]*[\w])?/g;

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
        isMention: false,
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
          isMention: false,
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
          isMention: false,
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
            isMention: false,
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
          isMention: false,
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
        isMention: false,
        index: index++,
      });
    }
  }

  return { tokens, nextIndex: index };
}

/**
 * Special match type for URLs, hashtags, and mentions
 */
interface SpecialMatch {
  text: string;
  start: number;
  end: number;
  type: 'url' | 'hashtag' | 'mention';
  value?: string; // For hashtags, the tag without #; for mentions, the handle without @
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

  // Find mentions
  const mentionRegex = new RegExp(MENTION_REGEX.source, 'g');
  let mentionMatch: RegExpExecArray | null;
  while ((mentionMatch = mentionRegex.exec(text)) !== null) {
    // Don't add if it overlaps with a URL or hashtag
    const overlapsWithOther = specialMatches.some(
      (m) => mentionMatch!.index >= m.start && mentionMatch!.index < m.end
    );
    if (!overlapsWithOther) {
      specialMatches.push({
        text: mentionMatch[0],
        start: mentionMatch.index,
        end: mentionMatch.index + mentionMatch[0].length,
        type: 'mention',
        value: mentionMatch[0].slice(1), // Remove @ prefix
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
        isMention: false,
        index: index++,
      });
    } else if (specialMatch.type === 'hashtag') {
      tokens.push({
        text: specialMatch.text,
        isEnglishWord: false,
        isJapaneseWord: false,
        isEnglishSentence: false,
        isUrl: false,
        isHashtag: true,
        isMention: false,
        hashtagValue: specialMatch.value,
        index: index++,
      });
    } else if (specialMatch.type === 'mention') {
      tokens.push({
        text: specialMatch.text,
        isEnglishWord: false,
        isJapaneseWord: false,
        isEnglishSentence: false,
        isUrl: false,
        isHashtag: false,
        isMention: true,
        mentionHandle: specialMatch.value,
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
function PostCardComponent({
  post,
  onWordSelect,
  onSentenceSelect,
  onPostPress,
  onLikePress,
  clearSelection,
  onLayoutElements
}: PostCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation(['home', 'common']);
  const { colors, isDark } = useTheme();
  const bookIconRef = React.useRef<View>(null);
  const firstWordRef = React.useRef<Text>(null);
  const contentColumnRef = React.useRef<View>(null);
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
   * Measure elements if needed
   */
  useEffect(() => {
    if (onLayoutElements) {
      // Small delay to ensure everything is rendered
      const timer = setTimeout(() => {
        const elements: any = {};

        const measureBookIcon = new Promise<void>((resolve) => {
          if (bookIconRef.current) {
            bookIconRef.current.measureInWindow((x, y, width, height) => {
              if (width > 0 && height > 0) {
                elements.bookIcon = { x, y, width, height };
              }
              resolve();
            });
          } else {
            resolve();
          }
        });

        const measureFirstWord = new Promise<void>((resolve) => {
          if (firstWordRef.current) {
            firstWordRef.current.measureInWindow((x, y, width, height) => {
              if (width > 0 && height > 0) {
                elements.firstWord = { x, y, width, height };
              }
              resolve();
            });
          } else {
            resolve();
          }
        });

        const measureContentColumn = new Promise<void>((resolve) => {
          if (contentColumnRef.current) {
            contentColumnRef.current.measureInWindow((x, y, width, height) => {
              if (width > 0 && height > 0) {
                elements.contentColumn = { x, y, width, height };
              }
              resolve();
            });
          } else {
            resolve();
          }
        });

        Promise.all([measureBookIcon, measureFirstWord, measureContentColumn]).then(() => {
          if (Object.keys(elements).length > 0) {
            onLayoutElements(elements);
          }
        });
      }, 1000); // Wait for animations and data loading

      return () => clearTimeout(timer);
    }
  }, [onLayoutElements]);

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
    if (__DEV__) {
      console.log('handleHashtagPress called with tag:', tag);
      console.log('Opening URL:', searchUrl);
    }
    Linking.openURL(searchUrl).catch((err) => {
      if (__DEV__) {
        console.error('Failed to open hashtag search:', err);
      }
    });
  }, []);

  /**
   * Handle mention press - open Bluesky profile
   */
  const handleMentionPress = useCallback((handle: string) => {
    const profileUrl = `https://bsky.app/profile/${encodeURIComponent(handle)}`;
    if (__DEV__) {
      console.log('handleMentionPress called with handle:', handle);
      console.log('Opening URL:', profileUrl);
    }
    Linking.openURL(profileUrl).catch((err) => {
      if (__DEV__) {
        console.error('Failed to open profile:', err);
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
  const tokens = useMemo(() => {
    const result = parseTextIntoTokens(post.text);
    if (__DEV__) {
      const mentionTokens = result.filter(t => t.isMention);
      const hashtagTokens = result.filter(t => t.isHashtag);
      if (mentionTokens.length > 0 || hashtagTokens.length > 0) {
        console.log('Parsed tokens - mentions:', mentionTokens.map(t => ({ text: t.text, handle: t.mentionHandle })));
        console.log('Parsed tokens - hashtags:', hashtagTokens.map(t => ({ text: t.text, value: t.hashtagValue })));
      }
    }
    return result;
  }, [post.text]);

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
                style={[styles.urlText, { color: colors.primary }]}
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
                style={[styles.hashtagText, { color: colors.primary }]}
                onPress={() => handleHashtagPress(token.hashtagValue!)}
                suppressHighlighting={false}
              >
                {token.text}
              </Text>
            );
          }

          // Mention tokens - make them tappable links to profile
          if (token.isMention && token.mentionHandle) {
            return (
              <Text
                key={token.index}
                style={[styles.mentionText, { color: colors.primary }]}
                onPress={() => handleMentionPress(token.mentionHandle!)}
                suppressHighlighting={false}
              >
                {token.text}
              </Text>
            );
          }

          // Identify the first meaningful word for tutorial focus
          const isFirstMeaningfulWord = token.isEnglishWord && !tokens.slice(0, tokens.indexOf(token)).some(t => t.isEnglishWord || t.isJapaneseWord);

          if (token.isEnglishWord) {
            const isWordSelected = selectedWord?.toLowerCase() === token.text.toLowerCase();
            const sentence = getSentenceContainingWord(token.text);
            const isSentenceSelected = selectedSentence && sentence === selectedSentence;

            return (
              <Text
                key={token.index}
                style={[
                  isWordSelected
                    ? [styles.highlightedWord, { backgroundColor: colors.primary, color: '#FFF' }]
                    : isSentenceSelected
                      ? [styles.highlightedSentence, { backgroundColor: colors.primaryLight + '40' }]
                      : [styles.selectableWord, { color: colors.text }]
                ]}
                ref={isFirstMeaningfulWord ? firstWordRef : undefined}
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
                style={[
                  isWordSelected
                    ? [styles.highlightedWord, { backgroundColor: colors.primary, color: '#FFF' }]
                    : isSentenceSelected
                      ? [styles.highlightedSentence, { backgroundColor: colors.primaryLight + '40' }]
                      : [styles.selectableJapanese, { color: colors.text }]
                ]}
                onPress={() => handleWordPress(token.text)}
                onLongPress={() => handleWordLongPress(token.text)}
                suppressHighlighting={false}
              >
                {token.text}
              </Text>
            );
          }

          return <Text key={token.index} style={{ color: colors.text }}>{token.text}</Text>;
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
            <View style={[styles.altBadge, { backgroundColor: colors.overlay }]}>
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
                <View style={[styles.altBadge, { backgroundColor: colors.overlay }]}>
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
              <View style={[styles.altBadge, { backgroundColor: colors.overlay }]}>
                <Text style={styles.altBadgeText}>ALT</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    );
  };

  /**
   * Render external link embed (link card)
   */
  const renderExternalEmbed = () => {
    const external = post.embed?.external;
    if (!external?.uri) return null;

    return (
      <Pressable
        style={[styles.externalEmbedContainer, { borderColor: colors.border, backgroundColor: isDark ? colors.backgroundSecondary : '#FFF' }]}
        onPress={() => handleUrlPress(external.uri)}
        accessible={true}
        accessibilityLabel={`リンク: ${external.title || external.uri}`}
        accessibilityRole="link"
      >
        {external.thumb && (
          <Image
            source={{ uri: external.thumb }}
            style={styles.externalEmbedThumb}
            resizeMode="cover"
          />
        )}
        <View style={styles.externalEmbedContent}>
          <View style={styles.externalEmbedHeader}>
            <ExternalLink size={14} color={colors.textTertiary} />
            <Text style={[styles.externalEmbedDomain, { color: colors.textSecondary }]} numberOfLines={1}>
              {new URL(external.uri).hostname.replace(/^www\./, '')}
            </Text>
          </View>
          {external.title ? (
            <Text style={[styles.externalEmbedTitle, { color: colors.text }]} numberOfLines={2}>
              {external.title}
            </Text>
          ) : null}
          {external.description ? (
            <Text style={[styles.externalEmbedDescription, { color: colors.textSecondary }]} numberOfLines={2}>
              {external.description}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <Pressable
      style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
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
        <View style={styles.contentColumn} ref={contentColumnRef}>
          {/* Author row */}
          <View style={styles.authorRow}>
            <View style={styles.authorInfo}>
              <Text style={[styles.displayName, { color: colors.text }]} numberOfLines={1}>
                {post.author.displayName}
              </Text>
              <Text style={[styles.handle, { color: colors.textSecondary }]} numberOfLines={1}>
                @{post.author.handle}
              </Text>
            </View>
            <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
              {formatRelativeTime(post.createdAt, t, i18n.language)}
            </Text>
          </View>

          {/* Post content */}
          <View style={styles.content}>
            {renderText()}
          </View>

          {/* Embedded images */}
          {renderImages()}

          {/* External link embed */}
          {renderExternalEmbed()}

          {/* Engagement metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              {post.replyRestriction === 'disabled' ? (
                <MessageCircleOff size={16} color={colors.textSecondary} />
              ) : post.replyRestriction === 'restricted' ? (
                <MessageCircleDashed size={16} color={colors.textSecondary} />
              ) : (
                <MessageCircle size={16} color={colors.textSecondary} />
              )}
              <Text style={[styles.metricText, { color: colors.textSecondary }]}>{post.replyCount ?? 0}</Text>
            </View>
            <View style={styles.metric}>
              <Repeat2 size={16} color={colors.textSecondary} />
              <Text style={[styles.metricText, { color: colors.textSecondary }]}>{post.repostCount ?? 0}</Text>
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
                color={isLiked ? colors.error : colors.textSecondary}
                fill={isLiked ? colors.error : 'none'}
              />
              <Text style={[styles.metricText, { color: colors.textSecondary }, isLiked && { color: colors.error }]}>
                {likeCount}
              </Text>
            </Pressable>
            {onSentenceSelect && (
              <Pressable
                style={styles.bookSearchButton}
                onPress={handleBookSearchPress}
                ref={bookIconRef}
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
  mentionText: {
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
  // External embed styles (link card)
  externalEmbedContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundSecondary,
  },
  externalEmbedThumb: {
    width: '100%',
    height: 120,
  },
  externalEmbedContent: {
    padding: Spacing.md,
  },
  externalEmbedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  externalEmbedDomain: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    flex: 1,
  },
  externalEmbedTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  externalEmbedDescription: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});

/**
 * PostCard with React.memo for performance optimization
 * Only re-renders when props change
 */
export const PostCard = React.memo(PostCardComponent);

export default PostCard;
