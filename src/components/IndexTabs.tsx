/**
 * IndexTabs Component
 * File index-style tab navigation for the home screen
 */

import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
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
  /** When provided, renders an × button inside the tab that calls this on press. */
  onRemove?: () => void;
  /** If true, subsequent tabs are rendered on a second row below this tab. */
  rowBreak?: boolean;
  /** When true, the tab is tucked under the preceding tab instead of extending to the right. */
  clipAtEdge?: boolean;
  /** When true, half of this tab is tucked under the preceding tab (uses onLayout to measure). */
  halfUnderPrev?: boolean;
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
  onLayout?: (event: LayoutChangeEvent) => void;
}

const AnimatedTab = memo(function AnimatedTab({
  isActive,
  onPress,
  accessibilityLabel,
  children,
  style,
  onLayout,
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
      onLayout={onLayout}
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
  const [tabWidths, setTabWidths] = useState<Record<string, number>>({});

  const handleLayout = useCallback((key: string, event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setTabWidths(prev => (prev[key] === width ? prev : { ...prev, [key]: width }));
  }, []);

  // Split tabs into row 1 (up to and including the rowBreak tab) and row 2 (the rest).
  const rowBreakIdx = tabs.findIndex(t => t.rowBreak);
  const row1 = rowBreakIdx >= 0 ? tabs.slice(0, rowBreakIdx + 1) : tabs;
  const row2 = rowBreakIdx >= 0 ? tabs.slice(rowBreakIdx + 1) : [];

  const renderTabItem = (tab: TabConfig, globalIndex: number, isLastInRow: boolean) => {
    const isActive = tab.key === activeTab;
    const tabTextColor = isActive ? colors.indexTabTextActive : colors.indexTabText;
    // Align this tab's left edge with the preceding tab's left edge.
    // preceding tab has marginRight: -10 (tabWithMargin), so subtract 10 to cancel that offset.
    const precedingWidth = tab.halfUnderPrev
      ? tabWidths[tabs[globalIndex - 1]?.key] ?? 0
      : 0;
    const halfUnderPrevMargin = tab.halfUnderPrev && precedingWidth
      ? { marginLeft: -(precedingWidth - 10) }
      : undefined;

    return (
      <AnimatedTab
        key={tab.key}
        isActive={isActive}
        onPress={() => onTabChange(tab.key)}
        accessibilityLabel={tab.label ?? tab.key}
        onLayout={(e) => handleLayout(tab.key, e)}
        style={[
          styles.tab,
          tab.renderContent ? styles.iconTab : styles.textTab,
          !isLastInRow && styles.tabWithMargin,
          tab.clipAtEdge && { marginLeft: -AVATAR_TAB_CLIP },
          halfUnderPrevMargin,
          {
            backgroundColor: isActive
              ? colors.indexTabActive
              : colors.indexTabInactive,
            borderColor: colors.indexTabBorder,
            zIndex: isActive ? tabs.length + 2 : tabs.length - globalIndex,
          },
        ]}
      >
        {tab.renderContent ? (
          tab.renderContent(isActive)
        ) : tab.onRemove ? (
          <View style={styles.tabWithRemove}>
            <Animated.Text
              style={[
                styles.tabText,
                { color: tabTextColor },
                isActive && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Animated.Text>
            <Pressable
              onPress={tab.onRemove}
              hitSlop={4}
              style={styles.removeButton}
              accessibilityRole="button"
              accessibilityLabel="remove tab"
            >
              <X size={12} color={tabTextColor} />
            </Pressable>
          </View>
        ) : (
          <Animated.Text
            style={[
              styles.tabText,
              { color: tabTextColor },
              isActive && styles.activeTabText,
            ]}
          >
            {tab.label}
          </Animated.Text>
        )}
      </AnimatedTab>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {row1.map((tab, i) => renderTabItem(tab, i, i === row1.length - 1))}
      </View>
      {row2.length > 0 && (
        <View style={styles.tabRow}>
          {row2.map((tab, i) => renderTabItem(tab, row1.length + i, i === row2.length - 1))}
        </View>
      )}
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

// Amount to pull a clipAtEdge tab leftward, tucking it under the preceding tab.
// Derived from actual tab dimensions: (AVATAR_SIZE + padding*2 + border*2) / 2
// iconTab: paddingHorizontal = Spacing.sm (8px each side), borderWidth = 1px each side
const AVATAR_TAB_CLIP = Math.round((AVATAR_SIZE + Spacing.sm * 2 + 2) / 2);

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
    paddingLeft: Spacing.lg,
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
    marginRight: -10,
  },
  tabWithRemove: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeButton: {
    marginLeft: Spacing.xs,
    padding: 2,
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
