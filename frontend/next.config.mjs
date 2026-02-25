import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Generate firebase-messaging-sw.js from the template, injecting env vars at
// build time so the service worker never contains hardcoded project credentials.
const generateFirebaseSW = () => {
  const templatePath = path.join(__dirname, 'public/firebase-messaging-sw.template.js');
  const outputPath = path.join(__dirname, 'public/firebase-messaging-sw.js');

  const firebaseConfig = JSON.stringify({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  });

  const template = fs.readFileSync(templatePath, 'utf8');
  fs.writeFileSync(outputPath, template.replace('__FIREBASE_CONFIG_JSON__', firebaseConfig));
};

generateFirebaseSW();

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Add your image host here when you have one, e.g.:
      // { protocol: 'https', hostname: 'your-bucket.s3.amazonaws.com' },
      // { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

export default nextConfig;
