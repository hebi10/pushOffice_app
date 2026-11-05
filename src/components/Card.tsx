import { useTheme } from '@/src/contexts/ThemeContext';
import { uiRadii, uiSizes } from '@/src/lib/designTokens';
import React, { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

type CardProps = PropsWithChildren<{ style?: ViewStyle }>;

export function Card({ children, style }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: uiRadii.card,
    padding: uiSizes.cardPadding,
    borderWidth: uiSizes.borderWidth,
    marginVertical: 0,
    marginHorizontal: 0,
  },
});
