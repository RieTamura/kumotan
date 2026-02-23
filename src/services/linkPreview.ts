/**
 * Link Preview Service
 * Fetches OGP metadata via cardyb API and builds Bluesky external embeds.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Result } from '../types/result';
import { AppError, mapToAppError } from '../utils/errors';
import { getAgent, hasActiveSession, refreshSession } from './bluesky/auth';

const CARDYB_API = 'https://cardyb.bsky.app/v1/extract';

/**
 * OGP metadata returned from cardyb API
 */
export interface LinkPreviewData {
  uri: string;
  title: string;
  description: string;
  thumb?: string; // Thumbnail image URL (og:image)
}

/**
 * Fetch OGP metadata for a URL via the cardyb API.
 * Returns null if the URL is invalid or the request fails.
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  try {
    const response = await fetch(`${CARDYB_API}?url=${encodeURIComponent(url)}`);
    if (!response.ok) return null;

    const json = await response.json() as {
      url?: string;
      title?: string;
      description?: string;
      image?: string;
      error?: string;
    };

    if (json.error || !json.url) return null;

    return {
      uri: json.url,
      title: json.title ?? '',
      description: json.description ?? '',
      thumb: json.image ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Build an app.bsky.embed.external object from link preview data.
 * Uploads the thumbnail image as a blob if available.
 */
export async function buildExternalEmbed(
  preview: LinkPreviewData
): Promise<Result<Record<string, unknown>, AppError>> {
  try {
    const agent = getAgent();

    if (!hasActiveSession()) {
      const refreshResult = await refreshSession();
      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error };
      }
    }

    let thumbBlob: unknown | undefined;

    if (preview.thumb) {
      const tempPath = `${FileSystem.cacheDirectory}link_thumb_${Date.now()}.jpg`;
      try {
        const download = await FileSystem.downloadAsync(preview.thumb, tempPath);
        if (download.status === 200) {
          const base64 = await FileSystem.readAsStringAsync(tempPath, { encoding: 'base64' });
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const uploadResponse = await agent.uploadBlob(bytes, { encoding: 'image/jpeg' });
          thumbBlob = uploadResponse.data.blob;
        }
      } catch {
        // Proceed without thumbnail if download or upload fails
      } finally {
        await FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => undefined);
      }
    }

    const external: Record<string, unknown> = {
      uri: preview.uri,
      title: preview.title,
      description: preview.description,
    };
    if (thumbBlob !== undefined) {
      external.thumb = thumbBlob;
    }

    const embed: Record<string, unknown> = {
      $type: 'app.bsky.embed.external',
      external,
    };

    return { success: true, data: embed };
  } catch (error: unknown) {
    return {
      success: false,
      error: mapToAppError(error, 'リンクプレビューのアップロード'),
    };
  }
}
