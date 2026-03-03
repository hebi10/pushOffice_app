/**
 * 로딩 인디케이터
 */
import { useTheme } from '@/src/contexts/ThemeContext';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
