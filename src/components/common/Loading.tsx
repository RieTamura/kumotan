/**
 * Loading Component
 * Reusable loading indicator with optional message
 */

import React from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Colors, FontSizes, Spacing } from '../../constants/colors';
import { useTheme } from '../../hooks/useTheme';

/**
 * Loading component props
 */
interface LoadingProps {
  /**
   * Size of the activity indicator
   * @default 'large'
   */
  size?: 'small' | 'large';

  /**
   * Color of the activity indicator
   * @default Colors.primary
   */
  color?: string;

  /**
   * Optional message to display below the indicator
   */
  message?: string;

  /**
   * Whether to show as full screen overlay
   * @default false
   */
  fullScreen?: boolean;

  /**
   * Additional container style
   */
  style?: ViewStyle;
}

/**
 * Loading Component
 * Displays a loading indicator with optional message
 */
export function Loading({
  size = 'large',
  color,
  message,
  fullScreen = false,
  style,
}: LoadingProps): React.ReactElement {
  const { colors } = useTheme();
  const indicatorColor = color || colors.primary;
  const containerStyle = fullScreen ? styles.fullScreen : styles.container;

  return (
    <View style={[containerStyle, { backgroundColor: fullScreen ? colors.background : 'transparent' }, style]}>
      <ActivityIndicator size={size} color={indicatorColor} />
      {message && <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>}
    </View>
  );
}

/**
 * Full screen loading overlay
 */
export function LoadingOverlay({
  message = '読み込み中...',
}: {
  message?: string;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View style={styles.overlay}>
      <View style={[styles.overlayContent, { backgroundColor: colors.card }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.overlayMessage, { color: colors.text }]}>{message}</Text>
      </View>
    </View>
  );
}

/**
 * Inline loading indicator for buttons or small areas
 */
export function LoadingInline({
  color,
}: {
  color?: string;
}): React.ReactElement {
  const { colors } = useTheme();
  return <ActivityIndicator size="small" color={color || colors.primary} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  message: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlayContent: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  overlayMessage: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    textAlign: 'center',
  },
});

export default Loading;
