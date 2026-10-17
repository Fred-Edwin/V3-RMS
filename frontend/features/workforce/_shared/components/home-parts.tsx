'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui2/sheet';

import { FOCUS_RING, MOTION, PRESSED, onHover } from '../lib/interaction';

/**
 * Desktop Home rows and the side drawer.
 *
 * - `AttentionRow`  one line of "Needs a look": a 3 px bar in the tone, the name, a sub line in the tone's
 *                   colour, and at the right a button or a `MiniBar` (Paper 1ACU-0, 1AD8-0).
 * - `MiniBar`       the 84 × 6 bar: how late, how full.
 * - `WorkforceDrawer` the 480 px drawer from the right: avatar, name, a line, × (Paper 1B9N-0). Body takes
 *                   `DrawerSection`s. Escape closes and focus returns to what opened it (ui2/sheet does that).
 * - `DrawerSection` a mono caption over its content (TODAY, WHAT DO YOU WANT TO DO).
 */

export type AttentionTone = 'error' | 'warning' | 'success' | 'info';

const BAR: Record<AttentionTone, string> = {
  error: 'bg-wds-error-fg',
  // Paper draws the late rows' amber as #B27A0A: no token; caramel-600 is nearest (README).
  warning: 'bg-wds-caramel-600',
  success: 'bg-wds-success-fg',
  info: 'bg-wds-info-fg',
};
const SUB: Record<AttentionTone, string> = {
  error: 'text-wds-error-fg',
  warning: 'text-wds-warning-fg',
  success: 'text-wds-success-fg',
  info: 'text-wds-info-fg',
};

export function MiniBar({ fraction, tone = 'warning', label }: { /** 0 to 1. */ fraction: number; tone?: AttentionTone; /** Spoken: "22 of 30 minutes". */ label?: string }) {
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <div role="img" aria-label={label} className="flex h-1.5 w-[84px] shrink-0 bg-wds-neutral-100">
      <div className={cn('h-1.5', tone === 'error' ? 'bg-wds-error-fg' : tone === 'success' ? 'bg-wds-success-fg' : tone === 'info' ? 'bg-wds-info-fg' : 'bg-wds-warning-fg')} style={{ width: `${f * 100}%` }} />
    </div>
  );
}

export function AttentionRow({
  tone,
  name,
  detail,
  action,
  bar,
}: {
  tone: AttentionTone;
  name: string;
  /** "Not in · due 06:00 · Service", written in the tone's colour. */
  detail: string;
  /** A button the viewer may use. Hidden, not greyed, when they may not: pass nothing. */
  action?: { label: string; onClick: () => void };
  /** A `MiniBar` instead of a button. */
  bar?: { fraction: number; label?: string };
}) {
  return (
    <li className="flex items-center gap-3 border-b border-wds-neutral-100 px-5 py-3 last:border-b-0">
      <span aria-hidden className={cn('h-[34px] w-[3px] shrink-0', BAR[tone])} />
      <div className="flex min-w-0 grow basis-0 flex-col gap-px">
        <span className="truncate font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{name}</span>
        <span className={cn('truncate font-wds-sans text-[12px] leading-4', SUB[tone])}>{detail}</span>
      </div>
      {action ? (
        <button type="button" onClick={action.onClick} className={cn('flex h-8 shrink-0 items-center border border-wds-border-strong px-3.5 font-wds-sans text-[13px] leading-4 text-wds-text-ink', MOTION, FOCUS_RING, PRESSED, onHover('bg-wds-neutral-50'))}>
          {action.label}
        </button>
      ) : null}
      {bar ? <MiniBar fraction={bar.fraction} tone={tone} label={bar.label} /> : null}
    </li>
  );
}

export function DrawerSection({ caption, children, className }: { caption: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={caption} className={cn('flex flex-col gap-2', className)}>
      <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">{caption}</h3>
      {children}
    </section>
  );
}

export function WorkforceDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  initials,
  children,
  closeLabel = 'Close',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The person (or thing) the drawer is about. */
  title: string;
  /** "Waiter · Service · 0712 345 678". */
  subtitle?: string;
  /** Shown in the grey tile; leave out for no tile. */
  initials?: string;
  children: React.ReactNode;
  closeLabel?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent hideClose side="right" className="w-[480px] max-w-full overflow-y-auto" overlayClassName="bg-[color-mix(in_oklab,var(--wds-neutral-950)_45%,transparent)]">
        <div className="flex items-start justify-between border-b border-wds-border px-7 pb-[18px] pt-[22px]">
          <div className="flex items-center gap-3.5">
            {initials ? (
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-wds-neutral-200 font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-neutral-700">
                {initials}
              </span>
            ) : null}
            <div className="flex min-w-0 flex-col gap-0.5">
              <SheetTitle className="m-0 font-wds-sans text-[20px] font-semibold leading-6 text-wds-text-ink">{title}</SheetTitle>
              {subtitle ? <SheetDescription className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{subtitle}</SheetDescription> : null}
            </div>
          </div>
          <SheetClose aria-label={closeLabel} className={cn('-mr-2 -mt-1 flex h-9 w-9 items-center justify-center text-[20px] leading-6 text-wds-text-muted', MOTION, FOCUS_RING, onHover('text-wds-text-ink'))}>
            <span aria-hidden>×</span>
          </SheetClose>
        </div>
        <div className="flex flex-col gap-[18px] px-7 py-[22px]">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
