module.exports = function (api) {
  api.cache(true);
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      // Strip console.log/debug/info in production builds (keep console.error/warn for crash diagnostics)
      ...(isProduction ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] : []),
    ],
  };
};
