/**
 * IndexTabs Component
 * File index-style tab navigation for the home screen
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { Spacing, FontSizes, BorderRadius } from '../constants/colors';

export type TabType = 'following' | 'profile';

interface IndexTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  avatarUri?: string;
}

/**
 * IndexTabs - File index-style tab component
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

  return (
    <View style={styles.container}>
      {/* Tab row */}
      <View style={styles.tabRow}>
        {/* Following tab */}
        <Pressable
          onPress={() => onTabChange('following')}
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
            isFollowingActive && styles.activeTab,
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: isFollowingActive }}
          accessibilityLabel={t('tabs.following')}
        >
          <Text
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
          </Text>
        </Pressable>

        {/* Profile tab (avatar) */}
        <Pressable
          onPress={() => onTabChange('profile')}
          style={[
            styles.tab,
            styles.profileTab,
            {
              backgroundColor: isProfileActive
                ? colors.indexTabActive
                : colors.indexTabInactive,
              borderColor: colors.indexTabBorder,
              zIndex: isProfileActive ? 2 : 1,
            },
            isProfileActive && styles.activeTab,
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: isProfileActive }}
          accessibilityLabel={t('tabs.profile')}
        >
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={[
                styles.avatar,
                {
                  borderColor: isProfileActive
                    ? colors.indexTabTextActive
                    : colors.indexTabText,
                },
              ]}
            />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                {
                  backgroundColor: isProfileActive
                    ? colors.indexTabTextActive
                    : colors.indexTabText,
                },
              ]}
            />
          )}
        </Pressable>
      </View>

      {/* Bottom border that connects to content */}
      <View
        style={[
          styles.bottomBorder,
          {
            backgroundColor: colors.indexTabActive,
            borderColor: colors.indexTabBorder,
          },
        ]}
      />
    </View>
  );
});

const TAB_HEIGHT = 40;
const AVATAR_SIZE = 28;

const styles = StyleSheet.create({
  container: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  tab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    borderWidth: 1,
    borderBottomWidth: 0,
    minHeight: TAB_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followingTab: {
    marginRight: -1,
  },
  profileTab: {
    paddingHorizontal: Spacing.md,
  },
  activeTab: {
    marginBottom: -1,
  },
  tabText: {
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '600',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    opacity: 0.5,
  },
  bottomBorder: {
    height: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopWidth: 0,
    marginTop: -1,
  },
});

export default IndexTabs;
