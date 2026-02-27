import { Loading } from '@/src/components/Loading';
import { useAuthInit } from '@/src/features/auth/useAuthInit';
import { getInitialNotificationRoute, useNotificationListener } from '@/src/features/notifications';
import { store, useAppSelector } from '@/src/store/store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Provider } from 'react-redux';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 5 * 60 * 1000 },
  },
});

function InnerLayout() {
  useAuthInit();
  useNotificationListener();

  const { isLoading, isAuthenticated } = useAppSelector((s) => s.auth);

  // 알림으로 시작된 경우 해당 라우트로 이동
  useEffect(() => {
    if (!isAuthenticated) return;
    getInitialNotificationRoute().then((route) => {
      if (route) {
        setTimeout(() => router.push(route as any), 500);
      }
    });
  }, [isAuthenticated]);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#FAFAFA' },
          headerTintColor: '#333',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#F5F5F5' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/sign-in" options={{ title: '로그인', presentation: 'modal' }} />
        <Stack.Screen name="schedule/[id]" options={{ title: '일정 상세' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <InnerLayout />
      </QueryClientProvider>
    </Provider>
  );
}
