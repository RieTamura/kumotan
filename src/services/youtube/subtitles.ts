/**
 * YouTube Subtitles Service
 * Fetches subtitles from YouTube videos using the timedtext API.
 * No API key required - works with auto-generated (ASR) captions.
 */

import { Result } from '../../types/result';
import { AppError, ErrorCode, mapToAppError } from '../../utils/errors';

const TIMEOUT_MS = 10000;
const TIMEDTEXT_BASE = 'https://www.youtube.com/api/timedtext';

/**
 * A single subtitle entry with start time and text
 */
export interface SubtitleEntry {
  startMs: number;
  text: string;
}

/**
 * Result of subtitle fetching
 */
export interface SubtitleResult {
  videoId: string;
  entries: SubtitleEntry[];
}

/**
 * Extract YouTube video ID from various URL formats.
 * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, youtube.com/embed/ID
 */
export function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');

    if (hostname === 'youtu.be') {
      const id = urlObj.pathname.slice(1).split('/')[0];
      return id || null;
    }

    if (hostname === 'youtube.com') {
      if (
        urlObj.pathname.startsWith('/shorts/') ||
        urlObj.pathname.startsWith('/embed/')
      ) {
        return urlObj.pathname.split('/')[2] || null;
      }
      return urlObj.searchParams.get('v');
    }
  } catch {
    // Invalid URL
  }
  return null;
}

/**
 * Check if a URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

/**
 * Format milliseconds to M:SS display string
 */
export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Fetch raw timed text entries from YouTube timedtext API
 */
async function fetchTimedText(
  videoId: string,
  lang: string,
  kind?: string
): Promise<SubtitleEntry[]> {
  const params = new URLSearchParams({ v: videoId, lang, fmt: 'json3' });
  if (kind) {
    params.set('kind', kind);
  }

  const url = `${TIMEDTEXT_BASE}?${params.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new AppError(ErrorCode.API_ERROR, `HTTP ${response.status}`);
    }

    const text = await response.text();
    if (!text || text.trim() === '{}' || text.trim() === '') {
      return [];
    }

    const data: {
      events?: Array<{
        tStartMs?: number;
        segs?: Array<{ utf8?: string }>;
      }>;
    } = JSON.parse(text);

    const entries: SubtitleEntry[] = [];

    for (const event of data.events ?? []) {
      if (!event.segs) continue;
      const combined = event.segs
        .map((seg) => seg.utf8 ?? '')
        .join('')
        .replace(/\n/g, ' ')
        .trim();
      if (combined) {
        entries.push({ startMs: event.tStartMs ?? 0, text: combined });
      }
    }

    return entries;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch subtitles for a YouTube video.
 * Tries auto-generated English captions first, then manual English captions.
 */
export async function fetchYouTubeSubtitles(
  videoId: string
): Promise<Result<SubtitleResult, AppError>> {
  try {
    // Try auto-generated captions first (most videos have these)
    let entries = await fetchTimedText(videoId, 'en', 'asr');

    // Fall back to manual English captions
    if (entries.length === 0) {
      entries = await fetchTimedText(videoId, 'en');
    }

    if (entries.length === 0) {
      return Result.err(
        new AppError(
          ErrorCode.WORD_NOT_FOUND,
          'No English subtitles found for this video'
        )
      );
    }

    return Result.ok({ videoId, entries });
  } catch (error) {
    return Result.err(mapToAppError(error, 'fetchYouTubeSubtitles'));
  }
}
