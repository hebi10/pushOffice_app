/**
 * 빈 상태 표시
 */
import { useTheme } from '@/src/contexts/ThemeContext';
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
      <Ionicons name="calendar-outline" size={36} color={colors.textTertiary} />
      <Text style={[styles.text, { color: colors.textTertiary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  text: {
    fontSize: 14,
    marginTop: 10,
  },
});
