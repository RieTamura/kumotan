/**
 * 外部辞書データ管理サービス
 *
 * GitHub Pagesからホストされる辞書データのダウンロード、
 * 解凍、インストールを管理します。
 */

import {
  documentDirectory,
  cacheDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  createDownloadResumable,
  EncodingType,
  type DownloadProgressData,
} from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gunzipSync } from 'fflate';
import { DICTIONARY_CONFIG } from '../../constants/config';
import { Result } from '../../types/result';
import { AppError, ErrorCode } from '../../utils/errors';

/**
 * 辞書オーバーライドエントリ
 * フィードバックから承認された修正データ
 */
export interface DictionaryOverride {
  id: string;
  type: 'correction' | 'addition' | 'deletion';
  word: string;
  original_meaning?: string;
  corrected_meaning?: string;
  meaning?: string;
  reading?: string;
  part_of_speech?: string;
  post_url?: string;
  source_issue: number;
  approved_at: string;
}

/**
 * オーバーライドファイル形式
 */
export interface OverridesFile {
  version: string;
  updated_at: string;
  entries: DictionaryOverride[];
}

/**
 * 辞書メタデータ
 */
export interface DictionaryMetadata {
  version: string;
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
  source: string;
  license: string;
  updatedAt: string;
}

/**
 * ダウンロード進捗情報
 */
export interface DownloadProgress {
  totalBytes: number;
  downloadedBytes: number;
  percentage: number;
}

/**
 * インストール状態
 */
export type InstallStatus =
  | 'not_installed'
  | 'checking'
  | 'downloading'
  | 'extracting'
  | 'installing'
  | 'installed'
  | 'update_available'
  | 'error';

/**
 * SQLiteデータベースの保存先ディレクトリ
 */
const getSQLiteDirectory = (): string => {
  return `${documentDirectory}SQLite/`;
};

/**
 * 辞書DBファイルのフルパス
 */
const getDictionaryPath = (): string => {
  return `${getSQLiteDirectory()}${DICTIONARY_CONFIG.DATABASE_FILE}`;
};

/**
 * 一時ダウンロードファイルのパス
 */
const getTempDownloadPath = (): string => {
  return `${cacheDirectory}${DICTIONARY_CONFIG.COMPRESSED_FILE}`;
};

/**
 * リモートのメタデータURLを取得
 */
const getMetadataUrl = (): string => {
  return `${DICTIONARY_CONFIG.BASE_URL}/${DICTIONARY_CONFIG.METADATA_FILE}`;
};

/**
 * リモートの辞書ファイルURLを取得
 */
const getDictionaryUrl = (): string => {
  return `${DICTIONARY_CONFIG.BASE_URL}/${DICTIONARY_CONFIG.COMPRESSED_FILE}`;
};

/**
 * リモートのメタデータを取得
 */
export async function fetchRemoteMetadata(): Promise<
  Result<DictionaryMetadata, AppError>
> {
  try {
    const response = await fetch(getMetadataUrl(), {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.NETWORK_ERROR,
          `メタデータの取得に失敗しました: ${response.status}`
        ),
      };
    }

    const metadata = (await response.json()) as DictionaryMetadata;
    return { success: true, data: metadata };
  } catch (error) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.NETWORK_ERROR,
        'メタデータの取得中にエラーが発生しました',
        error
      ),
    };
  }
}

/**
 * ローカルにインストールされている辞書のバージョンを取得
 */
export async function getInstalledVersion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(DICTIONARY_CONFIG.STORAGE_KEY_VERSION);
  } catch {
    return null;
  }
}

/**
 * 辞書がインストール済みかどうかを確認
 */
export async function isDictionaryInstalled(): Promise<boolean> {
  try {
    // AsyncStorageのフラグを確認
    const installed = await AsyncStorage.getItem(
      DICTIONARY_CONFIG.STORAGE_KEY_INSTALLED
    );
    if (installed !== 'true') {
      return false;
    }

    // 実際にファイルが存在するか確認
    const fileInfo = await getInfoAsync(getDictionaryPath());
    return fileInfo.exists;
  } catch {
    return false;
  }
}

/**
 * アップデートが利用可能かどうかを確認
 */
export async function checkForUpdate(): Promise<
  Result<{ available: boolean; currentVersion: string | null; newVersion: string }, AppError>
> {
  const metadataResult = await fetchRemoteMetadata();
  if (!metadataResult.success) {
    return { success: false, error: metadataResult.error };
  }

  const currentVersion = await getInstalledVersion();
  const newVersion = metadataResult.data.version;

  return {
    success: true,
    data: {
      available: currentVersion !== newVersion,
      currentVersion,
      newVersion,
    },
  };
}

/**
 * SQLiteディレクトリが存在することを確認し、なければ作成
 */
async function ensureSQLiteDirectory(): Promise<void> {
  const dirPath = getSQLiteDirectory();
  const dirInfo = await getInfoAsync(dirPath);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(dirPath, { intermediates: true });
    if (__DEV__) {
      console.log('ExternalDictionary: Created SQLite directory');
    }
  }
}

/**
 * 辞書ファイルをダウンロード
 */
export async function downloadDictionary(
  onProgress?: (progress: DownloadProgress) => void
): Promise<Result<string, AppError>> {
  const tempPath = getTempDownloadPath();

  try {
    // 既存の一時ファイルを削除
    const tempInfo = await getInfoAsync(tempPath);
    if (tempInfo.exists) {
      await deleteAsync(tempPath, { idempotent: true });
    }

    // メタデータを取得してファイルサイズを把握
    const metadataResult = await fetchRemoteMetadata();
    if (!metadataResult.success) {
      return { success: false, error: metadataResult.error };
    }

    const totalBytes = metadataResult.data.compressedSize;

    if (__DEV__) {
      console.log(
        `ExternalDictionary: Starting download (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`
      );
    }

    // ダウンロード実行
    const downloadResumable = createDownloadResumable(
      getDictionaryUrl(),
      tempPath,
      {},
      (downloadProgress: DownloadProgressData) => {
        const downloadedBytes = downloadProgress.totalBytesWritten;
        const percentage = Math.round((downloadedBytes / totalBytes) * 100);
        onProgress?.({
          totalBytes,
          downloadedBytes,
          percentage,
        });
      }
    );

    const downloadResult = await downloadResumable.downloadAsync();

    if (!downloadResult?.uri) {
      return {
        success: false,
        error: new AppError(
          ErrorCode.NETWORK_ERROR,
          '辞書ファイルのダウンロードに失敗しました'
        ),
      };
    }

    if (__DEV__) {
      console.log('ExternalDictionary: Download completed');
    }

    return { success: true, data: downloadResult.uri };
  } catch (error) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.NETWORK_ERROR,
        '辞書ファイルのダウンロード中にエラーが発生しました',
        error
      ),
    };
  }
}

/**
 * Gzip圧縮ファイルを解凍してインストール
 */
export async function extractAndInstall(
  compressedFilePath: string
): Promise<Result<void, AppError>> {
  try {
    if (__DEV__) {
      console.log('ExternalDictionary: Starting extraction');
    }

    // SQLiteディレクトリを確保
    await ensureSQLiteDirectory();

    // 圧縮ファイルを読み込み
    const compressedData = await readAsStringAsync(
      compressedFilePath,
      {
        encoding: EncodingType.Base64,
      }
    );

    // Base64をバイナリに変換
    const binaryString = atob(compressedData);
    const compressedBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      compressedBytes[i] = binaryString.charCodeAt(i);
    }

    if (__DEV__) {
      console.log(
        `ExternalDictionary: Compressed size: ${(compressedBytes.length / 1024 / 1024).toFixed(1)} MB`
      );
    }

    // Gzip解凍
    const decompressedBytes = gunzipSync(compressedBytes);

    if (__DEV__) {
      console.log(
        `ExternalDictionary: Decompressed size: ${(decompressedBytes.length / 1024 / 1024).toFixed(1)} MB`
      );
    }

    // バイナリをBase64に変換
    let decompressedBase64 = '';
    const chunkSize = 8192;
    for (let i = 0; i < decompressedBytes.length; i += chunkSize) {
      const chunk = decompressedBytes.slice(i, i + chunkSize);
      decompressedBase64 += String.fromCharCode.apply(null, Array.from(chunk));
    }
    decompressedBase64 = btoa(decompressedBase64);

    // 解凍したデータを保存
    const destPath = getDictionaryPath();
    await writeAsStringAsync(destPath, decompressedBase64, {
      encoding: EncodingType.Base64,
    });

    if (__DEV__) {
      console.log(`ExternalDictionary: Saved to ${destPath}`);
    }

    // 一時ファイルを削除
    await deleteAsync(compressedFilePath, { idempotent: true });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        '辞書ファイルの解凍中にエラーが発生しました',
        error
      ),
    };
  }
}

/**
 * インストール完了を記録
 */
async function markInstalled(version: string): Promise<void> {
  await AsyncStorage.setItem(DICTIONARY_CONFIG.STORAGE_KEY_INSTALLED, 'true');
  await AsyncStorage.setItem(DICTIONARY_CONFIG.STORAGE_KEY_VERSION, version);
}

/**
 * インストール状態をクリア
 */
export async function clearInstallState(): Promise<void> {
  await AsyncStorage.removeItem(DICTIONARY_CONFIG.STORAGE_KEY_INSTALLED);
  await AsyncStorage.removeItem(DICTIONARY_CONFIG.STORAGE_KEY_VERSION);
}

/**
 * 辞書ファイルを削除
 */
export async function deleteDictionary(): Promise<Result<void, AppError>> {
  try {
    const filePath = getDictionaryPath();
    const fileInfo = await getInfoAsync(filePath);

    if (fileInfo.exists) {
      await deleteAsync(filePath, { idempotent: true });
    }

    await clearInstallState();

    if (__DEV__) {
      console.log('ExternalDictionary: Dictionary deleted');
    }

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        '辞書ファイルの削除中にエラーが発生しました',
        error
      ),
    };
  }
}

/**
 * 辞書をダウンロードしてインストールする（一連のフロー）
 */
export async function installDictionary(
  onProgress?: (progress: DownloadProgress) => void,
  onStatusChange?: (status: InstallStatus) => void
): Promise<Result<void, AppError>> {
  try {
    onStatusChange?.('checking');

    // メタデータを取得
    const metadataResult = await fetchRemoteMetadata();
    if (!metadataResult.success) {
      onStatusChange?.('error');
      return { success: false, error: metadataResult.error };
    }

    const version = metadataResult.data.version;

    onStatusChange?.('downloading');

    // ダウンロード
    const downloadResult = await downloadDictionary(onProgress);
    if (!downloadResult.success) {
      onStatusChange?.('error');
      return { success: false, error: downloadResult.error };
    }

    onStatusChange?.('extracting');

    // 解凍とインストール
    const extractResult = await extractAndInstall(downloadResult.data);
    if (!extractResult.success) {
      onStatusChange?.('error');
      return { success: false, error: extractResult.error };
    }

    onStatusChange?.('installing');

    // インストール完了を記録
    await markInstalled(version);

    onStatusChange?.('installed');

    if (__DEV__) {
      console.log(`ExternalDictionary: Installation completed (v${version})`);
    }

    return { success: true, data: undefined };
  } catch (error) {
    onStatusChange?.('error');
    return {
      success: false,
      error: new AppError(
        ErrorCode.DATABASE_ERROR,
        '辞書のインストール中にエラーが発生しました',
        error
      ),
    };
  }
}

/**
 * 辞書の状態を取得
 */
export async function getDictionaryStatus(): Promise<{
  status: InstallStatus;
  installedVersion: string | null;
  availableVersion?: string;
  fileSize?: number;
}> {
  const installed = await isDictionaryInstalled();
  const installedVersion = await getInstalledVersion();

  if (!installed) {
    return {
      status: 'not_installed',
      installedVersion: null,
    };
  }

  // アップデートチェック
  const updateResult = await checkForUpdate();
  if (updateResult.success && updateResult.data.available) {
    return {
      status: 'update_available',
      installedVersion,
      availableVersion: updateResult.data.newVersion,
    };
  }

  // ファイルサイズを取得
  const fileInfo = await getInfoAsync(getDictionaryPath());
  const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined;

  return {
    status: 'installed',
    installedVersion,
    fileSize,
  };
}

// ========== 差分ファイル（オーバーライド）管理 ==========

/**
 * オーバーライドファイルのURL
 */
const getOverridesUrl = (): string => {
  return `${DICTIONARY_CONFIG.BASE_URL}/${DICTIONARY_CONFIG.OVERRIDES_FILE}`;
};

/**
 * メモリキャッシュ
 */
let overridesCache: OverridesFile | null = null;
let overridesCacheTimestamp: number = 0;

/**
 * リモートのオーバーライドファイルを取得
 */
export async function fetchRemoteOverrides(): Promise<
  Result<OverridesFile, AppError>
> {
  try {
    const response = await fetch(getOverridesUrl(), {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // ファイルが存在しない場合は空のオーバーライドを返す
        return {
          success: true,
          data: { version: '1.0.0', updated_at: '', entries: [] },
        };
      }
      return {
        success: false,
        error: new AppError(
          ErrorCode.NETWORK_ERROR,
          `オーバーライドファイルの取得に失敗しました: ${response.status}`
        ),
      };
    }

    const overrides = (await response.json()) as OverridesFile;
    return { success: true, data: overrides };
  } catch (error) {
    return {
      success: false,
      error: new AppError(
        ErrorCode.NETWORK_ERROR,
        'オーバーライドファイルの取得中にエラーが発生しました',
        error
      ),
    };
  }
}

/**
 * オーバーライドをAsyncStorageにキャッシュ
 */
async function cacheOverrides(overrides: OverridesFile): Promise<void> {
  try {
    await AsyncStorage.setItem(
      DICTIONARY_CONFIG.STORAGE_KEY_OVERRIDES,
      JSON.stringify(overrides)
    );
    await AsyncStorage.setItem(
      DICTIONARY_CONFIG.STORAGE_KEY_OVERRIDES_UPDATED,
      Date.now().toString()
    );
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to cache overrides:', error);
    }
  }
}

/**
 * AsyncStorageからキャッシュされたオーバーライドを取得
 */
async function getCachedOverrides(): Promise<OverridesFile | null> {
  try {
    const cached = await AsyncStorage.getItem(
      DICTIONARY_CONFIG.STORAGE_KEY_OVERRIDES
    );
    if (!cached) return null;

    const updatedAt = await AsyncStorage.getItem(
      DICTIONARY_CONFIG.STORAGE_KEY_OVERRIDES_UPDATED
    );
    if (!updatedAt) return null;

    const cacheAge = Date.now() - parseInt(updatedAt, 10);
    if (cacheAge > DICTIONARY_CONFIG.OVERRIDES_CACHE_TTL) {
      // キャッシュ期限切れ
      return null;
    }

    return JSON.parse(cached) as OverridesFile;
  } catch {
    return null;
  }
}

/**
 * オーバーライドを取得（キャッシュ優先）
 *
 * 1. メモリキャッシュを確認
 * 2. AsyncStorageのキャッシュを確認
 * 3. リモートから取得してキャッシュを更新
 */
export async function getOverrides(): Promise<OverridesFile | null> {
  // メモリキャッシュを確認
  const now = Date.now();
  if (
    overridesCache &&
    now - overridesCacheTimestamp < DICTIONARY_CONFIG.OVERRIDES_CACHE_TTL
  ) {
    return overridesCache;
  }

  // AsyncStorageのキャッシュを確認
  const cachedOverrides = await getCachedOverrides();
  if (cachedOverrides) {
    overridesCache = cachedOverrides;
    overridesCacheTimestamp = now;
    return cachedOverrides;
  }

  // リモートから取得
  const result = await fetchRemoteOverrides();
  if (result.success) {
    overridesCache = result.data;
    overridesCacheTimestamp = now;
    await cacheOverrides(result.data);
    return result.data;
  }

  // エラー時はnullを返す（オフライン等）
  if (__DEV__) {
    console.log('Failed to fetch overrides:', result.error.message);
  }
  return null;
}

/**
 * 単語に対するオーバーライドを検索
 */
export function findOverrideForWord(
  overrides: OverridesFile | null,
  word: string
): DictionaryOverride | null {
  if (!overrides || overrides.entries.length === 0) {
    return null;
  }

  const normalizedWord = word.toLowerCase().trim();

  // type: 'deletion' のエントリは除外して検索
  const override = overrides.entries.find(
    (entry) =>
      entry.type !== 'deletion' &&
      entry.word.toLowerCase() === normalizedWord
  );

  return override || null;
}

/**
 * 単語がオーバーライドで削除対象かチェック
 */
export function isWordDeleted(
  overrides: OverridesFile | null,
  word: string
): boolean {
  if (!overrides || overrides.entries.length === 0) {
    return false;
  }

  const normalizedWord = word.toLowerCase().trim();

  return overrides.entries.some(
    (entry) =>
      entry.type === 'deletion' &&
      entry.word.toLowerCase() === normalizedWord
  );
}

/**
 * オーバーライドキャッシュをクリア
 */
export async function clearOverridesCache(): Promise<void> {
  overridesCache = null;
  overridesCacheTimestamp = 0;
  try {
    await AsyncStorage.removeItem(DICTIONARY_CONFIG.STORAGE_KEY_OVERRIDES);
    await AsyncStorage.removeItem(DICTIONARY_CONFIG.STORAGE_KEY_OVERRIDES_UPDATED);
  } catch {
    // ignore
  }
}

/**
 * オーバーライドを強制的に更新
 */
export async function refreshOverrides(): Promise<
  Result<OverridesFile, AppError>
> {
  const result = await fetchRemoteOverrides();
  if (result.success) {
    overridesCache = result.data;
    overridesCacheTimestamp = Date.now();
    await cacheOverrides(result.data);

    if (__DEV__) {
      console.log(
        `ExternalDictionary: Refreshed overrides (${result.data.entries.length} entries)`
      );
    }
  }
  return result;
}
