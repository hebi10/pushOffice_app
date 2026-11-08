/**
 * 테마 시스템 – 라이트 / 다크 색상 정의
 */
import type { FontFamily } from '../types';
import { APP_FONT_FAMILY } from './typography';

export interface AppColors {
  background: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  onPrimary: string;
  brandAccent: string;
  primaryLight: string;
  inputBackground: string;
  inputBorder: string;
  divider: string;
  danger: string;
  onDanger: string;
  success: string;
  tabBar: string;
  tabBarBorder: string;
  headerBackground: string;
  chatUserBubble: string;
  chatAssistantBubble: string;
  chatAssistantBorder: string;
  chatUserText: string;
  chatAssistantText: string;
  statusBar: 'light' | 'dark' | 'auto';
}

/** Mono Office 10-A: neutral UI controls, blue reserved for explicit brand accents. */
export const lightColors: AppColors = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceBorder: '#DDE1E5',
  text: '#1C1E21',
  textSecondary: '#5D6269',
  textTertiary: '#656C74',
  primary: '#23262B',
  onPrimary: '#FFFFFF',
  brandAccent: '#2563EB',
  primaryLight: '#ECEEF1',
  inputBackground: '#ECEEF1',
  inputBorder: '#818891',
  divider: '#DDE1E5',
  danger: '#B42318',
  onDanger: '#FFFFFF',
  success: '#0B7850',
  tabBar: '#FFFFFF',
  tabBarBorder: '#DDE1E5',
  headerBackground: '#FFFFFF',
  chatUserBubble: '#23262B',
  chatAssistantBubble: '#FFFFFF',
  chatAssistantBorder: '#DDE1E5',
  chatUserText: '#FFFFFF',
  chatAssistantText: '#1C1E21',
  statusBar: 'dark',
};

export const darkColors: AppColors = {
  background: '#111315',
  surface: '#1C1F22',
  surfaceBorder: '#3B4046',
  text: '#F5F6F7',
  textSecondary: '#B1B6BD',
  textTertiary: '#A1A7AF',
  primary: '#E7E9EC',
  onPrimary: '#111315',
  brandAccent: '#93C5FD',
  primaryLight: '#292D31',
  inputBackground: '#292D31',
  inputBorder: '#777F88',
  divider: '#3B4046',
  danger: '#FF7878',
  onDanger: '#111315',
  success: '#6DE0B2',
  tabBar: '#1C1F22',
  tabBarBorder: '#3B4046',
  headerBackground: '#1C1F22',
  chatUserBubble: '#E7E9EC',
  chatAssistantBubble: '#292D31',
  chatAssistantBorder: '#3B4046',
  chatUserText: '#111315',
  chatAssistantText: '#F5F6F7',
  statusBar: 'light',
};

/**
 * Optional Korean font files are not bundled. Keep stored font preferences but
 * render with the available Korean-capable system font until assets are licensed.
 */
export const FONT_MAP: Record<FontFamily, { regular: string; bold: string; label: string }> = {
  pretendard: { regular: APP_FONT_FAMILY, bold: APP_FONT_FAMILY, label: 'Pretendard (시스템 대체)' },
  'noto-sans': { regular: APP_FONT_FAMILY, bold: APP_FONT_FAMILY, label: 'Noto Sans KR (시스템 대체)' },
  'nanum-gothic': { regular: APP_FONT_FAMILY, bold: APP_FONT_FAMILY, label: '나눔 고딕 (시스템 대체)' },
  'nanum-myeongjo': { regular: APP_FONT_FAMILY, bold: APP_FONT_FAMILY, label: '나눔 명조 (시스템 대체)' },
};
