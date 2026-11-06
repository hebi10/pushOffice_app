import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';
import { uiSizes, uiSpacing, uiTypography } from '@/src/lib/designTokens';

export function AppBrandHeader() {
  const { colors } = useTheme();

  return (
    <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="Push Office">
      <Image
        source={require('@/assets/images/push-office-mark.png')}
        style={styles.logo}
        resizeMode="contain"
        accessible={false}
      />
      <Text style={[styles.brandText, { color: colors.text }]} numberOfLines={1}>
        PushOffice
      </Text>
    </View>
  );
}

export function NotificationSettingsAction() {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="알림 설정으로 이동"
      onPress={() => router.navigate('/(tabs)/settings')}
      activeOpacity={0.8}
      style={styles.action}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiSpacing.xs,
    minWidth: 0,
  },
  logo: {
    width: uiSizes.brandMark,
    height: uiSizes.brandMark,
  },
  brandText: {
    ...uiTypography.brand,
    flexShrink: 1,
  },
  action: {
    minWidth: uiSizes.touchMinHeight,
    minHeight: uiSizes.touchMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: uiSpacing.xs,
  },
});
