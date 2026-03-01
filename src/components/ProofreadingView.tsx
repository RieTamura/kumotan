/**
 * ProofreadingView Component
 * Displays text with inline highlighted error segments using nested Text.
 * Tapping an error segment notifies the parent to show a correction panel.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { ProofreadingSuggestion } from '../services/dictionary/yahooJapan';

interface ProofreadingViewProps {
  text: string;
  suggestions: ProofreadingSuggestion[];
  onSegmentTap: (offset: number, length: number, suggestions: string[]) => void;
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
 * ProofreadingView
 * Renders all text as a single nested-Text block, so line-wrapping is handled
 * naturally by React Native's text engine (no View-in-flex-wrap issues).
 * Error words are highlighted inline; tapping one calls onSegmentTap so the
 * parent can display a correction panel.
 */
export function ProofreadingView({
  text,
  suggestions,
  onSegmentTap,
  style,
}: ProofreadingViewProps): React.JSX.Element {
  const { colors } = useTheme();
  const segments = buildSegments(text, suggestions);

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.textWrapper, { color: colors.text }]}>
        {segments.map((seg, i) => {
          if (seg.type === 'normal') {
            return (
              <Text key={`n-${i}`} style={{ color: colors.text }}>
                {seg.text}
              </Text>
            );
          }

          return (
            <Text
              key={`e-${i}`}
              style={[
                styles.errorText,
                { color: colors.error, backgroundColor: colors.errorLight },
              ]}
              onPress={() => onSegmentTap(seg.offset, seg.length, seg.suggestions)}
              accessibilityLabel={`${seg.text}、タップで修正候補を表示`}
            >
              {seg.text}
            </Text>
          );
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  textWrapper: {
    fontSize: 18,
    lineHeight: 28,
  },
  errorText: {
    fontSize: 18,
    lineHeight: 28,
    textDecorationLine: 'underline',
  },
});
