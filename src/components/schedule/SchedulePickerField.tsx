import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';

export function SchedulePickerField({
  label,
  accessibilityLabel,
  value,
  icon,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  value: string;
  icon: 'calendar-outline' | 'time-outline';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={value}
        onPress={onPress}
        style={[
          styles.control,
          { backgroundColor: colors.background, borderColor: colors.inputBorder },
        ]}
      >
        <Ionicons name={icon} size={19} color={colors.primary} />
        <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: uiSpacing.xxs + 2, flexGrow: 1, minWidth: 0 },
  label: uiTypography.caption,
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiSpacing.xs,
    minHeight: uiSizes.controlMinHeight,
    paddingHorizontal: uiSpacing.sm,
    paddingVertical: uiSpacing.sm,
    borderWidth: uiSizes.borderWidth,
    borderRadius: uiRadii.field,
  },
  value: { ...uiTypography.body, flex: 1, minWidth: 0, flexShrink: 1 },
});
