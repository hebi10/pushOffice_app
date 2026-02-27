/**
 * 알림 탭 리스너 – Deep Link 처리
 * TODO: Development Build 완료 후 아래 주석 해제
 */

// import Constants from 'expo-constants';
// import * as Notifications from 'expo-notifications';
// import { router } from 'expo-router';
// import { useEffect, useRef } from 'react';

/** ExpoPushTokenManager 비활성화 중 – 항상 false 반환 */
export function isNotificationsAvailable(): boolean {
  return false;
}

/** 알림 탭 시 라우팅 처리 (비활성화) */
export function useNotificationListener() {
  // TODO: Development Build 완료 후 아래 주석 해제
  // const responseListener = useRef<Notifications.EventSubscription | null>(null);
  // useEffect(() => {
  //   if (!isNotificationsAvailable()) return;
  //   try {
  //     Notifications.setNotificationHandler({
  //       handleNotification: async () => ({
  //         shouldShowAlert: true,
  //         shouldPlaySound: true,
  //         shouldSetBadge: false,
  //         shouldShowBanner: true,
  //         shouldShowList: true,
  //       }),
  //     });
  //     responseListener.current = Notifications.addNotificationResponseReceivedListener(
  //       (response) => {
  //         const route = response.notification.request.content.data?.route as string | undefined;
  //         if (route) { setTimeout(() => { router.push(route as any); }, 300); }
  //       },
  //     );
  //   } catch (e) {
  //     console.warn('[Notifications] 네이티브 모듈 초기화 실패:', e);
  //   }
  //   return () => { if (responseListener.current) { responseListener.current.remove(); } };
  // }, []);
}

/** 앱이 알림으로 시작되었는지 확인 (비활성화) */
export async function getInitialNotificationRoute(): Promise<string | null> {
  return null;
  // TODO: Development Build 완료 후 아래 주석 해제
  // if (!isNotificationsAvailable()) return null;
  // try {
  //   const response = await Notifications.getLastNotificationResponseAsync();
  //   return (response?.notification.request.content.data?.route as string) ?? null;
  // } catch {
  //   return null;
  // }
}
