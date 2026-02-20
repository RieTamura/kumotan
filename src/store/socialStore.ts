/**
 * Social Graph Store
 * Tracks optimistic follow/block state overrides per DID within a session.
 * These overrides take priority over the server-supplied author.viewer data.
 */

import { create } from 'zustand';

/**
 * Per-user social state override.
 * - string: a record URI exists (relationship is active)
 * - null: explicitly cleared in this session (relationship was removed)
 * - key absent (undefined): unknown; fall back to post.author.viewer
 */
interface UserSocialState {
  following?: string | null;
  blocking?: string | null;
}

interface SocialStoreState {
  userStates: Record<string, UserSocialState>;
  setFollowing: (did: string, uri: string | null) => void;
  setBlocking: (did: string, uri: string | null) => void;
}

export const useSocialStore = create<SocialStoreState>((set) => ({
  userStates: {},

  setFollowing: (did, uri) =>
    set((s) => ({
      userStates: {
        ...s.userStates,
        [did]: { ...(s.userStates[did] ?? {}), following: uri },
      },
    })),

  setBlocking: (did, uri) =>
    set((s) => ({
      userStates: {
        ...s.userStates,
        [did]: { ...(s.userStates[did] ?? {}), blocking: uri },
      },
    })),
}));

/**
 * Resolve effective follow URI for a DID.
 * Store override takes priority over the server-supplied viewer URI.
 * - Store has string → use it (following)
 * - Store has null  → not following (explicitly cleared)
 * - Store key absent → use viewerUri from post data
 */
export function resolveFollowState(
  states: Record<string, UserSocialState>,
  did: string,
  viewerUri: string | undefined
): string | undefined {
  const entry = states[did];
  if (!entry || !('following' in entry)) return viewerUri;
  return entry.following ?? undefined;
}

/**
 * Resolve effective block URI for a DID.
 * Store override takes priority over the server-supplied viewer URI.
 */
export function resolveBlockState(
  states: Record<string, UserSocialState>,
  did: string,
  viewerUri: string | undefined
): string | undefined {
  const entry = states[did];
  if (!entry || !('blocking' in entry)) return viewerUri;
  return entry.blocking ?? undefined;
}
