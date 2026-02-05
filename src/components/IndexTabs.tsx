/**
 * IndexTabs Component
 * File index-style tab navigation for the home screen
 */

import React, { memo, useCallback, useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { Spacing, FontSizes, BorderRadius } from '../constants/colors';

export type TabType = 'following' | 'profile';

interface IndexTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  avatarUri?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Spring config for smooth animations
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

/**
 * Individual animated tab component
 */
interface AnimatedTabProps {
  isActive: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  style?: any;
}

const AnimatedTab = memo(function AnimatedTab({
  isActive,
  onPress,
  accessibilityLabel,
  children,
  style,
}: AnimatedTabProps) {
  // Animation values
  const scale = useSharedValue(1);
  const activeProgress = useSharedValue(isActive ? 1 : 0);

  // Update active progress when isActive changes
  useEffect(() => {
    activeProgress.value = withSpring(isActive ? 1 : 0, SPRING_CONFIG);
  }, [isActive, activeProgress]);

  // Press animation handlers
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, SPRING_CONFIG);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => {
    const height = interpolate(
      activeProgress.value,
      [0, 1],
      [TAB_HEIGHT, TAB_HEIGHT_ACTIVE]
    );

    return {
      transform: [{ scale: scale.value }],
      height,
      marginBottom: interpolate(activeProgress.value, [0, 1], [0, -1]),
    };
  });

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </AnimatedPressable>
  );
});

/**
 * IndexTabs - File index-style tab component with animations
 */
export const IndexTabs = memo(function IndexTabs({
  activeTab,
  onTabChange,
  avatarUri,
}: IndexTabsProps): React.JSX.Element {
  const { t } = useTranslation('home');
  const { colors } = useTheme();

  const isFollowingActive = activeTab === 'following';
  const isProfileActive = activeTab === 'profile';

  // Avatar size animation
  const avatarScale = useSharedValue(isProfileActive ? 1 : 0);

  useEffect(() => {
    avatarScale.value = withSpring(isProfileActive ? 1 : 0, SPRING_CONFIG);
  }, [isProfileActive, avatarScale]);

  const avatarAnimatedStyle = useAnimatedStyle(() => {
    const size = interpolate(
      avatarScale.value,
      [0, 1],
      [AVATAR_SIZE, AVATAR_SIZE_ACTIVE]
    );

    return {
      width: size,
      height: size,
      borderRadius: size / 2,
    };
  });

  const profileTabAnimatedStyle = useAnimatedStyle(() => {
    const width = interpolate(
      avatarScale.value,
      [0, 1],
      [TAB_HEIGHT + Spacing.sm * 2, TAB_HEIGHT_ACTIVE + Spacing.sm * 2]
    );

    return {
      width,
    };
  });

  return (
    <View style={styles.container}>
      {/* Tab row */}
      <View style={styles.tabRow}>
        {/* Following tab */}
        <AnimatedTab
          isActive={isFollowingActive}
          onPress={() => onTabChange('following')}
          accessibilityLabel={t('tabs.following')}
          style={[
            styles.tab,
            styles.followingTab,
            {
              backgroundColor: isFollowingActive
                ? colors.indexTabActive
                : colors.indexTabInactive,
              borderColor: colors.indexTabBorder,
              zIndex: isFollowingActive ? 2 : 1,
            },
          ]}
        >
          <Animated.Text
            style={[
              styles.tabText,
              {
                color: isFollowingActive
                  ? colors.indexTabTextActive
                  : colors.indexTabText,
              },
              isFollowingActive && styles.activeTabText,
            ]}
          >
            {t('tabs.following')}
          </Animated.Text>
        </AnimatedTab>

        {/* Profile tab (avatar) */}
        <AnimatedTab
          isActive={isProfileActive}
          onPress={() => onTabChange('profile')}
          accessibilityLabel={t('tabs.profile')}
          style={[
            styles.tab,
            styles.profileTab,
            profileTabAnimatedStyle,
            {
              backgroundColor: isProfileActive
                ? colors.indexTabActive
                : colors.indexTabInactive,
              borderColor: colors.indexTabBorder,
              zIndex: isProfileActive ? 2 : 1,
            },
          ]}
        >
          {avatarUri ? (
            <Animated.Image
              source={{ uri: avatarUri }}
              style={[
                styles.avatar,
                avatarAnimatedStyle,
                {
                  borderColor: isProfileActive
                    ? colors.indexTabTextActive
                    : colors.indexTabText,
                },
              ]}
            />
          ) : (
            <Animated.View
              style={[
                styles.avatarPlaceholder,
                avatarAnimatedStyle,
                {
                  backgroundColor: isProfileActive
                    ? colors.indexTabTextActive
                    : colors.indexTabText,
                },
              ]}
            />
          )}
        </AnimatedTab>
      </View>
    </View>
  );
});

const TAB_HEIGHT = 36;
const TAB_HEIGHT_ACTIVE = 44;
const AVATAR_SIZE = 24;
const AVATAR_SIZE_ACTIVE = 30;

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  tab: {
    paddingHorizontal: Spacing.lg,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    borderWidth: 1,
    borderBottomWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followingTab: {
    marginRight: Spacing.xs,
  },
  profileTab: {
    paddingHorizontal: Spacing.sm,
  },
  tabText: {
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '600',
  },
  avatar: {
    borderWidth: 2,
  },
  avatarPlaceholder: {
    opacity: 0.5,
  },
});

export default IndexTabs;
