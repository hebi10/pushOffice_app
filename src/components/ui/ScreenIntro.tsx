import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';

export function ScreenIntro({ eyebrow, title, description, artwork, compact = false, featured = false }: {
  eyebrow?: string;
  title: string;
  description?: string;
  artwork?: ImageSourcePropType;
  compact?: boolean;
  featured?: boolean;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.container, compact && styles.compactContainer, featured && styles.featuredContainer]}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, compact && styles.compactTitle, featured && styles.featuredTitle, { color: colors.text }]}>{title}</Text>
        {description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text> : null}
      </View>
      {artwork && !compact && !isDark ? <Image source={artwork} style={[styles.artwork, featured && styles.featuredArtwork]} resizeMode={featured ? "contain" : "cover"} accessible={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: uiSpacing.xs, minHeight: uiSizes.introMinHeight },
  compactContainer: { minHeight: 48 },
  compactTitle: { fontSize: 20, lineHeight: 28 },
  featuredContainer: { minHeight: 108, gap: uiSpacing.sm },
  featuredTitle: { fontSize: 24, lineHeight: 30 },
  featuredArtwork: { width: 124, height: 104, borderRadius: 0 },
  copy: { flex: 1, minWidth: 0, gap: uiSpacing.xxs },
  eyebrow: { ...uiTypography.caption, fontWeight: '700' },
  title: { ...uiTypography.screenTitle, letterSpacing: -0.4 },
  description: { ...uiTypography.body, fontSize: 13, lineHeight: 19 },
  artwork: { width: uiSizes.introArtworkWidth, height: uiSizes.introArtworkHeight, borderRadius: uiRadii.button },
});
