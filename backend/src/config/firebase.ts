import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { env } from './env';

interface RawServiceAccount {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

const parseServiceAccount = (): ServiceAccount => {
  try {
    const parsed = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as RawServiceAccount;
    return {
      projectId: parsed.projectId ?? parsed.project_id,
      clientEmail: parsed.clientEmail ?? parsed.client_email,
      privateKey: parsed.privateKey ?? parsed.private_key,
    };
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be a valid JSON object');
  }
};

const ensureFirebaseApp = (): App | null => {
  if (env.NODE_ENV === 'test') {
    return null;
  }

  if (getApps().length > 0) {
    return getApps()[0] as App;
  }

  const serviceAccount = parseServiceAccount();

  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON is missing one or more required fields: projectId, clientEmail, privateKey',
    );
  }

  return initializeApp({
    credential: cert(serviceAccount),
  });
};

export const firebaseApp = ensureFirebaseApp();
export const firebaseMessaging: Messaging | null = firebaseApp ? getMessaging(firebaseApp) : null;
