import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Generate firebase-messaging-sw.js from the template, injecting env vars at
// build time so the service worker never contains hardcoded project credentials.
const generateFirebaseSW = () => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  // Skip generation if env vars are missing — the committed fallback file is used instead.
  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    console.warn('[next.config] Firebase env vars missing — skipping firebase-messaging-sw.js generation');
    return;
  }

  const templatePath = path.join(__dirname, 'public/firebase-messaging-sw.template.js');
  const outputPath = path.join(__dirname, 'public/firebase-messaging-sw.js');

  const firebaseConfig = JSON.stringify({ apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId });

  const template = fs.readFileSync(templatePath, 'utf8');
  fs.writeFileSync(outputPath, template.replace('__FIREBASE_CONFIG_JSON__', firebaseConfig));
};

generateFirebaseSW();

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  async headers() {
    return [
      {
        // Service workers must never be served from CDN/browser cache.
        // Stale service workers block FCM token registration.
        source: '/firebase-messaging-sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
