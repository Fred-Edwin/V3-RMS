import * as React from 'react';

import { cn } from '@/lib/cn';

import { VALUE_TONE_CLASS, type ValueTone } from './key-value-rows';

/**
 * Boxes and rows that hold facts. All are presentational: data in, words in.
 *
 * - `Panel`        a bordered white box: title row (optional count badge or mono caption), body.
 * - `SettingRows`  title + description at the left, the value at the right (Rules 1KFG-0).
 * - `StatBoxes`    bordered cells side by side; `figures` (30 px number, 1JA8-0), `compact` (22 px,
 *                  17WB-0), `times` (mono 15, the planned / worked / extra boxes, 1CPM-0) and `compare`
 *                  (mono 20, the recorded / after-your-fix boxes, 1BBV-0). A cell can be amber
 *                  (`tone="warning"`), green (`tone="success"`) or red: the number is toned in every
 *                  variant, the cell is filled in `figures`, `times` and `compare` only.
 * - `ChecklistRows` a tick, a title and a grey line (1IRJ-0).
 * - `NoteRows`     left text, right note, optional square marker (17WK-0).
 *
 * The kit's own `KeyValueRows` is the label-left, value-right list.
 */

export function Panel({
  title,
  count,
  caption,
  children,
  className,
  bodyClassName,
  padded = true,
}: {
  title?: string;
  /** A small count badge after the title. */
  count?: number | string;
  /** Mono caption at the right of the title row ("UPDATED 09:40"). */
  caption?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Turn off the body padding for a table or a list of rows that draw their own. */
  padded?: boolean;
}) {
  const hasHead = Boolean(title) || Boolean(caption);
  return (
    <section aria-label={title} className={cn('flex flex-col border border-wds-border bg-wds-surface', className)}>
      {hasHead ? (
        <header className="flex items-center justify-between gap-3 border-b border-wds-border px-[18px] py-3">
          <div className="flex items-center gap-2">
            {title ? <h3 className="m-0 font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{title}</h3> : null}
            {count !== undefined ? (
              <span className="inline-flex min-w-[20px] items-center justify-center bg-wds-neutral-100 px-1.5 font-wds-mono text-[11px] leading-[18px] text-wds-text-secondary">{count}</span>
            ) : null}
          </div>
          {caption ? <span className="font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary">{caption}</span> : null}
        </header>
      ) : null}
      <div className={cn(padded && 'px-[18px] py-3.5', bodyClassName)}>{children}</div>
    </section>
  );
}

export interface SettingRow {
  title: string;
  description?: string;
  value: React.ReactNode;
  /** Numbers and durations are mono 15 px; words are 14 px sans. Off ("Off") reads grey. */
  mono?: boolean;
  muted?: boolean;
}

export function SettingRows({ rows, caption, className }: { rows: SettingRow[]; /** Mono caption over the box ("THE RULE TODAY"). */ caption?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {caption ? <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">{caption}</h3> : null}
      <ul className="m-0 flex list-none flex-col border border-wds-border bg-wds-surface p-0">
        {rows.map((r) => (
          <li key={r.title} className="flex items-center justify-between gap-4 border-t border-wds-neutral-100 px-[18px] py-3.5 first:border-t-0">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{r.title}</span>
              {r.description ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{r.description}</span> : null}
            </div>
            <span
              className={cn(
                'shrink-0 text-right',
                r.mono ? 'font-wds-mono text-[15px] leading-[18px]' : 'font-wds-sans text-[14px] leading-[18px]',
                r.muted ? 'text-wds-text-secondary' : 'text-wds-text-ink'
              )}
            >
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface StatCell {
  label: string;
  value: React.ReactNode;
  /** A line under the value (grey, or the cell's tone). */
  detail?: string;
  tone?: 'default' | 'warning' | 'success' | 'error';
}

const CELL_TONE: Record<NonNullable<StatCell['tone']>, { fill: string; text: string }> = {
  default: { fill: '', text: 'text-wds-text-ink' },
  warning: { fill: 'bg-wds-warning-bg', text: 'text-wds-warning-fg' },
  success: { fill: 'bg-wds-success-bg', text: 'text-wds-success-fg' },
  error: { fill: '', text: 'text-wds-error-fg' },
};

export function StatBoxes({ cells, variant = 'compact', row = false, className }: { cells: StatCell[]; variant?: 'figures' | 'compact' | 'times' | 'compare'; /** Keep the boxes side by side on a phone (Paper's before and after on Report a problem). Default: they stack. */ row?: boolean; className?: string }) {
  return (
    <dl className={cn('m-0 grid auto-cols-fr grid-flow-col border border-wds-border', !row && 'max-sm:grid-flow-row max-sm:auto-rows-auto', className)}>
      {cells.map((c, i) => {
        const tone = CELL_TONE[c.tone ?? 'default'];
        return (
          <div
            key={c.label}
            className={cn(
              'flex min-w-0 flex-col',
              variant === 'figures' ? 'gap-1 px-5 py-3.5' : variant === 'times' ? 'gap-0.5 px-3.5 py-2.5' : variant === 'compare' ? 'gap-0.5 px-4 py-3' : 'gap-[3px] px-3.5 py-3',
              i > 0 && (row ? 'border-l border-wds-border' : 'border-l border-wds-border max-sm:border-l-0 max-sm:border-t'),
              // Paper fills the cell only in the mono "times" boxes (1CPT-0, 1BC0-0); in the compact boxes only the number is toned (17WG-0).
              variant !== 'compact' && tone.fill
            )}
          >
            <dt
              className={cn(
                variant === 'compact' ? 'font-wds-sans text-[12px] leading-4 text-wds-text-secondary' : 'font-wds-mono text-[10px] leading-3 tracking-[0.08em]',
                // In the before/after boxes the red "recorded" side tones only its value (1BBX-0 stays grey).
                c.tone && c.tone !== 'default' && variant !== 'compact' && !(variant === 'compare' && c.tone === 'error') ? tone.text : variant === 'compact' ? undefined : 'text-wds-text-secondary'
              )}
            >
              {c.label}
            </dt>
            <dd
              className={cn(
                'm-0',
                variant === 'figures' && 'font-wds-sans text-[30px] font-semibold leading-[34px]',
                variant === 'compact' && 'font-wds-sans text-[22px] font-semibold leading-7',
                variant === 'times' && 'font-wds-mono text-[15px] leading-[18px]',
                variant === 'compare' && 'font-wds-mono text-[20px] leading-6',
                tone.text
              )}
            >
              {c.value}
            </dd>
            {c.detail ? (
              <dd className={cn('m-0 font-wds-sans text-[12px] leading-4', c.tone && c.tone !== 'default' && !(variant === 'compare' && c.tone === 'error') ? tone.text : 'text-wds-text-secondary')}>{c.detail}</dd>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}

export interface ChecklistRow {
  title: string;
  detail?: string;
  /** `done` is a green tick; `open` is an empty square; `problem` a red cross. Default done. */
  state?: 'done' | 'open' | 'problem';
}

const MARK: Record<NonNullable<ChecklistRow['state']>, { glyph: string; className: string; label: string }> = {
  done: { glyph: '✓', className: 'text-wds-success-fg', label: 'Done' },
  open: { glyph: '○', className: 'text-wds-text-muted', label: 'Not done yet' },
  problem: { glyph: '✕', className: 'text-wds-error-fg', label: 'Problem' },
};

export function ChecklistRows({ rows, className }: { rows: ChecklistRow[]; className?: string }) {
  return (
    <ul className={cn('m-0 flex list-none flex-col border border-wds-border bg-wds-surface p-0', className)}>
      {rows.map((r) => {
        const mark = MARK[r.state ?? 'done'];
        return (
          <li key={r.title} className="flex gap-3 border-t border-wds-neutral-100 px-4 py-[13px] first:border-t-0">
            <span aria-hidden className={cn('w-3.5 shrink-0 text-center font-wds-sans text-[14px] leading-[18px]', mark.className)}>
              {mark.glyph}
            </span>
            <span className="sr-only">{mark.label}: </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{r.title}</span>
              {r.detail ? <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{r.detail}</span> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export interface NoteRow {
  text: string;
  note?: string;
  /** The small square before the text, in a tone. */
  marker?: ValueTone;
}

const MARKER_FILL: Record<ValueTone, string> = {
  default: 'bg-wds-text-ink',
  success: 'bg-wds-success-fg',
  warning: 'bg-wds-caramel-600',
  error: 'bg-wds-error-fg',
  muted: 'bg-wds-neutral-400',
};

export function NoteRows({ rows, 'aria-label': ariaLabel, className }: { rows: NoteRow[]; 'aria-label'?: string; className?: string }) {
  return (
    <ul aria-label={ariaLabel} className={cn('m-0 flex list-none flex-col border border-wds-border p-0', className)}>
      {rows.map((r) => (
        <li key={r.text} className="flex items-center gap-2.5 border-t border-wds-neutral-100 px-3.5 py-2.5 first:border-t-0">
          {r.marker ? <span aria-hidden className={cn('h-2 w-2 shrink-0', MARKER_FILL[r.marker])} /> : null}
          <span className="min-w-0 grow font-wds-sans text-[13px] leading-4 text-wds-text-ink">{r.text}</span>
          {r.note ? <span className={cn('shrink-0 text-right font-wds-sans text-[12px] leading-4', VALUE_TONE_CLASS.muted)}>{r.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}
