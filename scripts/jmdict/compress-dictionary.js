/**
 * JMdict Dictionary Compression Script
 * Compresses large dictionary files for Git storage
 */

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../../assets/jmdict');
const FILES_TO_COMPRESS = [
  'jmdict.db',
  'jmdict-eng.json'
];

async function compressFile(filename) {
  const inputPath = path.join(ASSETS_DIR, filename);
  const outputPath = path.join(ASSETS_DIR, `${filename}.gz`);

  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    console.log(`⚠️  File not found: ${filename}`);
    return;
  }

  // Check if already compressed
  if (fs.existsSync(outputPath)) {
    console.log(`ℹ️  Already compressed: ${filename}.gz`);
    return;
  }

  console.log(`📦 Compressing ${filename}...`);

  const input = fs.createReadStream(inputPath);
  const output = fs.createWriteStream(outputPath);
  const gzip = zlib.createGzip({ level: 9 }); // Maximum compression

  return new Promise((resolve, reject) => {
    input
      .pipe(gzip)
      .pipe(output)
      .on('finish', () => {
        const inputSize = fs.statSync(inputPath).size;
        const outputSize = fs.statSync(outputPath).size;
        const ratio = ((1 - outputSize / inputSize) * 100).toFixed(1);

        console.log(`✅ ${filename} compressed:`);
        console.log(`   Original: ${(inputSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Compressed: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Saved: ${ratio}%`);

        resolve();
      })
      .on('error', reject);
  });
}

async function main() {
  console.log('🚀 Starting dictionary compression...\n');

  for (const file of FILES_TO_COMPRESS) {
    await compressFile(file);
    console.log('');
  }

  console.log('✨ Compression complete!\n');
  console.log('📝 Next steps:');
  console.log('   1. Update .gitignore to exclude uncompressed files');
  console.log('   2. Add compressed files to Git');
  console.log('   3. Implement decompression in the app');
}

main().catch(console.error);
