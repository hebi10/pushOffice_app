import { Loading } from '@/src/components/Loading';
import { ThemeProvider, useTheme } from '@/src/contexts/ThemeContext';
import { useNativeAssistantSync } from '@/src/features/notifications/useNativeAssistant';
import { useAuthInit } from '@/src/features/auth/useAuthInit';
import { useLaunchIntent } from '@/src/features/notifications/useLaunchIntent';
import { useNotificationListener } from '@/src/features/notifications';
import { store, useAppSelector } from '@/src/store/store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 5 * 60 * 1000 },
  },
});

function InnerLayout() {
  useAuthInit();
  useNativeAssistantSync();
  const { isLoading, isAuthenticated } = useAppSelector((s) => s.auth);
  const { colors } = useTheme();

  const receiveLaunchRoute = useLaunchIntent(!isLoading && isAuthenticated);
  useNotificationListener(receiveLaunchRoute);

  return (
    <>
      <StatusBar style={colors.statusBar} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.headerBackground },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/sign-in" options={{ title: '로그인', presentation: 'modal' }} />
        <Stack.Screen name="schedule/[id]" options={{ title: '일정 상세' }} />
      </Stack>
      {isLoading && <View style={StyleSheet.absoluteFill} accessibilityViewIsModal><Loading /></View>}
    </>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider>
            <InnerLayout />
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
}
