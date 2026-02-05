/**
 * Profile Cache Service
 * Manages caching of user profile data with expiration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlueskyProfile } from '../../types/bluesky';

const PROFILE_CACHE_KEY = '@kumotan:profile_cache';
const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

interface CachedProfile {
  profile: BlueskyProfile;
  cachedAt: number;
  userDid: string;
}

/**
 * Save profile to cache
 */
export async function saveProfileToCache(
  profile: BlueskyProfile,
  userDid: string
): Promise<void> {
  try {
    const cacheData: CachedProfile = {
      profile,
      cachedAt: Date.now(),
      userDid,
    };
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to save profile to cache:', error);
    }
  }
}

/**
 * Load profile from cache
 * Returns null if cache is expired or doesn't exist
 */
export async function loadProfileFromCache(
  userDid: string
): Promise<BlueskyProfile | null> {
  try {
    const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) {
      return null;
    }

    const cacheData: CachedProfile = JSON.parse(cached);

    // Check if cache belongs to current user
    if (cacheData.userDid !== userDid) {
      return null;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (now - cacheData.cachedAt > CACHE_EXPIRATION_MS) {
      return null;
    }

    return cacheData.profile;
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to load profile from cache:', error);
    }
    return null;
  }
}

/**
 * Check if cached profile is stale (but still usable as fallback)
 */
export async function isCacheStale(userDid: string): Promise<boolean> {
  try {
    const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) {
      return true;
    }

    const cacheData: CachedProfile = JSON.parse(cached);

    if (cacheData.userDid !== userDid) {
      return true;
    }

    const now = Date.now();
    return now - cacheData.cachedAt > CACHE_EXPIRATION_MS;
  } catch {
    return true;
  }
}

/**
 * Get cached profile even if stale (for offline use)
 */
export async function getCachedProfileForOffline(
  userDid: string
): Promise<BlueskyProfile | null> {
  try {
    const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) {
      return null;
    }

    const cacheData: CachedProfile = JSON.parse(cached);

    // Only check user match, ignore expiration for offline
    if (cacheData.userDid !== userDid) {
      return null;
    }

    return cacheData.profile;
  } catch {
    return null;
  }
}

/**
 * Clear profile cache
 */
export async function clearProfileCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to clear profile cache:', error);
    }
  }
}

/**
 * Get cache age in milliseconds
 */
export async function getCacheAge(userDid: string): Promise<number | null> {
  try {
    const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) {
      return null;
    }

    const cacheData: CachedProfile = JSON.parse(cached);

    if (cacheData.userDid !== userDid) {
      return null;
    }

    return Date.now() - cacheData.cachedAt;
  } catch {
    return null;
  }
}
