/**
 * JMdict辞書ダウンロードスクリプト
 *
 * jmdict-simplifiedプロジェクトから最新のJMdict英語版をダウンロードします。
 * https://github.com/scriptin/jmdict-simplified
 *
 * 使用方法:
 *   npx ts-node scripts/jmdict/download-jmdict.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { createGunzip } from 'zlib';
import type { IncomingMessage } from 'http';

const JMDICT_URL =
  'https://github.com/scriptin/jmdict-simplified/releases/latest/download/jmdict-eng-3.5.0.json.gz';

const OUTPUT_DIR = path.join(__dirname, '../../assets/jmdict');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'jmdict-eng.json');

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Downloading from: ${url}`);

    const handleResponse = (response: IncomingMessage) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          console.log(`Redirecting to: ${redirectUrl}`);
          https.get(redirectUrl, handleResponse).on('error', reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const gunzip = createGunzip();
      const fileStream = fs.createWriteStream(destPath);

      response.pipe(gunzip).pipe(fileStream);

      let downloadedSize = 0;
      response.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        process.stdout.write(`\rDownloaded: ${(downloadedSize / 1024 / 1024).toFixed(2)} MB`);
      });

      fileStream.on('finish', () => {
        console.log('\nDownload complete!');
        fileStream.close();
        resolve();
      });

      fileStream.on('error', reject);
      gunzip.on('error', reject);
    };

    https.get(url, handleResponse).on('error', reject);
  });
}

async function main(): Promise<void> {
  console.log('=== JMdict Download Script ===\n');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created directory: ${OUTPUT_DIR}`);
  }

  // Check if file already exists
  if (fs.existsSync(OUTPUT_FILE)) {
    const stats = fs.statSync(OUTPUT_FILE);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`JMdict file already exists (${sizeMB} MB): ${OUTPUT_FILE}`);
    console.log('Delete the file and run again to re-download.');
    return;
  }

  try {
    await downloadFile(JMDICT_URL, OUTPUT_FILE);

    const stats = fs.statSync(OUTPUT_FILE);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`\nSaved to: ${OUTPUT_FILE}`);
    console.log(`File size: ${sizeMB} MB`);
  } catch (error) {
    console.error('Download failed:', error);
    process.exit(1);
  }
}

main();
