/**
 * 알림 권한 요청
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { showNotice } from '@/src/components/ui/toast';

/** 알림 권한 요청 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      showNotice('알림 권한', '알림을 받으려면 권한을 허용해 주세요.');
      return false;
    }
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
    return true;
  } catch (e) {
    console.warn('[Notifications] 권한 요청 실패:', e);
    return false;
  }
}
