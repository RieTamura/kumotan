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
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useTheme } from '../hooks/useTheme';

/**
 * OfflineBanner Props
 */
interface OfflineBannerProps {
  /**
   * Custom message to display (uses translation if not provided)
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
  message,
  showRetry = false,
  onRetry,
  animated = true,
}: OfflineBannerProps): React.ReactElement | null {
  const { t } = useTranslation('common');
  const isConnected = useNetworkStatus();
  const { colors } = useTheme();
  const [slideAnim] = React.useState(new Animated.Value(-50));
  const displayMessage = message ?? t('status.offline');

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
          <OfflineIcon color={colors.offlineText} />
          <Text style={[styles.message, { color: colors.offlineText }]}>{displayMessage}</Text>
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
        <OfflineIcon color={colors.offlineText} />
        <Text style={[styles.message, { color: colors.offlineText }]}>{displayMessage}</Text>
        {showRetry && onRetry && (
          <Pressable
            onPress={onRetry}
            style={styles.retryButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.retryText, { color: colors.offlineText }]}>{t('buttons.retry')}</Text>
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
  message,
  showRetry = false,
  onRetry,
}: {
  visible: boolean;
  message?: string;
  showRetry?: boolean;
  onRetry?: () => void;
}): React.ReactElement | null {
  const { t } = useTranslation('common');
  const { colors } = useTheme();
  const displayMessage = message ?? t('status.offline');

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.offline }]}>
      <View style={styles.content}>
        <OfflineIcon color={colors.offlineText} />
        <Text style={[styles.message, { color: colors.offlineText }]}>{displayMessage}</Text>
        {showRetry && onRetry && (
          <Pressable
            onPress={onRetry}
            style={styles.retryButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.retryText}>{t('buttons.retry')}</Text>
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
function OfflineIcon({ color }: { color: string }): React.ReactElement {
  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.icon, { color }]}>☁</Text>
      <View style={[styles.iconSlash, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8, // Spacing.sm
    paddingHorizontal: 12, // Spacing.md
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
    marginRight: 8, // Spacing.sm
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 16,
  },
  iconSlash: {
    position: 'absolute',
    width: 20,
    height: 2,
    transform: [{ rotate: '45deg' }],
  },
  message: {
    fontSize: 12, // FontSizes.sm
    fontWeight: '600',
  },
  retryButton: {
    marginLeft: 12, // Spacing.md
    paddingVertical: 4, // Spacing.xs
    paddingHorizontal: 8, // Spacing.sm
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  retryText: {
    fontSize: 12, // FontSizes.sm
    fontWeight: '600',
  },
});

export default OfflineBanner;
