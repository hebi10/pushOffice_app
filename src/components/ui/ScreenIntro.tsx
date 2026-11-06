import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';

export function ScreenIntro({ eyebrow, title, description, artwork, compact = false }: {
  eyebrow?: string;
  title: string;
  description?: string;
  artwork?: ImageSourcePropType;
  compact?: boolean;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, compact && styles.compactTitle, { color: colors.text }]}>{title}</Text>
        {description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text> : null}
      </View>
      {artwork && !compact && !isDark ? <Image source={artwork} style={styles.artwork} resizeMode="cover" accessible={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: uiSpacing.xs, minHeight: uiSizes.introMinHeight },
  compactContainer: { minHeight: 48 },
  compactTitle: { fontSize: 20, lineHeight: 28 },
  copy: { flex: 1, minWidth: 0, gap: uiSpacing.xxs },
  eyebrow: { ...uiTypography.caption, fontWeight: '700' },
  title: { ...uiTypography.screenTitle, letterSpacing: -0.4 },
  description: { ...uiTypography.body, fontSize: 13, lineHeight: 19 },
  artwork: { width: uiSizes.introArtworkWidth, height: uiSizes.introArtworkHeight, borderRadius: uiRadii.button },
});
