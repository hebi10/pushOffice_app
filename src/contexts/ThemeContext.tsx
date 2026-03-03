/**
 * 테마 Context – 앱 전체에서 현재 테마 색상에 접근
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { AppColors, darkColors, FONT_MAP, lightColors } from '../lib/theme';
import { useAppSelector } from '../store/store';
import type { FontFamily, ThemeMode } from '../types';

interface ThemeContextValue {
  colors: AppColors;
  isDark: boolean;
  fontRegular: string;
  fontBold: string;
  fontFamily: FontFamily;
  themeMode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  isDark: false,
  fontRegular: FONT_MAP.pretendard.regular,
  fontBold: FONT_MAP.pretendard.bold,
  fontFamily: 'pretendard',
  themeMode: 'system',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const themeMode = useAppSelector((s) => s.settings.themeMode) ?? 'system';
  const fontFamily = useAppSelector((s) => s.settings.fontFamily) ?? 'pretendard';

  const value = useMemo<ThemeContextValue>(() => {
    let isDark: boolean;
    if (themeMode === 'system') {
      isDark = systemScheme === 'dark';
    } else {
      isDark = themeMode === 'dark';
    }

    const colors = isDark ? darkColors : lightColors;
    const font = FONT_MAP[fontFamily] ?? FONT_MAP.pretendard;

    return {
      colors,
      isDark,
      fontRegular: font.regular,
      fontBold: font.bold,
      fontFamily,
      themeMode,
    };
  }, [systemScheme, themeMode, fontFamily]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
