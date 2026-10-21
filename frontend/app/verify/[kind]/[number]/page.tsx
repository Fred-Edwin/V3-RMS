import type { Metadata } from 'next';
import { Suspense } from 'react';

import { VerifyPage } from '@/features/workforce/documents';

/** What a printed document's QR opens. Public: outside `app/app`, no shell, no sign-in. Never indexed, never sends a referrer. */
export const metadata: Metadata = {
  title: 'Check a document',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function VerifyRoute({ params }: { params: { kind: string; number: string } }) {
  return (
    <Suspense>
      <VerifyPage kind={params.kind} number={params.number} />
    </Suspense>
  );
}
