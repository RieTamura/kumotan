import { useColorScheme } from 'react-native';
import { useThemeStore, ThemeMode } from '../store/themeStore';
import { LightColors, DarkColors, ThemeColors } from '../constants/colors';

interface UseThemeResult {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useTheme = (): UseThemeResult => {
  const { mode, setMode } = useThemeStore();
  const systemColorScheme = useColorScheme();

  // Debug: システムのカラースキームを確認
  console.log('[useTheme] systemColorScheme:', systemColorScheme, 'mode:', mode);

  const isDark =
    mode === 'dark' ||
    (mode === 'system' && systemColorScheme === 'dark');

  const colors: ThemeColors = isDark ? DarkColors : LightColors;

  return {
    colors,
    isDark,
    mode,
    setMode,
  };
};
