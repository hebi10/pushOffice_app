/**
 * Sign-In 화면 (옵션) – 익명 로그인이 기본이므로 최소 구현
 */
import { useTheme } from '@/src/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignInScreen() {
  const { colors } = useTheme();

  const handleAnonymousSignIn = async () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Ionicons name="clipboard-outline" size={64} color={colors.primary} style={styles.logo} />
        <Text style={[styles.title, { color: colors.text }]}>Push Office</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>로그인 없이 내 기기에서 일정을 관리하세요</Text>

        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={handleAnonymousSignIn}>
          <Text style={styles.btnText}>로컬 일정 시작하기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logo: { marginBottom: 16 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 48,
  },
  btn: {
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
