import { APP_FONT_FAMILY } from './typography';

export const uiSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const uiRadii = {
  field: 6,
  button: 8,
  card: 10,
  dialog: 10,
} as const;

export const uiSizes = {
  screenGutter: 16,
  brandMark: 32,
  introMinHeight: 88,
  introArtworkWidth: 88,
  introArtworkHeight: 74,
  cardPadding: 16,
  controlMinHeight: 50,
  touchMinHeight: 48,
  dialogMaxWidth: 440,
  borderWidth: 1,
} as const;

export const uiTypography = {
  brand: { fontFamily: APP_FONT_FAMILY, fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  screenTitle: { fontFamily: APP_FONT_FAMILY, fontSize: 25, lineHeight: 32, fontWeight: '800' as const },
  dialogTitle: { fontFamily: APP_FONT_FAMILY, fontSize: 20, lineHeight: 28, fontWeight: '700' as const },
  sectionTitle: { fontFamily: APP_FONT_FAMILY, fontSize: 17, lineHeight: 23, fontWeight: '700' as const },
  body: { fontFamily: APP_FONT_FAMILY, fontSize: 15, lineHeight: 23 },
  button: { fontFamily: APP_FONT_FAMILY, fontSize: 15, lineHeight: 21, fontWeight: '700' as const },
  caption: { fontFamily: APP_FONT_FAMILY, fontSize: 12, lineHeight: 18 },
} as const;
