/**
 * 알림 권한 요청
 * TODO: Development Build 완료 후 아래 주석 해제
 */

// import * as Device from 'expo-device';
// import * as Notifications from 'expo-notifications';
// import { Alert, Platform } from 'react-native';
// import { isNotificationsAvailable } from './listener';

/** 알림 권한 요청 (비활성화) */
export async function requestNotificationPermission(): Promise<boolean> {
  console.warn('[Notifications] 알림 기능이 비활성화되어 있습니다. Development Build를 사용하세요.');
  return false;
  // TODO: Development Build 완료 후 아래 주석 해제
  // if (!isNotificationsAvailable()) {
  //   console.warn('[Notifications] Expo Go에서는 알림이 지원되지 않습니다. Development Build를 사용하세요.');
  //   return false;
  // }
  // if (!Device.isDevice) {
  //   Alert.alert('알림', '실 기기에서만 알림이 지원됩니다.');
  //   return false;
  // }
  // try {
  //   const { status: existingStatus } = await Notifications.getPermissionsAsync();
  //   let finalStatus = existingStatus;
  //   if (existingStatus !== 'granted') {
  //     const { status } = await Notifications.requestPermissionsAsync();
  //     finalStatus = status;
  //   }
  //   if (finalStatus !== 'granted') {
  //     Alert.alert('알림 권한', '일정 알림을 받으려면 알림 권한을 허용해 주세요.');
  //     return false;
  //   }
  //   if (Platform.OS === 'android') {
  //     await Notifications.setNotificationChannelAsync('schedules', { name: '일정 알림', importance: Notifications.AndroidImportance.HIGH });
  //     await Notifications.setNotificationChannelAsync('briefing', { name: '일일 브리핑', importance: Notifications.AndroidImportance.DEFAULT });
  //   }
  //   return true;
  // } catch (e) {
  //   console.warn('[Notifications] 권한 요청 실패:', e);
  //   return false;
  // }
}
