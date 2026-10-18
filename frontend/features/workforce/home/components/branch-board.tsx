'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { AvatarStack, FilterBar, FilterChip, FOCUS_RING, MOTION, avatarTone, initialsOf, onHover } from '../../_shared';
import { HomeButton } from './home-button';
import { SectionHeader } from './section-header';

/**
 * The Branch Manager's "branch right now" blocks (Paper Chapter 1 step 03, nodes PUM-0, Q4T-0, Q5G-0, Q6X-0):
 * the header with LIVE, the department chips, "Needs a look" and "On time and working". Props only; the Today board slice feeds them.
 */

export function BranchNowHeader({ title, subtitle, live = true }: { title: string; subtitle: string; live?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">{title}</h1>
        <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">{subtitle}</p>
      </div>
      {live ? (
        <span role="status" className="flex items-center gap-2 pb-0.5 font-wds-mono text-[11px] leading-[14px] tracking-[0.06em] text-wds-success-fg">
          <span aria-hidden className="size-[7px] rounded-full bg-wds-success-fg" />
          LIVE
        </span>
      ) : null}
    </div>
  );
}

export interface DepartmentChip {
  key: string;
  label: string;
  count: number;
  /** A square after the count: someone here is late (amber) or not in (red). */
  marker?: 'warning' | 'error';
}

/** The chips over the board: All and one per department. The search box is the screen's (it needs the board's data). */
export function DepartmentChips({ chips, value, onChange, search }: { chips: readonly DepartmentChip[]; value: string; onChange: (key: string) => void; search?: React.ReactNode }) {
  return (
    <FilterBar
      search={undefined}
      chips={chips.map((chip) => (
        <FilterChip key={chip.key} label={chip.label} count={chip.count} marker={chip.marker} selected={chip.key === value} onClick={() => onChange(chip.key)} />
      ))}
      trailing={search}
    />
  );
}

export type LookTone = 'error' | 'warning';

export interface LookRow {
  key: string;
  name: string;
  /** "Steward · Service". */
  role: string;
  /** "Not in yet · due 06:00", written in the tone's colour. */
  status: string;
  tone: LookTone;
  /** Not in yet: up to two buttons, only the ones the viewer may use. */
  actions?: ReadonlyArray<{ label: string; kind?: 'outlined' | 'danger'; onClick: () => void }>;
  /** Late: how late, as shares of the bar (grace then late). */
  late?: { grace: number; minutes: number };
  /** Grey tile for someone not in; the name's own tile for someone who came late. */
  tile?: 'muted' | 'name';
  /** Opens the person (the board's side drawer). The name becomes a button. */
  onOpen?: () => void;
}

export function NeedsALook({ rows, shiftLine, className }: { rows: readonly LookRow[]; shiftLine?: string; className?: string }) {
  return (
    <section aria-label="Needs a look" className={cn('flex min-w-0 flex-col', className)}>
      <SectionHeader title="Needs a look" count={rows.length} caption={shiftLine} size="sm" />
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((row) => (
          <li key={row.key} className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b border-wds-border py-1.5">
            <span
              aria-hidden
              className={cn('flex size-7 shrink-0 items-center justify-center rounded-full font-wds-sans text-[13px] font-medium leading-4', row.tile === 'muted' ? 'bg-wds-neutral-100 text-wds-text-secondary' : avatarTone(row.name).className)}
            >
              {initialsOf(row.name)}
            </span>
            {row.onOpen ? (
              <button type="button" onClick={row.onOpen} aria-label={`Open ${row.name}`} className={cn('flex min-h-11 w-[170px] shrink-0 flex-col justify-center text-left', FOCUS_RING)}>
                <span className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{row.name}</span>
                <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{row.role}</span>
              </button>
            ) : (
              <div className="flex w-[170px] shrink-0 flex-col">
                <span className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{row.name}</span>
                <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{row.role}</span>
              </div>
            )}
            <span className={cn('w-[150px] shrink-0 font-wds-sans text-[13px] leading-4', row.tone === 'error' ? 'text-wds-error-fg' : 'text-wds-warning-fg')}>{row.status}</span>
            {row.late ? (
              <div role="img" aria-label={`Late ${row.late.minutes} minutes`} className="flex h-1.5 min-w-[84px] grow basis-0 bg-wds-neutral-100">
                <div className="h-1.5 bg-wds-caramel-300" style={{ width: `${row.late.grace}%` }} />
                <div className="h-1.5 bg-wds-warning-fg" style={{ width: `${Math.min(100 - row.late.grace, Math.round((row.late.minutes / 30) * 100))}%` }} />
              </div>
            ) : (
              <div className="flex grow basis-0 justify-end gap-2">
                {row.actions?.map((a) => (
                  <HomeButton key={a.label} size="compact" kind={a.kind ?? 'outlined'} onClick={a.onClick} aria-label={`${a.label}: ${row.name}`}>
                    {a.label}
                  </HomeButton>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface DepartmentLine {
  key: string;
  name: string;
  onTime: number;
  /** Names for the little faces. */
  people: readonly string[];
  /** "Head: Kelvin Kings" (muted), "2 more are in Needs a look" (amber), "No head assigned" (red). */
  note: { text: string; tone: 'muted' | 'warning' | 'error' };
  onOpen?: () => void;
}

export function OnTimeByDepartment({ rows, className }: { rows: readonly DepartmentLine[]; className?: string }) {
  const total = rows.reduce((sum, r) => sum + r.onTime, 0);
  return (
    <section aria-label="On time and working" className={cn('flex min-w-0 flex-col', className)}>
      <SectionHeader title="On time and working" count={total} countTone="success" caption="By department" size="sm" />
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((row, i) => {
          const body = (
            <>
              <span className="w-[130px] shrink-0 font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink">{row.name}</span>
              <span className="w-[84px] shrink-0 font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{row.onTime} on time</span>
              <span className="flex grow basis-0 items-center">
                <AvatarStack names={[...row.people]} max={5} size="xs" />
              </span>
              <span className={cn('w-[240px] shrink-0 font-wds-sans text-[12px] leading-4', row.note.tone === 'error' ? 'text-wds-error-fg' : row.note.tone === 'warning' ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{row.note.text}</span>
              <span aria-hidden className="w-3 shrink-0 font-wds-sans text-[12px] leading-4 text-wds-text-faint">
                ›
              </span>
            </>
          );
          const base = cn('flex min-h-[42px] w-full items-center gap-3.5 py-1.5 text-left', i < rows.length - 1 && 'border-b border-wds-border');
          return (
            <li key={row.key}>
              {row.onOpen ? (
                <button type="button" onClick={row.onOpen} className={cn(base, MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'))}>
                  {body}
                </button>
              ) : (
                <div className={base}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
