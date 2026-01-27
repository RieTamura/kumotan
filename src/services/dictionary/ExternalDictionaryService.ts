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
