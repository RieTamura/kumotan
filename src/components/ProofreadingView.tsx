/**
 * ProofreadingView Component
 * Displays text with highlighted error segments and correction candidates below each error.
 * Intended for the post-creation proofreading review flow.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { ProofreadingSuggestion } from '../services/dictionary/yahooJapan';

interface ProofreadingViewProps {
  text: string;
  suggestions: ProofreadingSuggestion[];
  onApplySuggestion: (offset: number, length: number, suggestion: string) => void;
  style?: object;
}

type NormalSegment = { type: 'normal'; text: string };
type ErrorSegment = {
  type: 'error';
  text: string;
  offset: number;
  length: number;
  suggestions: string[];
};
type TextSegment = NormalSegment | ErrorSegment;

/**
 * Split text into normal and error segments based on suggestions.
 */
function buildSegments(text: string, suggestions: ProofreadingSuggestion[]): TextSegment[] {
  if (!suggestions || suggestions.length === 0) {
    return [{ type: 'normal', text }];
  }

  // Sort by offset ascending, skip overlapping / out-of-bounds entries
  const sorted = [...suggestions].sort((a, b) => a.offset - b.offset);
  const segments: TextSegment[] = [];
  let pos = 0;

  for (const sug of sorted) {
    if (sug.offset < pos) continue;
    if (sug.offset + sug.length > text.length) continue;

    if (sug.offset > pos) {
      segments.push({ type: 'normal', text: text.slice(pos, sug.offset) });
    }

    segments.push({
      type: 'error',
      text: text.slice(sug.offset, sug.offset + sug.length),
      offset: sug.offset,
      length: sug.length,
      suggestions: sug.suggestion,
    });

    pos = sug.offset + sug.length;
  }

  if (pos < text.length) {
    segments.push({ type: 'normal', text: text.slice(pos) });
  }

  return segments;
}

/**
 * Render a normal text segment, splitting on newlines to insert
 * line-break elements that work inside a flex-wrap row.
 */
function NormalSegment({
  text,
  segKey,
  textStyle,
}: {
  text: string;
  segKey: string;
  textStyle: object;
}): React.JSX.Element {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, j) => (
        <React.Fragment key={`${segKey}-${j}`}>
          {j > 0 && <View style={styles.lineBreak} />}
          {line.length > 0 && <Text style={textStyle}>{line}</Text>}
        </React.Fragment>
      ))}
    </>
  );
}

/**
 * ProofreadingView
 * Renders text inline with highlighted error words and correction candidates
 * displayed directly below each highlighted segment.
 *
 * Layout note: Uses flexDirection "row" + flexWrap "wrap" on a View container.
 * Normal text segments are <Text> flex items; error segments are <View column>
 * flex items containing the highlighted error text and the correction below it.
 * Text flow at segment boundaries may not be pixel-perfect for long normal
 * segments, but is adequate for the 300-character post review use case.
 */
export function ProofreadingView({
  text,
  suggestions,
  onApplySuggestion,
  style,
}: ProofreadingViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const segments = buildSegments(text, suggestions);

  const normalTextStyle = [styles.normalText, { color: colors.text }];

  return (
    <View style={[styles.container, style]}>
      <View style={styles.textRow}>
        {segments.map((seg, i) => {
          if (seg.type === 'normal') {
            return (
              <NormalSegment
                key={`n-${i}`}
                text={seg.text}
                segKey={`n-${i}`}
                textStyle={normalTextStyle}
              />
            );
          }

          const firstSuggestion = seg.suggestions[0] ?? '';
          return (
            <Pressable
              key={`e-${i}`}
              onPress={() => {
                if (firstSuggestion) {
                  onApplySuggestion(seg.offset, seg.length, firstSuggestion);
                }
              }}
              style={styles.errorSegment}
              accessibilityLabel={`${seg.text}、修正候補: ${firstSuggestion}、タップで適用`}
            >
              <Text
                style={[
                  styles.errorText,
                  { color: colors.error, backgroundColor: colors.errorLight },
                ]}
              >
                {seg.text}
              </Text>
              {firstSuggestion ? (
                <Text style={[styles.correctionText, { color: colors.primary }]}>
                  {firstSuggestion}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  textRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  normalText: {
    fontSize: 16,
    lineHeight: 24,
  },
  // Forces a line break in the flex-wrap row (width 100% occupies the full row)
  lineBreak: {
    width: '100%',
    height: 0,
  },
  errorSegment: {
    alignItems: 'center',
    marginHorizontal: 1,
    marginBottom: 2,
  },
  errorText: {
    fontSize: 16,
    lineHeight: 24,
    borderRadius: 3,
    paddingHorizontal: 2,
    textDecorationLine: 'underline',
  },
  correctionText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    marginTop: 1,
  },
});
