import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';
import { useTheme } from '../contexts/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type AssistantButtonVariant = 'primary' | 'secondary' | 'destructive';

export function AssistantCard({ title, subtitle, icon, compact = false, flat = false, children }: {
  title?: string;
  subtitle?: string;
  icon?: IconName;
  compact?: boolean;
  flat?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, compact && styles.compactCard, flat && styles.flatCard, { backgroundColor: flat ? colors.background : colors.surface, borderColor: colors.surfaceBorder }]}>
      {title ? (
        <View style={styles.cardHeader}>
          {icon ? <Ionicons name={icon} size={20} color={colors.textSecondary} /> : null}
          <View style={styles.headerText}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
            {subtitle ? <Text style={[styles.helper, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
          </View>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function AssistantButton({
  label,
  onPress,
  secondary = false,
  variant,
  busy = false,
  disabled = false,
  icon = 'add',
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  variant?: AssistantButtonVariant;
  busy?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  const resolved = variant ?? (secondary ? 'secondary' : 'primary');
  const foreground = disabled
    ? colors.textSecondary
    : resolved === 'secondary' ? colors.text : resolved === 'destructive' ? colors.onDanger : colors.onPrimary;
  const background = disabled
    ? colors.inputBackground
    : resolved === 'secondary' ? colors.surface : resolved === 'destructive' ? colors.danger : colors.primary;
  const border = disabled || resolved === 'secondary' ? colors.inputBorder : background;
  const inactive = disabled || busy;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      activeOpacity={0.8}
      disabled={inactive}
      onPress={onPress}
      style={[styles.button, {
        backgroundColor: background,
        borderColor: border,
      }]}
    >
      {busy
        ? <ActivityIndicator color={foreground} />
        : <Ionicons name={icon} size={19} color={foreground} />}
      <Text style={[styles.buttonLabel, { color: foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function AssistantTextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline,
  maxLength,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: NonNullable<TextInputProps['onChangeText']>;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  multiline?: boolean;
  maxLength?: number;
  autoCapitalize?: TextInputProps['autoCapitalize'];
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[assistantStyles.caption, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.primary}
        style={[assistantStyles.input, {
          color: colors.text,
          backgroundColor: colors.inputBackground,
          borderColor: colors.inputBorder,
        }]}
      />
    </View>
  );
}

export function SettingRow({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
}: {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.settingRow, { opacity: disabled ? 0.8 : 1 }]}>
      <View style={styles.settingCopy}>
        <Text style={[assistantStyles.body, { color: colors.text }]}>{title}</Text>
        {description ? (
          <Text style={[assistantStyles.caption, { color: colors.textSecondary }]}>{description}</Text>
        ) : null}
      </View>
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

export const assistantStyles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: uiSizes.screenGutter,
    paddingTop: uiSpacing.sm,
    paddingBottom: uiSpacing.xxl + uiSpacing.sm,
    gap: uiSpacing.sm,
  },
  heading: { ...uiTypography.screenTitle, letterSpacing: -0.5 },
  subtitle: { ...uiTypography.body, fontSize: 14, lineHeight: 21 },
  body: uiTypography.body,
  caption: uiTypography.caption,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: uiSpacing.sm,
    minHeight: uiSizes.touchMinHeight,
  },
  input: {
    fontFamily: uiTypography.body.fontFamily,
    borderWidth: uiSizes.borderWidth,
    borderRadius: uiRadii.field,
    paddingHorizontal: uiSpacing.sm + 1,
    paddingVertical: uiSpacing.sm,
    fontSize: 16,
    minHeight: uiSizes.touchMinHeight,
  },
});

const styles = StyleSheet.create({
  card: {
    padding: uiSizes.cardPadding,
    borderWidth: uiSizes.borderWidth,
    borderRadius: uiRadii.card,
    gap: uiSpacing.sm,
  },
  compactCard: { paddingVertical: uiSpacing.sm, gap: uiSpacing.xs },
  flatCard: { padding: 0, borderWidth: 0, borderRadius: 0, gap: uiSpacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: uiSpacing.xs },
  headerText: { flex: 1, gap: uiSpacing.xxs },
  title: uiTypography.sectionTitle,
  helper: uiTypography.caption,
  button: {
    minHeight: uiSizes.controlMinHeight,
    paddingHorizontal: uiSpacing.sm + 2,
    paddingVertical: uiSpacing.sm,
    borderRadius: uiRadii.button,
    borderWidth: uiSizes.borderWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiSpacing.xs,
  },
  buttonLabel: { ...uiTypography.button, flexShrink: 1, textAlign: 'center' },
  fieldGroup: { gap: uiSpacing.xxs + 2 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiSpacing.sm,
    minHeight: uiSizes.touchMinHeight,
  },
  settingCopy: { flex: 1, gap: uiSpacing.xxs },
});
