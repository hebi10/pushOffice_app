import { Redirect } from 'expo-router';

/**
 * 루트 index → (tabs)로 리다이렉트
 */
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
