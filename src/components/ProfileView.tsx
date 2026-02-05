/**
 * ProfileView Component
 * Displays the logged-in user's Bluesky profile
 */

import React, { memo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore, useAuthProfile, useIsProfileLoading } from '../store/authStore';
import { Loading } from './common/Loading';
import { Spacing, FontSizes, BorderRadius } from '../constants/colors';

/**
 * ProfileView - Displays user profile information
 */
export const ProfileView = memo(function ProfileView(): React.JSX.Element {
  const { t } = useTranslation('home');
  const { colors } = useTheme();
  const profile = useAuthProfile();
  const isLoading = useIsProfileLoading();
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);

  // Fetch profile on mount if not loaded
  useEffect(() => {
    if (!profile && !isLoading) {
      fetchProfile();
    }
  }, [profile, isLoading, fetchProfile]);

  if (isLoading && !profile) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Loading size="large" message={t('profile.loading')} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('profile.notFound')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refreshProfile}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Banner area */}
      <View style={[styles.bannerArea, { backgroundColor: colors.backgroundSecondary }]}>
        {profile.banner && (
          <Image
            source={{ uri: profile.banner }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        )}
      </View>

      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {profile.avatar ? (
          <Image
            source={{ uri: profile.avatar }}
            style={[styles.avatar, { borderColor: colors.background }]}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarPlaceholder,
              { borderColor: colors.background, backgroundColor: colors.backgroundTertiary },
            ]}
          />
        )}
      </View>

      {/* Profile info */}
      <View style={styles.infoContainer}>
        {/* Display name */}
        <Text style={[styles.displayName, { color: colors.text }]}>
          {profile.displayName || profile.handle}
        </Text>

        {/* Handle */}
        <Text style={[styles.handle, { color: colors.textSecondary }]}>
          @{profile.handle}
        </Text>

        {/* Description */}
        {profile.description && (
          <Text style={[styles.description, { color: colors.text }]}>
            {profile.description}
          </Text>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {formatNumber(profile.followsCount ?? 0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t('profile.following')}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {formatNumber(profile.followersCount ?? 0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t('profile.followers')}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {formatNumber(profile.postsCount ?? 0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t('profile.posts')}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
});

/**
 * Format large numbers with K/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

const AVATAR_SIZE = 80;
const BANNER_HEIGHT = 120;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: Spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSizes.md,
    textAlign: 'center',
  },
  bannerArea: {
    height: BANNER_HEIGHT,
    width: '100%',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  avatarContainer: {
    marginTop: -AVATAR_SIZE / 2,
    paddingHorizontal: Spacing.lg,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  displayName: {
    fontSize: FontSizes.xxl,
    fontWeight: '700',
  },
  handle: {
    fontSize: FontSizes.md,
    marginTop: Spacing.xs,
  },
  description: {
    fontSize: FontSizes.md,
    lineHeight: 22,
    marginTop: Spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.xl,
  },
  statItem: {
    alignItems: 'flex-start',
  },
  statNumber: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
});

export default ProfileView;
