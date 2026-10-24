'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Topbar } from '@/components/app/shell/topbar';
import { cn } from '@/lib/cn';

import { PageHeader } from '../layout/page-parts';
import { PhoneDarkHeader } from './phone-parts';

/**
 * The frame of every phone screen of Chapters 9 and 12: Paper's dark band with the back arrow on a phone (below 1024 px), the shell's
 * top bar and a plain page title above it. The content is one column, 480 px at most, so a desktop role looking at their own time or pay
 * sees the same thing. `figure` is the big mono number (a string, or a node when the figure can be hidden).
 */
export function PhoneScreen({
  screen,
  kicker,
  title,
  figure,
  figureSize,
  subtitle,
  aside,
  trailing,
  desktopTitle,
  desktopActions,
  heading,
  back,
  bleed = false,
  children,
}: {
  /** Breadcrumb and spoken name: "My time". */
  screen: string;
  /** "MY TIME · OCTOBER 2026". */
  kicker: string;
  title?: string;
  figure?: React.ReactNode;
  figureSize?: 'md' | 'lg';
  subtitle?: string;
  /** Under the subtitle on the dark band: a status tag, the buttons row. */
  aside?: React.ReactNode;
  /** At the right of the dark band's bar: the eye. */
  trailing?: React.ReactNode;
  /** The plain title a desktop role sees when `figure` is not text. */
  desktopTitle?: string;
  /** What a desktop role sees at the right of the plain page title (the light eye). */
  desktopActions?: React.ReactNode;
  /** A heading in the page itself, under a dark band that is only the back bar (Report a problem). */
  heading?: string;
  /** Where the arrow goes. */
  back: string;
  /** The body fills the width and the height under the band with no padding or scrolling of its own (the Document view). */
  bleed?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const plainFigure = typeof figure === 'string' ? figure : undefined;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: 'Workforce', screen }} hideSearch className="hidden lg:flex" />
      <PhoneDarkHeader className="lg:hidden" kicker={kicker} onBack={() => router.push(back)} trailing={trailing} title={title} figure={figure} figureSize={figureSize} subtitle={subtitle} aside={aside} />
      <main aria-label={screen} className={cn('min-h-0 flex-1 bg-wds-canvas', bleed ? 'flex flex-col' : 'overflow-y-auto')}>
        <div className={cn('mx-auto flex w-full flex-col', bleed ? 'min-h-0 flex-1 lg:max-w-[480px] lg:gap-3 lg:px-4 lg:py-7' : 'max-w-[480px] gap-3 px-4 py-4 lg:py-7')}>
          <PageHeader className="hidden lg:flex" title={heading ?? desktopTitle ?? plainFigure ?? title ?? screen} subtitle={subtitle} actions={desktopActions} />
          {heading ? <h1 className="m-0 mb-1 font-wds-sans text-[22px] font-semibold leading-7 tracking-[-0.02em] text-wds-text-ink lg:hidden">{heading}</h1> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
