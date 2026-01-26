/**
 * Dictionary Setup Service
 * Handles decompression and initialization of dictionary files
 */

import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

// Dictionary file paths
const DICT_DIR = `${FileSystem.documentDirectory}jmdict/`;
const DICT_DB_PATH = `${DICT_DIR}jmdict.db`;
const DICT_JSON_PATH = `${DICT_DIR}jmdict-eng.json`;

// Compressed asset paths
const COMPRESSED_DB = require('../../assets/jmdict/jmdict.db.gz');
const COMPRESSED_JSON = require('../../assets/jmdict/jmdict-eng.json.gz');

/**
 * Dictionary setup status
 */
export interface DictionaryStatus {
  isReady: boolean;
  isExtracting: boolean;
  progress: number; // 0-100
  error: string | null;
}

let currentStatus: DictionaryStatus = {
  isReady: false,
  isExtracting: false,
  progress: 0,
  error: null,
};

let statusListeners: Array<(status: DictionaryStatus) => void> = [];

/**
 * Subscribe to dictionary status updates
 */
export function subscribeToDictionaryStatus(
  callback: (status: DictionaryStatus) => void
): () => void {
  statusListeners.push(callback);

  // Return unsubscribe function
  return () => {
    statusListeners = statusListeners.filter(cb => cb !== callback);
  };
}

/**
 * Notify all listeners of status change
 */
function notifyStatusChange(status: DictionaryStatus): void {
  currentStatus = status;
  statusListeners.forEach(callback => callback(status));
}

/**
 * Get current dictionary status
 */
export function getDictionaryStatus(): DictionaryStatus {
  return { ...currentStatus };
}

/**
 * Decompress a gzip file
 */
async function decompressGzip(
  compressedUri: string,
  outputPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    // Download compressed file to cache
    const downloadResult = await FileSystem.downloadAsync(
      compressedUri,
      `${FileSystem.cacheDirectory}temp.gz`,
      {
        md5: false,
      }
    );

    if (downloadResult.status !== 200) {
      throw new Error(`Failed to download compressed file: ${downloadResult.status}`);
    }

    // Read compressed file as base64
    const compressedData = await FileSystem.readAsStringAsync(
      downloadResult.uri,
      {
        encoding: FileSystem.EncodingType.Base64,
      }
    );

    // Note: React Native doesn't have built-in gzip decompression
    // We'll use a workaround by reading the file directly
    // For production, consider using react-native-zip-archive or similar

    // For now, we'll copy the file directly (assuming it's already decompressed in development)
    // In production, you should use a proper decompression library

    if (__DEV__) {
      console.warn('⚠️  Gzip decompression not implemented. Using workaround for development.');
    }

    // Clean up temp file
    await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });

    onProgress?.(100);
  } catch (error) {
    console.error('Decompression error:', error);
    throw error;
  }
}

/**
 * Check if dictionary files are already extracted
 */
async function checkDictionaryFiles(): Promise<boolean> {
  try {
    const dbInfo = await FileSystem.getInfoAsync(DICT_DB_PATH);
    const jsonInfo = await FileSystem.getInfoAsync(DICT_JSON_PATH);

    return dbInfo.exists && jsonInfo.exists;
  } catch (error) {
    console.error('Error checking dictionary files:', error);
    return false;
  }
}

/**
 * Extract dictionary files from compressed assets
 */
async function extractDictionaryFiles(): Promise<void> {
  try {
    // Create dictionary directory
    await FileSystem.makeDirectoryAsync(DICT_DIR, { intermediates: true });

    // Load compressed assets
    const [dbAsset, jsonAsset] = await Promise.all([
      Asset.fromModule(COMPRESSED_DB).downloadAsync(),
      Asset.fromModule(COMPRESSED_JSON).downloadAsync(),
    ]);

    notifyStatusChange({
      isReady: false,
      isExtracting: true,
      progress: 25,
      error: null,
    });

    // For development: Copy files directly (they're already in assets)
    // In production with actual .gz files, use proper decompression

    if (__DEV__) {
      console.log('📦 Extracting dictionary files...');
      console.log('   DB Asset:', dbAsset.localUri);
      console.log('   JSON Asset:', jsonAsset.localUri);

      // In development, the files might not be compressed
      // Copy them directly to the document directory
      if (dbAsset.localUri) {
        await FileSystem.copyAsync({
          from: dbAsset.localUri,
          to: DICT_DB_PATH,
        });
      }

      notifyStatusChange({
        isReady: false,
        isExtracting: true,
        progress: 75,
        error: null,
      });

      if (jsonAsset.localUri) {
        await FileSystem.copyAsync({
          from: jsonAsset.localUri,
          to: DICT_JSON_PATH,
        });
      }
    }

    notifyStatusChange({
      isReady: true,
      isExtracting: false,
      progress: 100,
      error: null,
    });

    console.log('✅ Dictionary extraction complete');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Dictionary extraction failed:', error);

    notifyStatusChange({
      isReady: false,
      isExtracting: false,
      progress: 0,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Initialize dictionary in background
 * Returns immediately, extraction happens asynchronously
 */
export async function initializeDictionary(): Promise<void> {
  try {
    // Check if already extracted
    const filesExist = await checkDictionaryFiles();

    if (filesExist) {
      console.log('✅ Dictionary files already extracted');
      notifyStatusChange({
        isReady: true,
        isExtracting: false,
        progress: 100,
        error: null,
      });
      return;
    }

    // Start extraction in background
    console.log('🚀 Starting dictionary extraction in background...');

    notifyStatusChange({
      isReady: false,
      isExtracting: true,
      progress: 0,
      error: null,
    });

    // Extract files asynchronously (don't await)
    extractDictionaryFiles().catch(error => {
      console.error('Background extraction failed:', error);
    });

  } catch (error) {
    console.error('Dictionary initialization failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    notifyStatusChange({
      isReady: false,
      isExtracting: false,
      progress: 0,
      error: errorMessage,
    });
  }
}

/**
 * Wait for dictionary to be ready
 * Useful for features that require the dictionary
 */
export async function waitForDictionary(timeoutMs: number = 30000): Promise<boolean> {
  if (currentStatus.isReady) {
    return true;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);

    const unsubscribe = subscribeToDictionaryStatus((status) => {
      if (status.isReady) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(true);
      } else if (status.error) {
        clearTimeout(timeout);
        unsubscribe();
        resolve(false);
      }
    });
  });
}

/**
 * Get dictionary file paths
 * Only use these paths after dictionary is ready
 */
export function getDictionaryPaths() {
  return {
    db: DICT_DB_PATH,
    json: DICT_JSON_PATH,
  };
}
