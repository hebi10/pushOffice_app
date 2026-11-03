import { useCallback, useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { router, usePathname, useRootNavigationState, type Href } from 'expo-router';
import { createLaunchIntentController } from './launchIntent';
import { getInitialNotificationRoute } from './listener';
/** Capture cold and warm links even while local identity/settings are being restored. */
export function useLaunchIntent(localReady: boolean) {
  const pathname = usePathname();
  const rootState = useRootNavigationState();
  const current = useRef(pathname);
  current.current = pathname;
  const readiness = useRef({localReady, navigationReady: !!rootState?.key});
  readiness.current = {localReady, navigationReady: !!rootState?.key};
  const controller = useRef<ReturnType<typeof createLaunchIntentController> | null>(null);
  useEffect(() => {
    const launch = createLaunchIntentController({currentPath: () => current.current, replace: route => router.replace(route as Href)});
    controller.current = launch;
    // Subscribe first, so a newer onNewIntent event wins over a slow initial-URL response.
    const subscription = Linking.addEventListener('url', ({url}) => launch.receive(url));
    launch.setReadiness(readiness.current);
    void launch.initialize(() => Linking.getInitialURL(), getInitialNotificationRoute).catch(console.warn);
    return () => { subscription.remove(); launch.dispose(); controller.current = null; };
  }, []);
  useEffect(() => { controller.current?.setReadiness(readiness.current); }, [localReady, rootState?.key, pathname]);
  return useCallback((route: string) => controller.current?.receive(route), []);
}
