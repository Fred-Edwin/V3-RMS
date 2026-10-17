import { notFound } from 'next/navigation';

import { KitGallery } from '@/features/workforce/_shared/gallery/kit-gallery';

/**
 * Dev gallery for the Workforce kit (every piece, every state, labelled with its
 * Paper node). Not a product screen. The other /dev pages sit outside the login
 * gate and have no production guard; this one returns 404 in production.
 */
export default function WorkforceKitPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <KitGallery />;
}
