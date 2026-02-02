/**
 * Confetti Component
 * Celebratory confetti animation using react-native-reanimated
 */

import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#FFE66D', // Yellow
  '#95E1D3', // Mint
  '#F38181', // Coral
  '#AA96DA', // Purple
  '#FCBAD3', // Pink
  '#1DA1F2', // Blue
  '#17BF63', // Green
];

interface ConfettiPieceProps {
  index: number;
  startDelay: number;
  onAnimationEnd?: () => void;
  isLast?: boolean;
}

function ConfettiPiece({ index, startDelay, onAnimationEnd, isLast }: ConfettiPieceProps): React.JSX.Element {
  const translateY = useSharedValue(-50);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const color = useMemo(
    () => CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    [index]
  );

  const startX = useMemo(
    () => Math.random() * SCREEN_WIDTH,
    []
  );

  const horizontalDrift = useMemo(
    () => (Math.random() - 0.5) * 150,
    []
  );

  const size = useMemo(
    () => 8 + Math.random() * 8,
    []
  );

  const rotationSpeed = useMemo(
    () => 360 + Math.random() * 720,
    []
  );

  const duration = useMemo(
    () => 2500 + Math.random() * 1500,
    []
  );

  useEffect(() => {
    const handleAnimationEnd = () => {
      if (isLast && onAnimationEnd) {
        onAnimationEnd();
      }
    };

    translateY.value = withDelay(
      startDelay,
      withTiming(SCREEN_HEIGHT + 100, {
        duration,
        easing: Easing.out(Easing.quad),
      }, (finished) => {
        if (finished) {
          runOnJS(handleAnimationEnd)();
        }
      })
    );

    translateX.value = withDelay(
      startDelay,
      withTiming(horizontalDrift, {
        duration,
        easing: Easing.inOut(Easing.sin),
      })
    );

    rotate.value = withDelay(
      startDelay,
      withTiming(rotationSpeed, {
        duration,
        easing: Easing.linear,
      })
    );

    opacity.value = withDelay(
      startDelay + duration * 0.7,
      withTiming(0, {
        duration: duration * 0.3,
        easing: Easing.out(Easing.quad),
      })
    );

    scale.value = withDelay(
      startDelay,
      withTiming(0.5, {
        duration,
        easing: Easing.out(Easing.quad),
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const isRound = index % 3 === 0;

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        animatedStyle,
        {
          left: startX,
          width: isRound ? size : size * 0.6,
          height: isRound ? size : size * 1.5,
          backgroundColor: color,
          borderRadius: isRound ? size / 2 : 2,
        },
      ]}
    />
  );
}

interface ConfettiProps {
  count?: number;
  onAnimationEnd?: () => void;
}

export function Confetti({ count = 50, onAnimationEnd }: ConfettiProps): React.JSX.Element {
  const pieces = useMemo(() => {
    return Array.from({ length: count }, (_, index) => ({
      index,
      startDelay: Math.random() * 500,
    }));
  }, [count]);

  return (
    <View style={styles.container} pointerEvents="none">
      {pieces.map((piece, idx) => (
        <ConfettiPiece
          key={piece.index}
          index={piece.index}
          startDelay={piece.startDelay}
          isLast={idx === pieces.length - 1}
          onAnimationEnd={onAnimationEnd}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
  },
});

export default Confetti;
