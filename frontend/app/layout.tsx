import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter, Playfair_Display } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { SessionBootstrap } from '@/components/app/SessionBootstrap';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { OfflineBanner } from '@/components/ui/OfflineBanner';

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

// Wordmark-only — the PourReveal loading mark's italic serif treatment,
// approved in Paper (Loading mark explorations, "1 · Pour reveal" refined).
// Not part of the WDS token system; scoped narrowly since it has exactly
// one consumer.
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  style: ['italic'],
  weight: ['600'],
  variable: '--font-wordmark',
});

// New design system (WDS). GeistSans/GeistMono expose --font-geist-sans /
// --font-geist-mono; the wds preset's font-wds-* families point at those.
// Consumed via `font-wds-sans` / `font-wds-mono` in components/ui2/.

export const viewport: Viewport = {
  themeColor: '#2C1810',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Wendo RMS',
  description: 'Wendo Coffee Bistro — Restaurant Management System',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Wendo RMS',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorantGaramond.variable} ${inter.variable} ${playfairDisplay.variable} ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body
        className={`${cormorantGaramond.variable} ${inter.variable} ${playfairDisplay.variable} ${GeistSans.variable} ${GeistMono.variable} font-sans`}
      >
        <SessionBootstrap />
        <OfflineBanner />
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
