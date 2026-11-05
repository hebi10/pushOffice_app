import { useTheme } from '@/src/contexts/ThemeContext';
import { uiSpacing, uiTypography } from '@/src/lib/designTokens';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  message?: string;
}

export function EmptyState({ message = '일정이 없습니다.' }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Ionicons name="calendar-outline" size={36} color={colors.textSecondary} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: uiSpacing.xxl + uiSpacing.md,
    paddingHorizontal: uiSpacing.md,
    gap: uiSpacing.xs + 2,
  },
  text: { ...uiTypography.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
