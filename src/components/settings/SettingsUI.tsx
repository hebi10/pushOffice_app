import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function RowIcon({ name }: { name: IconName }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
      <Ionicons name={name} color={colors.primary} size={20} />
    </View>
  );
}

function RowCopy({ title, description }: { title: string; description?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.copy}>
      <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
      {description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text> : null}
    </View>
  );
}

export function SettingsGroup({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon: IconName;
  description?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
      <View style={[styles.groupHeader, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name={icon} color={colors.primary} size={20} />
        <View style={styles.copy}>
          <Text style={[styles.groupTitle, { color: colors.text }]}>{title}</Text>
          {description ? <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text> : null}
        </View>
      </View>
      <View style={styles.groupContent}>{children}</View>
    </View>
  );
}

export function SettingsToggleRow({
  icon,
  title,
  description,
  value,
  onValueChange,
  disabled = false,
}: {
  icon: IconName;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { opacity: disabled ? 0.55 : 1 }]}>
      <RowIcon name={icon} />
      <RowCopy title={title} description={description} />
      <Switch
        accessibilityLabel={title}
        accessibilityState={{ disabled }}
        disabled={disabled}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.inputBorder, true: colors.primaryLight }}
        thumbColor={value ? colors.primary : colors.surfaceBorder}
      />
    </View>
  );
}

export function SettingsActionRow({
  icon,
  title,
  description,
  status,
  onPress,
  busy = false,
  expanded,
}: {
  icon: IconName;
  title: string;
  description?: string;
  status?: string;
  onPress: () => void;
  busy?: boolean;
  expanded?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ disabled: busy, busy, expanded }}
      disabled={busy}
      onPress={onPress}
      style={[styles.row, { opacity: busy ? 0.6 : 1 }]}
    >
      <RowIcon name={icon} />
      <RowCopy title={title} description={description} />
      {status ? <Text style={[styles.status, { color: colors.primary }]}>{status}</Text> : null}
      {busy
        ? <ActivityIndicator color={colors.primary} size="small" />
        : <Ionicons name={expanded === undefined ? 'chevron-forward' : expanded ? 'chevron-up' : 'chevron-down'} color={colors.textSecondary} size={18} />}
    </Pressable>
  );
}

export function SettingsStatusRow({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.row}>
      <RowIcon name={icon} />
      <RowCopy title={title} description={description} />
    </View>
  );
}

export function SettingsChoiceRow({
  icon,
  title,
  selected,
  onPress,
}: {
  icon: IconName;
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={styles.row}
    >
      <RowIcon name={icon} />
      <RowCopy title={title} />
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? colors.primary : colors.textTertiary}
      />
    </Pressable>
  );
}

export function SettingsNote({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.note, { color: colors.textSecondary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  group: {
    borderWidth: uiSizes.borderWidth,
    borderRadius: uiRadii.card,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiSpacing.sm,
    paddingHorizontal: uiSpacing.md,
    paddingVertical: uiSpacing.sm,
  },
  groupTitle: { ...uiTypography.sectionTitle },
  groupContent: { paddingHorizontal: uiSpacing.sm, paddingVertical: uiSpacing.xs, gap: uiSpacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiSpacing.sm,
    minHeight: 56,
    paddingHorizontal: uiSpacing.xs,
    paddingVertical: uiSpacing.sm,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: uiRadii.field,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: { flex: 1, minWidth: 0, gap: uiSpacing.xxs },
  rowTitle: { ...uiTypography.body, fontWeight: '600' },
  description: { ...uiTypography.caption, lineHeight: 19, flexShrink: 1 },
  status: { ...uiTypography.caption, fontWeight: '700', maxWidth: 92, textAlign: 'right' },
  note: { ...uiTypography.caption, lineHeight: 19, paddingHorizontal: uiSpacing.xs, paddingVertical: uiSpacing.xs },
});
