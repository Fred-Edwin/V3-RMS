import type { Metadata } from 'next';
import { Cormorant_Garamond, DM_Sans } from 'next/font/google';
import './globals.css';
import { SessionBootstrap } from '@/components/app/SessionBootstrap';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { OfflineBanner } from '@/components/ui/OfflineBanner';

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Wendo RMS',
  description: 'Wendo Restaurant Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorantGaramond.variable} ${dmSans.variable}`}>
      <body className={`${cormorantGaramond.variable} ${dmSans.variable} font-sans`}>
        <SessionBootstrap />
        <OfflineBanner />
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
