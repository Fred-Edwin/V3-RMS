import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wendo RMS',
    short_name: 'Wendo',
    description: 'Wendo Coffee Bistro — Restaurant Management System',
    start_url: '/login',
    display: 'standalone',
    background_color: '#F5F0E8',
    theme_color: '#2C1810',
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
