/**
 * SwipeableWordCard Component
 * Displays a word card with swipe-to-remove functionality
 */

import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../../constants/colors';
import { SwipeableWordCardProps } from '../types';

export function SwipeableWordCard({ wordInfo, onRemove }: SwipeableWordCardProps): React.JSX.Element {
  const swipeableRef = useRef<Swipeable>(null);

  // Right swipe action background (delete)
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const opacity = dragX.interpolate({
      inputRange: [-100, -50, 0],
      outputRange: [1, 0.8, 0],
      extrapolate: 'clamp',
    });

    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.8],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.deleteBackground, { opacity }]}>
        <Animated.Text style={[styles.deleteBackgroundText, { transform: [{ scale }] }]}>
          除外
        </Animated.Text>
      </Animated.View>
    );
  };

  const handleSwipeOpen = () => {
    // Remove card when swipe completes
    onRemove();
  };

  // Registered words cannot be swiped
  if (wordInfo.isRegistered) {
    return (
      <View style={[styles.wordItemCard, styles.wordItemCardRegistered]}>
        <View style={styles.wordCardHeader}>
          <Text style={styles.wordCardWord}>{wordInfo.word}</Text>
          <View style={styles.registeredBadge}>
            <Text style={styles.registeredBadgeText}>登録済み</Text>
          </View>
        </View>

        {wordInfo.japanese && (
          <View style={styles.wordCardRow}>
            <Text style={styles.wordCardLabel}>日本語訳:</Text>
            <Text style={styles.wordCardJapanese}>{wordInfo.japanese}</Text>
          </View>
        )}

        {wordInfo.definition && (
          <View style={styles.wordCardRow}>
            <Text style={styles.wordCardLabel}>定義:</Text>
            <Text style={styles.wordCardDefinition} numberOfLines={3}>
              {wordInfo.definition}
            </Text>
          </View>
        )}

        <Text style={styles.wordItemHint}>この単語は既に登録されています</Text>
      </View>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
      rightThreshold={80}
      overshootRight={false}
      containerStyle={styles.swipeableContainer}
    >
      <View style={styles.wordItemCard}>
        {/* Word */}
        <View style={styles.wordCardHeader}>
          <Text style={styles.wordCardWord}>{wordInfo.word}</Text>
        </View>

        {/* Japanese translation */}
        {wordInfo.japanese && (
          <View style={styles.wordCardRow}>
            <Text style={styles.wordCardLabel}>日本語訳:</Text>
            <Text style={styles.wordCardJapanese}>{wordInfo.japanese}</Text>
          </View>
        )}

        {/* Definition */}
        {wordInfo.definition && (
          <View style={styles.wordCardRow}>
            <Text style={styles.wordCardLabel}>定義:</Text>
            <Text style={styles.wordCardDefinition} numberOfLines={3}>
              {wordInfo.definition}
            </Text>
          </View>
        )}

        {/* Swipe hint */}
        <Text style={styles.swipeHint}>← スワイプで除外</Text>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  swipeableContainer: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  deleteBackground: {
    flex: 1,
    backgroundColor: '#FF5252',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  deleteBackgroundText: {
    color: '#FFFFFF',
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  wordItemCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wordItemCardRegistered: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  wordCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  wordCardWord: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  wordCardRow: {
    marginBottom: Spacing.xs,
  },
  wordCardLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  wordCardJapanese: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  wordCardDefinition: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  swipeHint: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  registeredBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  registeredBadgeText: {
    fontSize: FontSizes.xs,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  wordItemHint: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },
});
