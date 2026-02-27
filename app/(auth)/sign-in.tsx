/**
 * Sign-In 화면 (옵션) – 익명 로그인이 기본이므로 최소 구현
 */
import { showError } from '@/src/components/ui/toast';
import { signInAnon } from '@/src/features/auth/authService';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignInScreen() {
  const handleAnonymousSignIn = async () => {
    try {
      await signInAnon();
      router.replace('/(tabs)');
    } catch (error) {
      showError(error, '로그인에 실패했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>📋</Text>
        <Text style={styles.title}>AI Push Assistant</Text>
        <Text style={styles.subtitle}>자연어로 일정을 관리하세요</Text>

        <TouchableOpacity style={styles.btn} onPress={handleAnonymousSignIn}>
          <Text style={styles.btnText}>시작하기 (익명 로그인)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logo: { fontSize: 64, marginBottom: 16 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 48,
  },
  btn: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
