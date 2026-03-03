/**
 * 테마 시스템 – 라이트 / 다크 색상 정의
 */
import type { FontFamily } from '../types';

export interface AppColors {
  background: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  primaryLight: string;
  inputBackground: string;
  inputBorder: string;
  divider: string;
  danger: string;
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
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceBorder: '#E5E5E5',
  text: '#222222',
  textSecondary: '#666666',
  textTertiary: '#999999',
  primary: '#4A90D9',
  primaryLight: '#E8F0FE',
  inputBackground: '#F0F0F0',
  inputBorder: '#DDDDDD',
  divider: '#EEEEEE',
  danger: '#E55555',
  success: '#27AE60',
  tabBar: '#FAFAFA',
  tabBarBorder: '#E5E5E5',
  headerBackground: '#FAFAFA',
  chatUserBubble: '#4A90D9',
  chatAssistantBubble: '#FFFFFF',
  chatAssistantBorder: '#DDDDDD',
  chatUserText: '#FFFFFF',
  chatAssistantText: '#333333',
  statusBar: 'dark',
};

export const darkColors: AppColors = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceBorder: '#333333',
  text: '#E0E0E0',
  textSecondary: '#AAAAAA',
  textTertiary: '#777777',
  primary: '#5B9FE6',
  primaryLight: '#1E3A5F',
  inputBackground: '#2A2A2A',
  inputBorder: '#444444',
  divider: '#333333',
  danger: '#FF6B6B',
  success: '#2ECC71',
  tabBar: '#1A1A1A',
  tabBarBorder: '#333333',
  headerBackground: '#1A1A1A',
  chatUserBubble: '#5B9FE6',
  chatAssistantBubble: '#2A2A2A',
  chatAssistantBorder: '#444444',
  chatUserText: '#FFFFFF',
  chatAssistantText: '#E0E0E0',
  statusBar: 'light',
};

/** 폰트 패밀리 매핑 */
export const FONT_MAP: Record<FontFamily, { regular: string; bold: string; label: string }> = {
  pretendard: { regular: 'Pretendard-Regular', bold: 'Pretendard-Bold', label: 'Pretendard' },
  'noto-sans': { regular: 'NotoSansKR-Regular', bold: 'NotoSansKR-Bold', label: 'Noto Sans KR' },
  'nanum-gothic': { regular: 'NanumGothic', bold: 'NanumGothic-Bold', label: '나눔 고딕' },
  'nanum-myeongjo': { regular: 'NanumMyeongjo', bold: 'NanumMyeongjo-Bold', label: '나눔 명조' },
};
