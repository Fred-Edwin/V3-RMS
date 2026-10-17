import { notFound } from 'next/navigation';

import { HomeGallery } from '@/features/workforce/home/gallery/home-gallery';

/**
 * Dev gallery for Workforce Home (every block, every state, every role's page from fixtures, each labelled with its Paper node).
 * Not a product screen. `app/dev/layout.tsx` already returns 404 in production; this page repeats the check so it stays safe if moved.
 */
export default function WorkforceHomeGalleryPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <HomeGallery />;
}
