/**
 * 빈 상태 표시
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  message?: string;
}

export function EmptyState({ message = '일정이 없습니다.' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📭</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  icon: {
    fontSize: 40,
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    color: '#999',
  },
});
