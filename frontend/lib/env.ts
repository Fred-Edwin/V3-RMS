export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000',
  roleDesktopPreview: process.env.NEXT_PUBLIC_ROLE_DESKTOP_PREVIEW === 'true',
  notificationsV2: process.env.NEXT_PUBLIC_NOTIFICATIONS_V2 !== 'false',
  cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN ?? '',
  firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  firebaseStorageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  firebaseMessagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  firebaseAppId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  firebaseVapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '',
};
