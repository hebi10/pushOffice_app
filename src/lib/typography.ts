import { Platform } from 'react-native';

// A platform-available Korean-capable sans-serif. A custom Pretendard font file
// is not bundled; using a missing font-family name would silently fall back.
export const APP_FONT_FAMILY = Platform.select({
  android: 'sans-serif',
  ios: 'System',
  default: 'sans-serif',
}) ?? 'sans-serif';
