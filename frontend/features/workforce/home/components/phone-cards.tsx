import * as React from 'react';

import { cn } from '@/lib/cn';

import { AvatarStack, WeekBars, type WeekBar } from '../../_shared';
import { HomeButton } from './home-button';

/**
 * The phone Home cards that are not the clock card (Paper step 05, QKM-0, QKK-0, QHU-0):
 * the team card for a department head, the dashed slot where the Orders redo puts the job cards, and the week card.
 */

/** The ring in the team card: people in over people expected, "9/10" in the middle. */
function TeamRing({ present, expected }: { present: number; expected: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const share = expected > 0 ? Math.min(1, present / expected) : 0;
  return (
    <div role="img" aria-label={`${present} of ${expected} are in`} className="relative size-16 shrink-0">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--wds-neutral-100)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} transform="rotate(-90 32 32)" fill="none" stroke="var(--wds-success-fg)" strokeWidth="6" strokeDasharray={`${share * c} ${c}`} />
      </svg>
      <span aria-hidden className="absolute inset-0 flex items-center justify-center font-wds-mono text-[15px] font-medium leading-5 text-wds-text-ink">
        {present}/{expected}
      </span>
    </div>
  );
}

export interface TeamRow {
  key: string;
  name: string;
  /** "Not in yet · due 06:00", written in the tone's colour. */
  status: string;
  tone: 'error' | 'warning';
  /** The one button: "Clock in for her". Only when the head may use it. */
  action?: { label: string; onClick: () => void };
  /** Late: how late, as a share of the bar. */
  late?: { grace: number; minutes: number };
}

export function ServiceTeamCard({
  title,
  expected,
  present,
  people,
  lateCount,
  notInCount,
  rows,
  open,
  className,
}: {
  /** "Service team today". */
  title: string;
  expected: number;
  present: number;
  people: readonly string[];
  lateCount: number;
  notInCount: number;
  rows: readonly TeamRow[];
  /** "Open": the link to the full board. Only when the head may open it. */
  open?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn('flex flex-col border border-wds-border bg-wds-surface shadow-[0_10px_24px_-18px_color-mix(in_oklab,var(--wds-neutral-950)_18%,transparent)]', className)}>
      <header className="flex items-center justify-between px-5 pb-3 pt-4">
        <h2 className="m-0 font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{title}</h2>
        {open ? (
          <button type="button" onClick={open.onClick} className="min-h-11 font-wds-sans text-[13px] leading-4 text-wds-warning-fg outline-none focus-visible:shadow-wds-ring">
            {open.label}
          </button>
        ) : null}
      </header>
      <div className="flex items-center gap-4 px-5 pb-4 pt-1.5">
        <TeamRing present={present} expected={expected} />
        <div className="flex flex-col gap-2">
          <AvatarStack names={[...people]} max={5} size="xs" />
          {/* The ring counts people ON TODAY'S ROTA; with none rostered, say so (the whole team is under My team). */}
          {expected === 0 ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Nobody has a shift today. Your whole team is under My team.</p> : null}
          <div className="flex gap-1.5">
            {lateCount > 0 ? <span className="border border-wds-warning-border bg-wds-warning-bg px-2 py-0.5 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">{lateCount} late</span> : null}
            {notInCount > 0 ? <span className="border border-wds-error-border bg-wds-error-bg px-2 py-0.5 font-wds-sans text-[12px] leading-4 text-wds-error-fg">{notInCount} not in</span> : null}
          </div>
        </div>
      </div>
      {rows.some((r) => r.late) ? <p className="m-0 border-t border-wds-border px-5 pt-2.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Bar: light is grace allowed, dark is time past the grace. A full bar is 30 minutes or more.</p> : null}
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 border-t border-wds-border px-5 py-3">
            <div className="flex min-w-0 flex-col gap-px">
              <span className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{row.name}</span>
              <span className={cn('font-wds-sans text-[12px] leading-4', row.tone === 'error' ? 'text-wds-error-fg' : 'text-wds-warning-fg')}>{row.status}</span>
            </div>
            {row.late ? (
              <div role="img" aria-label={`${row.late.minutes} minutes past the grace`} title={`${row.late.minutes} minutes past the grace`} className="flex h-1.5 w-[84px] shrink-0 bg-wds-neutral-100">
                <div className="h-1.5 bg-wds-caramel-300" style={{ width: `${row.late.grace}%` }} />
                <div className="h-1.5 bg-wds-warning-fg" style={{ width: `${Math.min(100 - row.late.grace, Math.round((row.late.minutes / 30) * 100))}%` }} />
              </div>
            ) : row.action ? (
              <HomeButton size="row" className="min-h-11" onClick={row.action.onClick} aria-label={`${row.action.label}: ${row.name}`}>
                {row.action.label}
              </HomeButton>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The dashed slot where the job's own cards go (Paper QKK-0: "Designed in the Orders redo"). It is a plain note until the Orders redo
 * registers its cards, so it carries no action. It is drawn only on the phone, and only where the person has a job card to come.
 */
export function JobCardsSlot({ text = 'Job cards: open tables and orders. Designed in the Orders redo.', className }: { text?: string; className?: string }) {
  return (
    <div className={cn('flex min-h-[92px] items-center justify-center border border-dashed border-wds-neutral-400 px-6 text-center font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary', className)}>
      {text}
    </div>
  );
}

/** "This week": the kit's `WeekBars` with the ruled footer (hours so far, and overtime waiting as an info tag). */
export function WeekCard({
  range,
  bars,
  hours,
  hoursOf,
  overtimeWaiting,
}: {
  /** "28 SEP TO 4 OCT". */
  range: string;
  bars: readonly WeekBar[];
  /** "36 h 20 m". */
  hours: string;
  /** "of 40 h this week". */
  hoursOf: string;
  /** "1 h 30 m overtime waiting". */
  overtimeWaiting?: string;
}) {
  return (
    <WeekBars
      title="This week"
      range={range}
      bars={bars}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-wds-mono text-[20px] font-medium leading-6 text-wds-text-ink">{hours}</span>
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{hoursOf}</span>
          </div>
          {overtimeWaiting ? <span className="border border-wds-info-border bg-wds-info-bg px-[9px] py-1 font-wds-sans text-[12px] leading-4 text-wds-info-fg">{overtimeWaiting}</span> : null}
        </div>
      }
    />
  );
}
