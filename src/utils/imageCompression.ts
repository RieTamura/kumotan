/**
 * Image compression utility for Bluesky post uploads.
 * Inspired by Bluesky social-app's src/lib/media/manip.ts
 * Uses binary search on JPEG quality to compress images below the size limit.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

/** Maximum image size accepted by Bluesky (1MB) */
const MAX_IMAGE_SIZE = 1_000_000;

/** Maximum pixel dimension (width or height) */
const MAX_IMAGE_DIMENSION = 2000;

/**
 * Calculate resized dimensions that fit within MAX_IMAGE_DIMENSION,
 * preserving aspect ratio. Returns undefined if no resize is needed.
 */
function getResizedDimensions(
  width: number,
  height: number,
): { width: number; height: number } | undefined {
  if (width <= 0 || height <= 0) return undefined;
  if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) return undefined;
  const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
  return {
    width: Math.floor(width * ratio),
    height: Math.floor(height * ratio),
  };
}

/**
 * Compresses an image to below 1MB using binary search on JPEG quality.
 * Also downsizes the image if either dimension exceeds 2000px.
 *
 * Returns the original URI/dimensions if the image is already small enough,
 * or a new compressed JPEG URI if compression was needed.
 */
export async function compressImageIfNeeded(
  uri: string,
  width: number,
  height: number,
): Promise<{ uri: string; width: number; height: number; mimeType: string }> {
  // Check current file size first
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (fileInfo.exists && 'size' in fileInfo && fileInfo.size <= MAX_IMAGE_SIZE) {
    return { uri, width, height, mimeType: 'image/jpeg' };
  }

  const newDimensions = getResizedDimensions(width, height);

  let minQuality = 0;
  let maxQuality = 101;
  let bestResult: { uri: string; width: number; height: number } | null = null;
  const intermediateUris: string[] = [];

  // Binary search for the highest quality that stays under the size limit
  while (maxQuality - minQuality > 1) {
    const quality = Math.round((maxQuality + minQuality) / 2);

    let ctx = ImageManipulator.manipulate(uri);
    if (newDimensions) {
      ctx = ctx.resize(newDimensions);
    }
    const imageRef = await ctx.renderAsync();
    const resized = await imageRef.saveAsync({ format: SaveFormat.JPEG, compress: quality / 100 });

    intermediateUris.push(resized.uri);

    const info = await FileSystem.getInfoAsync(resized.uri);
    if (!info.exists) {
      throw new Error('Image manipulation failed to create output file');
    }

    const size = 'size' in info ? info.size : Infinity;
    if (size <= MAX_IMAGE_SIZE) {
      minQuality = quality;
      bestResult = { uri: resized.uri, width: resized.width, height: resized.height };
    } else {
      maxQuality = quality;
    }
  }

  // Clean up intermediate files, keeping only the best result
  for (const intermediateUri of intermediateUris) {
    if (!bestResult || intermediateUri !== bestResult.uri) {
      FileSystem.deleteAsync(intermediateUri, { idempotent: true }).catch(() => {});
    }
  }

  if (bestResult) {
    if (__DEV__) {
      console.log(`Image compressed to quality=${minQuality}%, size within 1MB`);
    }
    return { ...bestResult, mimeType: 'image/jpeg' };
  }

  throw new Error('画像を1MB以下に圧縮できませんでした');
}
