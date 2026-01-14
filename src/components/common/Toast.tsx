/**
 * Toast Notification Component
 * Provides non-intrusive user feedback
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../constants/colors';

const { width } = Dimensions.get('window');
const TOAST_WIDTH = width - Spacing.lg * 2;
const TOAST_HEIGHT = 60;
const ANIMATION_DURATION = 300;

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
  visible: boolean;
}

/**
 * Get color based on toast type
 */
function getToastColor(type: ToastType): string {
  switch (type) {
    case 'success':
      return Colors.success;
    case 'error':
      return Colors.error;
    case 'warning':
      return Colors.warning;
    case 'info':
    default:
      return Colors.primary;
  }
}

/**
 * Get icon based on toast type
 */
function getToastIcon(type: ToastType): string {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'warning':
      return '⚠';
    case 'info':
    default:
      return 'ℹ';
  }
}

/**
 * Toast Component
 * Displays temporary notification messages
 */
export function Toast({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
  visible,
}: ToastProps): React.JSX.Element | null {
  const translateY = useRef(new Animated.Value(-TOAST_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Slide in
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after duration
      timeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);
    } else {
      handleDismiss();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, duration]);

  /**
   * Handle toast dismissal
   */
  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -TOAST_HEIGHT,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible) {
    return null;
  }

  const backgroundColor = getToastColor(type);
  const icon = getToastIcon(type);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.toast, { backgroundColor }]}
        onPress={handleDismiss}
        activeOpacity={0.9}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 9999,
    elevation: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOAST_HEIGHT,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
  },
  iconContainer: {
    width: 24,
    height: 24,
    marginRight: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: FontSizes.xl,
    color: Colors.textInverse,
    fontWeight: '700',
  },
  message: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textInverse,
    fontWeight: '500',
  },
});

export default Toast;
