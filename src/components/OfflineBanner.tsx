/**
 * Offline Banner Component
 * Displays a banner at the top of the screen when the device is offline
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native';
import { Colors, Spacing, FontSizes } from '../constants/colors';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/**
 * OfflineBanner Props
 */
interface OfflineBannerProps {
  /**
   * Custom message to display
   * @default 'オフラインです'
   */
  message?: string;

  /**
   * Show a retry button
   * @default false
   */
  showRetry?: boolean;

  /**
   * Callback when retry button is pressed
   */
  onRetry?: () => void;

  /**
   * Whether to animate the banner
   * @default true
   */
  animated?: boolean;
}

/**
 * Offline Banner Component
 * Automatically shows/hides based on network connectivity
 */
export function OfflineBanner({
  message = 'オフラインです',
  showRetry = false,
  onRetry,
  animated = true,
}: OfflineBannerProps): React.ReactElement | null {
  const isConnected = useNetworkStatus();
  const [slideAnim] = React.useState(new Animated.Value(-50));

  React.useEffect(() => {
    if (animated) {
      Animated.timing(slideAnim, {
        toValue: isConnected ? -50 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isConnected, animated, slideAnim]);

  // If connected and not animating, don't render
  if (isConnected && !animated) {
    return null;
  }

  // If connected and animating, still render but animated out
  if (isConnected && animated) {
    return (
      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.content}>
          <OfflineIcon />
          <Text style={styles.message}>{message}</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        animated && { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <OfflineIcon />
        <Text style={styles.message}>{message}</Text>
        {showRetry && onRetry && (
          <Pressable
            onPress={onRetry}
            style={styles.retryButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.retryText}>再試行</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * Static Offline Banner (non-reactive, for manual control)
 */
export function StaticOfflineBanner({
  visible,
  message = 'オフラインです',
  showRetry = false,
  onRetry,
}: {
  visible: boolean;
  message?: string;
  showRetry?: boolean;
  onRetry?: () => void;
}): React.ReactElement | null {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <OfflineIcon />
        <Text style={styles.message}>{message}</Text>
        {showRetry && onRetry && (
          <Pressable
            onPress={onRetry}
            style={styles.retryButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.retryText}>再試行</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Simple cloud-offline icon using Text
 * In a real app, you'd use an icon library like @expo/vector-icons
 */
function OfflineIcon(): React.ReactElement {
  return (
    <View style={styles.iconContainer}>
      <Text style={styles.icon}>☁</Text>
      <View style={styles.iconSlash} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.offline,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 18,
    height: 18,
    marginRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 16,
    color: Colors.offlineText,
  },
  iconSlash: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: Colors.offlineText,
    transform: [{ rotate: '45deg' }],
  },
  message: {
    color: Colors.offlineText,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  retryButton: {
    marginLeft: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  retryText: {
    color: Colors.offlineText,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});

export default OfflineBanner;
