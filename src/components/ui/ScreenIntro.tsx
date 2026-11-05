import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';
import { uiRadii, uiSpacing, uiTypography } from '@/src/lib/designTokens';

export function ScreenIntro({ eyebrow, title, description, artwork }: {
  eyebrow?: string;
  title: string;
  description?: string;
  artwork?: ImageSourcePropType;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text> : null}
      </View>
      {artwork && !isDark ? <Image source={artwork} style={styles.artwork} resizeMode="cover" accessible={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: uiSpacing.xs, minHeight: 104 },
  copy: { flex: 1, minWidth: 0, gap: uiSpacing.xxs + 1 },
  eyebrow: { ...uiTypography.caption, fontWeight: '700' },
  title: { ...uiTypography.screenTitle, lineHeight: 33, letterSpacing: -0.5 },
  description: { ...uiTypography.body, fontSize: 13, lineHeight: 19 },
  artwork: { width: 104, height: 88, borderRadius: uiRadii.button },
});
