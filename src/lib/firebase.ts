import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import { ENV } from './env';

const firebaseConfig = {
  apiKey: ENV.FIREBASE_API_KEY,
  authDomain: ENV.FIREBASE_AUTH_DOMAIN,
  projectId: ENV.FIREBASE_PROJECT_ID,
  storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// React Native에서 Auth persistence 설정
let auth: ReturnType<typeof initializeAuth> | ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: Platform.OS !== 'web'
      ? getReactNativePersistence(AsyncStorage)
      : undefined,
  });
} catch {
  // 이미 초기화된 경우
  auth = getAuth(app);
}

const db = getFirestore(app);

export { app, auth, db };
