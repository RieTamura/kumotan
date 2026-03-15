/**
 * YoutubeSubtitleScreen
 * Displays YouTube subtitles and allows word-level long press to save vocabulary.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react-native';

import { RootStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../hooks/useTheme';
import { useWordRegistration } from '../hooks/useWordRegistration';
import { WordPopup } from '../components/WordPopup';
import { Button } from '../components/common/Button';
import {
  fetchYouTubeSubtitles,
  formatTimestamp,
  SubtitleEntry,
} from '../services/youtube/subtitles';
import { Colors, Spacing, FontSizes, BorderRadius } from '../constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'YoutubeSubtitle'>;

/**
 * Split subtitle text into individual word tokens, preserving punctuation with words
 */
function tokenizeSubtitle(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/**
 * Single subtitle row with tappable words
 */
interface SubtitleRowProps {
  entry: SubtitleEntry;
  onWordLongPress: (word: string, fullText: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const SubtitleRow = React.memo(function SubtitleRow({
  entry,
  onWordLongPress,
  colors,
}: SubtitleRowProps) {
  const words = tokenizeSubtitle(entry.text);

  return (
    <View style={styles.entryRow}>
      <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
        {formatTimestamp(entry.startMs)}
      </Text>
      <View style={styles.wordsContainer}>
        {words.map((word, index) => (
          <Pressable
            key={index}
            onLongPress={() => onWordLongPress(word, entry.text)}
            delayLongPress={300}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
          >
            <Text style={[styles.word, { color: colors.text }]}>
              {word}
              {index < words.length - 1 ? ' ' : ''}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

/**
 * YoutubeSubtitleScreen component
 */
export function YoutubeSubtitleScreen({ route }: Props): React.JSX.Element {
  const { videoId, videoTitle, videoThumb, videoUrl } = route.params;
  const { t } = useTranslation('youtube');
  const { colors } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<SubtitleEntry[]>([]);

  const { wordPopup, handleWordSelect, handlePhraseSelect, closeWordPopup } =
    useWordRegistration();

  /**
   * Fetch subtitles on mount
   */
  useEffect(() => {
    loadSubtitles();
  }, [videoId]);

  const loadSubtitles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await fetchYouTubeSubtitles(videoId);

    if (result.success) {
      setEntries(result.data.entries);
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }, [videoId]);

  /**
   * Handle long press on a word — strip surrounding punctuation before saving
   */
  const handleWordLongPress = useCallback(
    (word: string, fullText: string) => {
      const cleaned = word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      if (!cleaned) return;
      handleWordSelect(cleaned, videoUrl, fullText);
    },
    [videoUrl, handleWordSelect]
  );

  /**
   * Handle long press on full subtitle line — save as phrase
   */
  const handleLineLongPress = useCallback(
    (fullText: string) => {
      handlePhraseSelect(fullText, videoUrl, fullText);
    },
    [videoUrl, handlePhraseSelect]
  );

  const handleOpenInYouTube = useCallback(() => {
    Linking.openURL(videoUrl).catch(() => {});
  }, [videoUrl]);

  const renderEntry = useCallback(
    ({ item }: { item: SubtitleEntry }) => (
      <Pressable onLongPress={() => handleLineLongPress(item.text)}>
        <SubtitleRow
          entry={item}
          onWordLongPress={handleWordLongPress}
          colors={colors}
        />
      </Pressable>
    ),
    [handleWordLongPress, handleLineLongPress, colors]
  );

  const keyExtractor = useCallback(
    (_: SubtitleEntry, index: number) => String(index),
    []
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      {/* Video info header */}
      {videoThumb ? (
        <View style={styles.videoHeader}>
          <Image
            source={{ uri: videoThumb }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
          <View
            style={[
              styles.videoMeta,
              { backgroundColor: colors.backgroundSecondary },
            ]}
          >
            <Text
              style={[styles.videoTitle, { color: colors.text }]}
              numberOfLines={2}
            >
              {videoTitle}
            </Text>
            <Pressable
              style={styles.openButton}
              onPress={handleOpenInYouTube}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ExternalLink size={14} color={colors.primary} />
              <Text style={[styles.openButtonText, { color: colors.primary }]}>
                {t('openInYouTube')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {t('loading')}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            {t('noSubtitles')}
          </Text>
          <Text
            style={[styles.statusText, { color: colors.textSecondary }]}
          >
            {t('noSubtitlesHint')}
          </Text>
          <Button
            title={t('retry')}
            onPress={loadSubtitles}
            variant="outline"
            style={styles.retryButton}
          />
        </View>
      ) : (
        <>
          <View
            style={[
              styles.hintBar,
              { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.hintText, { color: colors.textSecondary }]}>
              {t('wordSaveHint')} · {t('subtitleCount', { count: entries.length })}
            </Text>
          </View>
          <FlatList
            data={entries}
            renderItem={renderEntry}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => (
              <View
                style={[styles.separator, { backgroundColor: colors.border }]}
              />
            )}
          />
        </>
      )}

      {/* WordPopup */}
      <WordPopup
        visible={wordPopup.visible}
        word={wordPopup.word}
        wordType={wordPopup.wordType}
        postUri={wordPopup.postUri}
        postText={wordPopup.postText}
        onClose={closeWordPopup}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  videoHeader: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  thumbnail: {
    width: '100%',
    height: 180,
  },
  videoMeta: {
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  videoTitle: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  errorTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusText: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: Spacing.sm,
    minWidth: 120,
  },
  hintBar: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  hintText: {
    fontSize: FontSizes.sm,
  },
  listContent: {
    paddingVertical: Spacing.xs,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  timestamp: {
    fontSize: FontSizes.xs,
    fontVariant: ['tabular-nums'],
    marginTop: 3,
    minWidth: 36,
  },
  wordsContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  word: {
    fontSize: FontSizes.md,
    lineHeight: 24,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.md + 36 + Spacing.sm,
  },
});

export default YoutubeSubtitleScreen;
