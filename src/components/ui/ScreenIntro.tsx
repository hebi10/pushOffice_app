import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';
import { APP_FONT_FAMILY } from '@/src/lib/typography';

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
  container: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 104 },
  copy: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: { fontFamily: APP_FONT_FAMILY, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  title: { fontFamily: APP_FONT_FAMILY, fontSize: 26, fontWeight: '800', lineHeight: 33, letterSpacing: -0.5 },
  description: { fontFamily: APP_FONT_FAMILY, fontSize: 13, lineHeight: 19 },
  artwork: { width: 104, height: 88, borderRadius: 12 },
});
