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
              height: isFollowingActive ? TAB_HEIGHT_ACTIVE : TAB_HEIGHT,
              marginBottom: isFollowingActive ? -1 : 0,
            },
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
              height: isProfileActive ? TAB_HEIGHT_ACTIVE : TAB_HEIGHT,
              width: isProfileActive ? TAB_HEIGHT_ACTIVE + Spacing.sm * 2 : TAB_HEIGHT + Spacing.sm * 2,
              marginBottom: isProfileActive ? -1 : 0,
            },
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
                  width: isProfileActive ? AVATAR_SIZE_ACTIVE : AVATAR_SIZE,
                  height: isProfileActive ? AVATAR_SIZE_ACTIVE : AVATAR_SIZE,
                  borderRadius: isProfileActive ? AVATAR_SIZE_ACTIVE / 2 : AVATAR_SIZE / 2,
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
                  width: isProfileActive ? AVATAR_SIZE_ACTIVE : AVATAR_SIZE,
                  height: isProfileActive ? AVATAR_SIZE_ACTIVE : AVATAR_SIZE,
                  borderRadius: isProfileActive ? AVATAR_SIZE_ACTIVE / 2 : AVATAR_SIZE / 2,
                },
              ]}
            />
          )}
        </Pressable>
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
