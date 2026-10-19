'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Topbar } from '@/components/app/shell/topbar';

import { PageHeader, PhoneDarkHeader } from '../../../_shared';

/**
 * The frame of every phone screen of Chapter 9: Paper's dark band with the back arrow on a phone (below 1024 px), the shell's top bar and
 * a plain page title above it. The content is one column, 480 px at most, so a desktop role looking at their own time sees the same
 * thing. `figure` is the big mono number of My time.
 */
export function PhoneScreen({
  screen,
  kicker,
  title,
  figure,
  subtitle,
  heading,
  back,
  children,
}: {
  /** Breadcrumb and spoken name: "My time". */
  screen: string;
  /** "MY TIME · OCTOBER 2026". */
  kicker: string;
  title?: string;
  figure?: string;
  subtitle?: string;
  /** A heading in the page itself, under a dark band that is only the back bar (Report a problem). */
  heading?: string;
  /** Where the arrow goes. */
  back: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: 'Workforce', screen }} hideSearch className="hidden lg:flex" />
      <PhoneDarkHeader className="lg:hidden" kicker={kicker} onBack={() => router.push(back)} title={title} figure={figure} subtitle={subtitle} />
      <main aria-label={screen} className="min-h-0 flex-1 overflow-y-auto bg-wds-canvas">
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-3 px-4 py-4 lg:py-7">
          <PageHeader className="hidden lg:flex" title={heading ?? figure ?? title ?? screen} subtitle={subtitle} />
          {heading ? <h1 className="m-0 mb-1 font-wds-sans text-[22px] font-semibold leading-7 tracking-[-0.02em] text-wds-text-ink lg:hidden">{heading}</h1> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
