'use client';

import Link from 'next/link';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, PRESSED } from '../../_shared';

const PRIMARY = cn('flex h-11 items-center justify-center rounded-[2px] bg-wds-primary px-5 font-wds-sans text-sm font-medium leading-[18px] text-wds-primary-fg hover:bg-wds-primary-hover md:h-10', MOTION, FOCUS_RING, PRESSED);

/**
 * "This page does not exist" in the app's own look (the same top rule, caption and title as the not-available screen), for an address that
 * leads nowhere. It stands alone, outside the shell, so it also works for a person who is not signed in.
 */
export function NotFoundScreen() {
  return (
    <main aria-label="Page not found" className="min-h-screen bg-wds-canvas px-4 pt-8 md:px-8 md:pt-12">
      <div className="flex w-full max-w-[560px] flex-col items-start gap-3 border-t border-t-wds-neutral-800 py-8">
        <p className="m-0 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">NOT FOUND</p>
        <h1 className="m-0 font-wds-sans text-[22px] font-semibold leading-7 tracking-[-0.02em] text-wds-text-ink">This page does not exist</h1>
        <p className="m-0 font-wds-sans text-sm leading-[21px] text-wds-neutral-700">The address may be old or mistyped. Nothing was changed.</p>
        <div className="flex w-full flex-col gap-2 pt-2 md:w-auto md:flex-row">
          <Link href="/app/workforce" className={PRIMARY}>
            Go to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
