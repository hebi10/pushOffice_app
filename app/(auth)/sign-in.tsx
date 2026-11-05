import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AssistantButton } from '@/src/components/AssistantUI';
import { useTheme } from '@/src/contexts/ThemeContext';
import { APP_FONT_FAMILY } from '@/src/lib/typography';

export default function SignInScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Image
          source={require('@/assets/images/push-office-icon.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Push Office 앱 아이콘"
        />
        <Text style={[styles.title, { color: colors.text }]}>Push Office</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          로그인 없이 내 기기에서 일정을 관리하세요.
        </Text>
        <View style={styles.action}>
          <AssistantButton
            label="로컬 일정 시작하기"
            icon="calendar-outline"
            onPress={() => router.replace('/(tabs)')}
          />
        </View>
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          일정은 이 기기에 보관됩니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 96, height: 96, marginBottom: 20, borderRadius: 18 },
  title: { fontFamily: APP_FONT_FAMILY, fontSize: 28, fontWeight: '800', lineHeight: 36 },
  subtitle: { fontFamily: APP_FONT_FAMILY, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 10 },
  action: { width: '100%', maxWidth: 420, marginTop: 32 },
  helper: { fontFamily: APP_FONT_FAMILY, fontSize: 12, lineHeight: 19, marginTop: 16 },
});
