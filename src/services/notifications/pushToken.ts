import { NOTIFICATIONS_WORKER_URL } from '../../constants/config';

export interface BlueskyNotificationSettings {
  notifyOnLike: boolean;
  notifyOnReply: boolean;
  notifyOnMention: boolean;
  notifyOnRepost: boolean;
  notifyOnFollow: boolean;
}

/**
 * Register a user's Expo Push Token with the notification server.
 * Called when the user enables Bluesky push notifications.
 */
export async function registerPushToken(
  did: string,
  expoPushToken: string,
  settings: BlueskyNotificationSettings
): Promise<void> {
  const resp = await fetch(`${NOTIFICATIONS_WORKER_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ did, expoPushToken, settings }),
  });
  if (!resp.ok) {
    throw new Error(`Failed to register push token: ${resp.status}`);
  }
}

/**
 * Update notification preferences for an already-registered user.
 * Calls the same /register endpoint (upserts the record).
 */
export async function updatePushSettings(
  did: string,
  expoPushToken: string,
  settings: BlueskyNotificationSettings
): Promise<void> {
  return registerPushToken(did, expoPushToken, settings);
}

/**
 * Unregister a user from push notifications.
 * Called when the user disables Bluesky push notifications or logs out.
 */
export async function unregisterPushToken(did: string): Promise<void> {
  const resp = await fetch(`${NOTIFICATIONS_WORKER_URL}/register/${encodeURIComponent(did)}`, {
    method: 'DELETE',
  });
  if (!resp.ok) {
    throw new Error(`Failed to unregister push token: ${resp.status}`);
  }
}
