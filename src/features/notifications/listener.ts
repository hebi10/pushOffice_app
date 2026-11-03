/**
 * 알림 탭 리스너 – Deep Link 처리
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

/** 알림 탭 시 라우팅 처리 */
export function useNotificationListener(onRoute?: (route: string) => void) {
  const routeHandler = useRef(onRoute);
  routeHandler.current = onRoute;
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const route = response.notification.request.content.data?.route as string | undefined;
          if (route) {
            if (routeHandler.current) routeHandler.current(route);
            else router.replace(route as never);
            void Notifications.clearLastNotificationResponseAsync().catch(console.warn);
          }
        },
      );
    } catch (e) {
      console.warn('[Notifications] 리스너 초기화 실패:', e);
    }

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);
}

/** 앱이 알림으로 시작되었는지 확인 */
export async function getInitialNotificationRoute(): Promise<string | null> {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    const route = (response?.notification.request.content.data?.route as string) ?? null;
    if (route) await Notifications.clearLastNotificationResponseAsync();
    return route;
  } catch {
    return null;
  }
}
