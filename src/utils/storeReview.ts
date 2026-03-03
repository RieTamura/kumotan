/**
 * App Store review request utility.
 * Requests a review exactly once when the user reaches the 50-word milestone.
 * The AsyncStorage flag ensures the prompt is shown at most once per install.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const REVIEW_REQUESTED_KEY = 'store_review_requested_v1';
const WORD_MILESTONE = 50;

/**
 * Requests an App Store review if the user has just reached 50 saved words
 * and has not been asked before.
 *
 * Call this after a word is successfully saved.
 */
export async function requestReviewAtMilestone(totalWordCount: number): Promise<void> {
  if (totalWordCount < WORD_MILESTONE) return;

  const alreadyRequested = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
  if (alreadyRequested) return;

  const canRequest = await StoreReview.hasAction();
  if (!canRequest) return;

  await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, 'true');
  await StoreReview.requestReview();
}
