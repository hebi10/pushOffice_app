import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_FONT_FAMILY } from '@/src/lib/typography';
import { useTheme } from '../contexts/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function AssistantCard({ title, subtitle, icon, children }: {
  title?: string;
  subtitle?: string;
  icon?: IconName;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
      {title ? (
        <View style={styles.cardHeader}>
          {icon ? <Ionicons name={icon} size={20} color={colors.primary} /> : null}
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {subtitle ? <Text style={[styles.helper, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
          </View>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function AssistantButton({ label, onPress, secondary = false, busy = false, icon = 'add' }: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  busy?: boolean;
  icon?: IconName;
}) {
  const { colors, isDark } = useTheme();
  const color = secondary ? colors.primary : isDark ? colors.background : '#FFFFFF';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      activeOpacity={0.8}
      disabled={busy}
      onPress={onPress}
      style={[styles.button, {
        backgroundColor: secondary ? colors.surface : colors.primary,
        borderColor: secondary ? colors.inputBorder : colors.primary,
      }]}
    >
      {busy ? <ActivityIndicator color={color} /> : <Ionicons name={icon} size={19} color={color} />}
      <Text style={[styles.buttonLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const assistantStyles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 44, gap: 14 },
  heading: { fontFamily: APP_FONT_FAMILY, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, lineHeight: 34 },
  subtitle: { fontFamily: APP_FONT_FAMILY, fontSize: 14, lineHeight: 21 },
  body: { fontFamily: APP_FONT_FAMILY, fontSize: 15, lineHeight: 23 },
  caption: { fontFamily: APP_FONT_FAMILY, fontSize: 12, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48 },
  input: { fontFamily: APP_FONT_FAMILY, borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontSize: 16, minHeight: 48 },
});

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, borderRadius: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { flex: 1, gap: 4 },
  title: { fontFamily: APP_FONT_FAMILY, fontSize: 17, fontWeight: '700', lineHeight: 23 },
  helper: { fontFamily: APP_FONT_FAMILY, fontSize: 12, lineHeight: 18 },
  button: {
    minHeight: 50, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12,
    borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  buttonLabel: { fontFamily: APP_FONT_FAMILY, fontWeight: '700', fontSize: 15, lineHeight: 21, flexShrink: 1, textAlign: 'center' },
});
