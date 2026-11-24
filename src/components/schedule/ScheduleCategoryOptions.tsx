import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';
import { uiRadii, uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';
import { SCHEDULE_CATEGORIES, type ScheduleCategory } from '@/src/features/schedules/scheduleCategories.mjs';

export type ScheduleCategoryFilter = ScheduleCategory | 'all' | null;

export function ScheduleCategoryOptions({ value, onChange, includeAll = false }: {
  value: ScheduleCategoryFilter;
  onChange: (category: ScheduleCategoryFilter) => void;
  includeAll?: boolean;
}) {
  const { colors } = useTheme();
  const options = includeAll ? [{ id: 'all' as const, label: '전체' }, ...SCHEDULE_CATEGORIES] : SCHEDULE_CATEGORIES;
  return (
    <View style={styles.group} accessibilityRole="radiogroup">
      {options.map(option => (
        <TouchableOpacity
          key={option.id ?? 'uncategorized'}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ checked: value === option.id }}
          activeOpacity={0.8}
          onPress={() => onChange(option.id)}
          style={[styles.option, {
            borderColor: value === option.id ? colors.primary : colors.inputBorder,
            backgroundColor: value === option.id ? colors.primaryLight : colors.surface,
          }]}
        >
          <Text style={[uiTypography.body, { color: colors.text, flexShrink: 1,
            fontWeight: value === option.id ? '700' : '400' }]}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: uiSpacing.xs },
  option: {
    minHeight: uiSizes.touchMinHeight, minWidth: 66,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: uiSpacing.sm, paddingVertical: uiSpacing.xs,
    borderWidth: uiSizes.borderWidth, borderRadius: uiRadii.field,
  },
});
