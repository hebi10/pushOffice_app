/**
 * Expo Push Token 등록/관리
 */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { arrayUnion, doc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../../lib/firebase';

/** Push Token 획득 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[PushToken] 실 기기에서만 푸시 토큰을 발급받을 수 있습니다.');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Android 채널 설정
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('schedules', {
        name: '일정 알림',
        importance: Notifications.AndroidImportance.HIGH,
      });
      await Notifications.setNotificationChannelAsync('briefing', {
        name: '브리핑',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (e) {
    console.warn('[PushToken] 토큰 발급 실패:', e);
    return null;
  }
}

/** Firestore users 문서에 push token 저장 (중복 방지) */
export async function registerPushToken(uid: string): Promise<string | null> {
  const token = await getExpoPushToken();
  if (!token) return null;

  try {
    const ref = doc(db, 'users', uid);
    await setDoc(ref, { expoPushTokens: arrayUnion(token) }, { merge: true });
    return token;
  } catch (e) {
    console.warn('[PushToken] Firestore 저장 실패:', e);
    return token; // 토큰은 반환
  }
}
