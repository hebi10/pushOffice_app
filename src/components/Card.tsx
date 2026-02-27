/**
 * 카드 컴포넌트 – 최소 R12 padding 12~16
 */
import React, { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

type CardProps = PropsWithChildren<{
  style?: ViewStyle;
}>;

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginVertical: 6,
    marginHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
  },
});
