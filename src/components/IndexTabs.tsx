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
import { useTheme } from '../hooks/useTheme';
import { Spacing, FontSizes, BorderRadius } from '../constants/colors';

/**
 * Configuration for a single tab.
 * - Text tabs: provide `label`
 * - Icon tabs (e.g. avatar): provide `renderContent`
 */
export interface TabConfig {
  key: string;
  label?: string;
  renderContent?: (isActive: boolean) => React.ReactNode;
}

interface IndexTabsProps {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Spring config for smooth animations
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

const TAB_HEIGHT = 36;
const TAB_HEIGHT_ACTIVE = 44;

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
  const scale = useSharedValue(1);
  const activeProgress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    activeProgress.value = withSpring(isActive ? 1 : 0, SPRING_CONFIG);
  }, [isActive, activeProgress]);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, SPRING_CONFIG);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

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
 * IndexTabs - File index-style tab component with animations.
 * Accepts a dynamic list of tabs via TabConfig[].
 */
export const IndexTabs = memo(function IndexTabs({
  tabs,
  activeTab,
  onTabChange,
}: IndexTabsProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {tabs.map((tab, index) => {
          const isActive = tab.key === activeTab;
          const isLast = index === tabs.length - 1;

          return (
            <AnimatedTab
              key={tab.key}
              isActive={isActive}
              onPress={() => onTabChange(tab.key)}
              accessibilityLabel={tab.label ?? tab.key}
              style={[
                styles.tab,
                tab.renderContent ? styles.iconTab : styles.textTab,
                !isLast && styles.tabWithMargin,
                {
                  backgroundColor: isActive
                    ? colors.indexTabActive
                    : colors.indexTabInactive,
                  borderColor: colors.indexTabBorder,
                  zIndex: isActive ? 2 : 1,
                },
              ]}
            >
              {tab.renderContent ? (
                tab.renderContent(isActive)
              ) : (
                <Animated.Text
                  style={[
                    styles.tabText,
                    {
                      color: isActive
                        ? colors.indexTabTextActive
                        : colors.indexTabText,
                    },
                    isActive && styles.activeTabText,
                  ]}
                >
                  {tab.label}
                </Animated.Text>
              )}
            </AnimatedTab>
          );
        })}
      </View>
    </View>
  );
});

/**
 * AvatarTabIcon - Animated avatar for the profile tab.
 * Pass as `renderContent` in TabConfig.
 *
 * @example
 * { key: 'profile', renderContent: (isActive) => (
 *   <AvatarTabIcon isActive={isActive} uri={profile?.avatar}
 *     activeColor={colors.indexTabTextActive}
 *     inactiveColor={colors.indexTabText} />
 * )}
 */
const AVATAR_SIZE = 24;
const AVATAR_SIZE_ACTIVE = 30;

export interface AvatarTabIconProps {
  isActive: boolean;
  uri?: string;
  activeColor: string;
  inactiveColor: string;
}

export const AvatarTabIcon = memo(function AvatarTabIcon({
  isActive,
  uri,
  activeColor,
  inactiveColor,
}: AvatarTabIconProps): React.JSX.Element {
  const avatarScale = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    avatarScale.value = withSpring(isActive ? 1 : 0, SPRING_CONFIG);
  }, [isActive, avatarScale]);

  const animatedStyle = useAnimatedStyle(() => {
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

  if (uri) {
    return (
      <Animated.Image
        source={{ uri }}
        style={[
          styles.avatar,
          animatedStyle,
          { borderColor: isActive ? activeColor : inactiveColor },
        ]}
      />
    );
  }

  return (
    <Animated.View
      style={[
        styles.avatarPlaceholder,
        animatedStyle,
        { backgroundColor: isActive ? activeColor : inactiveColor },
      ]}
    />
  );
});

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
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    borderWidth: 1,
    borderBottomWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textTab: {
    paddingHorizontal: Spacing.lg,
  },
  iconTab: {
    paddingHorizontal: Spacing.sm,
  },
  tabWithMargin: {
    marginRight: Spacing.xs,
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
