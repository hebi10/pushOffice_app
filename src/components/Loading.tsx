/**
 * 로딩 인디케이터
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function Loading() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A90D9" />
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
