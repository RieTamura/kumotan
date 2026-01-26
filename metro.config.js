const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// .db ファイルをアセットとしてバンドルする
config.resolver.assetExts.push('db');

module.exports = config;
