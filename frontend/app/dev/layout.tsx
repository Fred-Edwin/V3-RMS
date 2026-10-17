import { notFound } from 'next/navigation';

/**
 * Every page under /dev is a developer tool (component galleries, auth bypass
 * for mock screens). They sit outside the login gate, so none of them may be
 * served in production: this layout returns 404 for the whole folder.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <>{children}</>;
}
