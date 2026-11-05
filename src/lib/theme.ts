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

export const lightColors: AppColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceBorder: '#E2E8F0',
  text: '#1F2937',
  textSecondary: '#64748B',
  textTertiary: '#6B7280',
  primary: '#2563EB',
  onPrimary: '#FFFFFF',
  brandAccent: '#4B94DC',
  primaryLight: '#EFF6FF',
  inputBackground: '#F1F5F9',
  inputBorder: '#CBD5E1',
  divider: '#E2E8F0',
  danger: '#B91C1C',
  onDanger: '#FFFFFF',
  success: '#27AE60',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  headerBackground: '#FFFFFF',
  chatUserBubble: '#2563EB',
  chatAssistantBubble: '#FFFFFF',
  chatAssistantBorder: '#CBD5E1',
  chatUserText: '#FFFFFF',
  chatAssistantText: '#334155',
  statusBar: 'dark',
};

export const darkColors: AppColors = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceBorder: '#334155',
  text: '#E0E0E0',
  textSecondary: '#AAAAAA',
  textTertiary: '#94A3B8',
  primary: '#5B9FE6',
  onPrimary: '#121212',
  brandAccent: '#93C5FD',
  primaryLight: '#1E3A5F',
  inputBackground: '#2A2A2A',
  inputBorder: '#444444',
  divider: '#334155',
  danger: '#FF6B6B',
  onDanger: '#121212',
  success: '#2ECC71',
  tabBar: '#1A1A1A',
  tabBarBorder: '#334155',
  headerBackground: '#1A1A1A',
  chatUserBubble: '#5B9FE6',
  chatAssistantBubble: '#2A2A2A',
  chatAssistantBorder: '#444444',
  chatUserText: '#121212',
  chatAssistantText: '#E0E0E0',
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
