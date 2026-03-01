/**
 * BlueskyNotificationsScreen
 * Displays Bluesky social notifications (likes, reposts, replies, mentions, quotes, follows).
 * Marks notifications as read and resets the app badge on mount.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Heart,
  Repeat2,
  MessageSquare,
  AtSign,
  Quote,
  UserPlus,
} from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { AppBskyNotificationListNotifications } from '@atproto/api';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useNotificationStore } from '../store/notificationStore';
import { useSocialStore } from '../store/socialStore';
import { useAuthUser } from '../store/authStore';
import { getAgent } from '../services/bluesky/auth';
import { followUser, unfollowUser, blockUser, unblockUser } from '../services/bluesky/social';
import { ProfilePreviewModal } from '../components/ProfilePreviewModal';
import { UpdateBanner } from '../components/UpdateBanner';
import { Loading } from '../components/common/Loading';
import { useTheme } from '../hooks/useTheme';
import { Spacing, FontSizes, BorderRadius } from '../constants/colors';
import type { TimelinePost } from '../types/bluesky';

type BlueskyNotification = AppBskyNotificationListNotifications.Notification;

const DEFAULT_AVATAR = 'https://cdn.bsky.app/img/avatar/plain/did:plc:default/avatar@jpeg';

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '1m';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  return `${Math.floor(diffHour / 24)}d`;
}

export function BlueskyNotificationsScreen(): React.JSX.Element {
  const { t } = useTranslation('home');
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthUser();
  const setHasUnread = useNotificationStore((state) => state.setHasUnread);
  const { setFollowing, setBlocking } = useSocialStore();

  const [notifications, setNotifications] = useState<BlueskyNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profilePreview, setProfilePreview] = useState<{
    visible: boolean;
    author: BlueskyNotification['author'] | null;
  }>({ visible: false, author: null });

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await getAgent().app.bsky.notification.listNotifications({ limit: 50 });
      setNotifications(data.notifications);
      setError(null);
    } catch {
      setError(t('notifications.error'));
    }
  }, [t]);

  const markAsRead = useCallback(async () => {
    try {
      await getAgent().app.bsky.notification.updateSeen({ seenAt: new Date().toISOString() });
      setHasUnread(false);
      await Notifications.setBadgeCountAsync(0);
    } catch {
      // ignore
    }
  }, [setHasUnread]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadNotifications(), markAsRead()]);
      setIsLoading(false);
    };
    init();
  }, [loadNotifications, markAsRead]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  }, [loadNotifications]);

  const handleNotificationPress = useCallback(
    (notification: BlueskyNotification) => {
      if (notification.reason === 'follow') {
        setProfilePreview({ visible: true, author: notification.author });
        return;
      }

      let postUri: string | undefined;
      if (notification.reason === 'like' || notification.reason === 'repost') {
        postUri = notification.reasonSubject;
      } else {
        // reply, mention, quote → navigate to the post itself
        postUri = notification.uri;
      }

      if (postUri) {
        navigation.navigate('Thread', { postUri });
      }
    },
    [navigation]
  );

  const handleFollowPress = useCallback(
    async (did: string, shouldFollow: boolean, followUri?: string) => {
      try {
        if (shouldFollow) {
          const result = await followUser(did);
          setFollowing(did, result.uri);
        } else if (followUri) {
          await unfollowUser(followUri);
          setFollowing(did, null);
        }
      } catch {
        // ignore
      }
    },
    [setFollowing]
  );

  const handleBlockPress = useCallback(
    async (did: string, _handle: string, shouldBlock: boolean, blockUri?: string) => {
      try {
        if (shouldBlock) {
          const result = await blockUser(did);
          setBlocking(did, result.uri);
        } else if (blockUri) {
          await unblockUser(blockUri);
          setBlocking(did, null);
        }
      } catch {
        // ignore
      }
    },
    [setBlocking]
  );

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case 'like':
        return <Heart size={14} color="#E0245E" fill="#E0245E" />;
      case 'repost':
        return <Repeat2 size={14} color="#17BF63" />;
      case 'reply':
        return <MessageSquare size={14} color={colors.primary} />;
      case 'mention':
        return <AtSign size={14} color={colors.primary} />;
      case 'quote':
        return <Quote size={14} color={colors.primary} />;
      case 'follow':
        return <UserPlus size={14} color="#9B59B6" />;
      default:
        return null;
    }
  };

  const getReasonText = (reason: string): string => {
    switch (reason) {
      case 'like': return t('notifications.like');
      case 'repost': return t('notifications.repost');
      case 'reply': return t('notifications.reply');
      case 'mention': return t('notifications.mention');
      case 'quote': return t('notifications.quote');
      case 'follow': return t('notifications.follow');
      default: return t('notifications.unknown');
    }
  };

  const renderItem = ({ item }: { item: BlueskyNotification }) => {
    const postRecord = item.record as { text?: string } | null;
    const previewText = ['reply', 'mention', 'quote'].includes(item.reason)
      ? postRecord?.text
      : undefined;
    const displayName = item.author.displayName || item.author.handle;

    return (
      <Pressable
        style={[styles.item, { borderBottomColor: colors.border }]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.iconWrapper}>{getReasonIcon(item.reason)}</View>
        <Image
          source={{ uri: item.author.avatar ?? DEFAULT_AVATAR }}
          style={styles.avatar}
        />
        <View style={styles.content}>
          <View style={styles.row}>
            <Text
              style={[styles.displayName, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayName}
            </Text>
            <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
              {formatRelativeTime(item.indexedAt)}
            </Text>
          </View>
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>
            {getReasonText(item.reason)}
          </Text>
          {previewText ? (
            <Text
              style={[styles.previewText, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {previewText}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <Loading fullScreen message={t('notifications.loading')} />
      </SafeAreaView>
    );
  }

  const authorForModal: TimelinePost['author'] | null = profilePreview.author
    ? {
        did: profilePreview.author.did,
        handle: profilePreview.author.handle,
        displayName: profilePreview.author.displayName ?? '',
        avatar: profilePreview.author.avatar,
        viewer: profilePreview.author.viewer as TimelinePost['author']['viewer'],
      }
    : null;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.uri}
        renderItem={renderItem}
        ListHeaderComponent={<UpdateBanner />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {error ?? t('notifications.empty')}
          </Text>
        }
      />

      <ProfilePreviewModal
        visible={profilePreview.visible}
        author={authorForModal}
        currentUserDid={user?.did}
        onClose={() => setProfilePreview({ visible: false, author: null })}
        onFollowPress={handleFollowPress}
        onBlockPress={handleBlockPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrapper: {
    width: 20,
    alignItems: 'center',
    paddingTop: 2,
    marginRight: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  displayName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  timestamp: {
    fontSize: FontSizes.sm,
  },
  actionText: {
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  previewText: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.xxl,
    fontSize: FontSizes.md,
  },
});
