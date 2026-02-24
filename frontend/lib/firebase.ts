import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';
import { env } from './env';

const hasFirebaseConfig =
  env.firebaseApiKey.length > 0 &&
  env.firebaseAuthDomain.length > 0 &&
  env.firebaseProjectId.length > 0 &&
  env.firebaseStorageBucket.length > 0 &&
  env.firebaseMessagingSenderId.length > 0 &&
  env.firebaseAppId.length > 0;

const firebaseConfig = {
  apiKey: env.firebaseApiKey,
  authDomain: env.firebaseAuthDomain,
  projectId: env.firebaseProjectId,
  storageBucket: env.firebaseStorageBucket,
  messagingSenderId: env.firebaseMessagingSenderId,
  appId: env.firebaseAppId,
};

const firebaseApp: FirebaseApp | null = hasFirebaseConfig
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0] ?? null)
  : null;

export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
  if (!firebaseApp) {
    return null;
  }

  const supported = await isSupported();
  if (!supported) {
    return null;
  }

  return getMessaging(firebaseApp);
};
