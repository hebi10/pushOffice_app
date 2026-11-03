import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import type { Auth, Persistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import { ENV } from './env';
import { configuredResource, hasFirebaseConfig } from './localMode';
const config = { apiKey: ENV.FIREBASE_API_KEY, authDomain: ENV.FIREBASE_AUTH_DOMAIN,
    projectId: ENV.FIREBASE_PROJECT_ID, storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID, appId: ENV.FIREBASE_APP_ID };
export const isFirebaseConfigured = hasFirebaseConfig(config);
let auth: Auth | undefined;
/** No Firebase object, Auth restoration, or token refresh occurs on the default local path. */
export const getFirebaseApp = configuredResource(config, () => getApps().length ? getApp() : initializeApp(config));
export function getFirebaseAuth(): Auth {
    if (auth)
        return auth;
    const instance = getFirebaseApp();
    // Firebase's RN export is selected by Metro; the web declaration omits this helper.
    const rn = FirebaseAuth as typeof FirebaseAuth & {
        getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
    };
    try {
        auth = FirebaseAuth.initializeAuth(instance, { persistence: Platform.OS !== 'web' && rn.getReactNativePersistence
                ? rn.getReactNativePersistence(AsyncStorage) : undefined });
    }
    catch {
        auth = FirebaseAuth.getAuth(instance);
    }
    return auth;
}
export function getFirebaseDb() { return getFirestore(getFirebaseApp()); }
