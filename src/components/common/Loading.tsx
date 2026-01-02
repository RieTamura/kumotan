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
  color = Colors.primary,
  message,
  fullScreen = false,
  style,
}: LoadingProps): React.ReactElement {
  const containerStyle = fullScreen ? styles.fullScreen : styles.container;

  return (
    <View style={[containerStyle, style]}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.message}>{message}</Text>}
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
  return (
    <View style={styles.overlay}>
      <View style={styles.overlayContent}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.overlayMessage}>{message}</Text>
      </View>
    </View>
  );
}

/**
 * Inline loading indicator for buttons or small areas
 */
export function LoadingInline({
  color = Colors.primary,
}: {
  color?: string;
}): React.ReactElement {
  return <ActivityIndicator size="small" color={color} />;
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
