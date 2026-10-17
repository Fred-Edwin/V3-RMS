'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, PRESSED, PhoneHero } from '../../_shared';

/**
 * The phone Home's dark band (Paper QGU-0): the menu button, the kicker "WENDO RMS · NYERI TOWN", a SLOT for the shift pill, a SLOT for
 * the job's one primary action (the "+" of New order), then the greeting with the person's photo.
 *
 * Both slots are built here and filled by others: the pill is Attendance's (slice 3, a `TimerChip`), the action is the job module's
 * (the Orders redo). Leave a slot out and nothing is drawn in its place. The menu button carries a small ring when something waits
 * for the person (a department head's approvals), as Paper draws on the head's phone.
 */
export function PhoneHomeBar({
  kicker,
  onMenu,
  menuLabel = 'Open menu',
  somethingWaits = false,
  shiftPill,
  primaryAction,
  name,
  greeting,
  subtitle,
  photoUrl,
}: {
  /** "WENDO RMS · NYERI TOWN". */
  kicker: string;
  onMenu: () => void;
  menuLabel?: string;
  /** The ring on the menu button. */
  somethingWaits?: boolean;
  /** Slot: the shift pill (`TimerChip`). */
  shiftPill?: React.ReactNode;
  /** Slot: the job's one primary action, a 36 px square (the "+" button). */
  primaryAction?: React.ReactNode;
  name: string;
  greeting: string;
  subtitle: string;
  photoUrl?: string | null;
}) {
  return (
    <header className="bg-wds-sidebar-top">
      <div className="flex h-14 items-center gap-2.5 px-3">
        <button type="button" onClick={onMenu} aria-label={somethingWaits ? `${menuLabel}, something is waiting for you` : menuLabel} className={cn('relative flex size-11 shrink-0 items-center justify-center', MOTION, FOCUS_RING, PRESSED)}>
          <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
            <path d="M1 1H17M1 7H17M1 13H11" fill="none" stroke="var(--wds-sidebar-fg-item)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {somethingWaits ? <span aria-hidden className="absolute right-1.5 top-1.5 size-2.5 rounded-full border-2 border-wds-error-fg" /> : null}
        </button>
        <span className="min-w-0 grow truncate font-wds-mono text-[11px] leading-[14px] tracking-[0.06em] text-wds-sidebar-fg-item">{kicker}</span>
        {shiftPill}
        {primaryAction}
      </div>
      <PhoneHero name={name} greeting={greeting} subtitle={subtitle} photoUrl={photoUrl} />
    </header>
  );
}

/** The 36 px brown square the job module puts in the bar's action slot ("+", New order). Built so the slot has its look; the job passes the click. */
export function PhoneBarAction({ label, onClick, children = '+' }: { label: string; onClick: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cn('flex size-11 shrink-0 items-center justify-center bg-wds-primary text-[22px] leading-none text-wds-primary-fg', MOTION, FOCUS_RING, PRESSED, 'hover:bg-wds-primary-hover')}>
      <span aria-hidden>{children}</span>
    </button>
  );
}
