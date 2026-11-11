import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';

export function ScreenIntro({ eyebrow, title, description, artwork, graphicIcon, monochromeArtwork = false, compact = false, featured = false, dense = false }: {
  eyebrow?: string;
  title: string;
  description?: string;
  artwork?: ImageSourcePropType;
  graphicIcon?: React.ComponentProps<typeof Ionicons>['name'];
  monochromeArtwork?: boolean;
  compact?: boolean;
  featured?: boolean;
  dense?: boolean;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.container, compact && styles.compactContainer, featured && styles.featuredContainer, dense && styles.denseContainer]}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, compact && styles.compactTitle, featured && styles.featuredTitle, dense && styles.denseTitle, { color: colors.text }]}>{title}</Text>
        {description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text> : null}
      </View>
      {graphicIcon && !compact ? (
        <View style={[styles.flatGraphic, featured && styles.featuredGraphic]} accessible={false}>
          <Ionicons name={graphicIcon} size={featured ? 48 : 32} color={colors.primary} />
        </View>
      ) : artwork && !compact && monochromeArtwork ? (
        <Image
          source={artwork}
          style={[styles.artwork, featured && styles.featuredArtwork, dense && styles.denseArtwork, { tintColor: colors.primary }]}
          resizeMode="contain"
          accessible={false}
        />
      ) : artwork && !compact && !isDark ? (
        <Image source={artwork} style={[styles.artwork, featured && styles.featuredArtwork, dense && styles.denseArtwork]} resizeMode={featured ? "contain" : "cover"} accessible={false} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: uiSpacing.xs, minHeight: uiSizes.introMinHeight },
  compactContainer: { minHeight: 48 },
  compactTitle: { fontSize: 20, lineHeight: 28 },
  featuredContainer: { minHeight: 108, gap: uiSpacing.sm },
  denseContainer: { minHeight: 82, gap: uiSpacing.xs },
  denseTitle: { fontSize: 22, lineHeight: 28 },
  denseArtwork: { width: 90, height: 78 },
  featuredTitle: { fontSize: 24, lineHeight: 30 },
  featuredArtwork: { width: 124, height: 104, borderRadius: 0 },
  flatGraphic: { width: uiSizes.introArtworkWidth, height: uiSizes.introArtworkHeight, alignItems: 'center', justifyContent: 'center' },
  featuredGraphic: { width: 124, height: 104 },
  copy: { flex: 1, minWidth: 0, gap: uiSpacing.xxs },
  eyebrow: { ...uiTypography.caption, fontWeight: '700' },
  title: { ...uiTypography.screenTitle, letterSpacing: -0.4 },
  description: { ...uiTypography.body, fontSize: 13, lineHeight: 19 },
  artwork: { width: uiSizes.introArtworkWidth, height: uiSizes.introArtworkHeight, borderRadius: uiRadii.field },
});
