/**
 * 공통 유틸리티 – 에러 Alert 토스트
 */
import { Alert, Platform, ToastAndroid } from 'react-native';

export function showToast(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('알림', message);
  }
}

export function showError(error: unknown, fallback = '오류가 발생했습니다.'): void {
  const msg = error instanceof Error ? error.message : fallback;
  Alert.alert('오류', msg);
}

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
): void {
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: '확인', onPress: onConfirm },
  ]);
}
