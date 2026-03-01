/**
 * GitHub Update Checker
 * Checks for app and dictionary updates by polling GitHub API on launch.
 */

import { APP_INFO, GITHUB } from '../../constants/config';

const FETCH_TIMEOUT_MS = 5000;

export interface AppUpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  releaseNotes: string;
  releaseUrl: string;
}

export interface DictionaryUpdateInfo {
  hasUpdate: boolean;
  latestSha: string;
  latestCommitMessage: string;
}

function compareSemver(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [aMajor, aMinor, aPatch] = parse(a);
  const [bMajor, bMinor, bPatch] = parse(b);
  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkAppUpdate(): Promise<AppUpdateInfo | null> {
  try {
    const response = await fetchWithTimeout(GITHUB.APP_RELEASES_URL);
    if (!response.ok) return null;

    const data = await response.json() as {
      tag_name: string;
      html_url: string;
      body: string | null;
    };

    const latestVersion = data.tag_name.replace(/^v/, '');
    const hasUpdate = compareSemver(latestVersion, APP_INFO.VERSION) > 0;

    return {
      hasUpdate,
      latestVersion,
      releaseNotes: data.body ?? '',
      releaseUrl: data.html_url,
    };
  } catch {
    return null;
  }
}

export async function checkDictionaryUpdate(
  lastKnownSha: string | null
): Promise<DictionaryUpdateInfo | null> {
  try {
    const response = await fetchWithTimeout(GITHUB.DICT_COMMITS_URL);
    if (!response.ok) return null;

    const data = await response.json() as Array<{
      sha: string;
      commit: { message: string };
    }>;

    if (!data.length) return null;

    const latestSha = data[0].sha;
    const latestCommitMessage = data[0].commit.message.split('\n')[0];

    // 初回（lastKnownSha が null）は更新扱いにしない
    const hasUpdate = lastKnownSha !== null && lastKnownSha !== latestSha;

    return {
      hasUpdate,
      latestSha,
      latestCommitMessage,
    };
  } catch {
    return null;
  }
}

/**
 * Strips basic Markdown syntax for plain-text display.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')           // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')        // bold
    .replace(/\*(.+?)\*/g, '$1')            // italic
    .replace(/`{1,3}(.+?)`{1,3}/g, '$1')   // inline code
    .replace(/!\[.*?\]\(.*?\)/g, '')        // images
    .replace(/\[(.+?)\]\(.*?\)/g, '$1')    // links
    .replace(/^[-*]\s+/gm, '• ')           // unordered list
    .replace(/^\d+\.\s+/gm, '')            // ordered list
    .trim();
}
