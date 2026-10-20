'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, PRESSED, onHover } from '../lib/interaction';
import { SHIFT_PAINT, SHIFT_TONES, type ShiftChipTone, type ShiftTone } from '../lib/shift-palette';
import { nextInGroup } from '../lib/roving';

/**
 * Schedule pieces, presentational only: no data, no popover, no publish (those belong to the Rota slice).
 *
 * - `ShiftChip`        a shift in a rota cell: "06–14" in mono, 74 × 26 (Paper 16G7-0). `long` is the
 *                      wider "Morning 06:00 to 14:00"; `chosen` is the espresso ring; `flagged` the amber
 *                      2 px border (a clash or a second site); `changedFrom` adds the amber "Changed from" line.
 * - `PickShiftButton`  the dashed "Pick shift" cell (Paper 19AL-0).
 * - `ShiftLegend`      swatch + name for each colour in use.
 * - `ShiftSwatchPicker` the five 28 px swatches of the add-shift dialog (Paper 18XZ-0).
 * - `ShiftGrid`        the week table: people down, seven days across, hours at the end, and a footer row
 *                      ("ON, NEEDS 4", an amber "3 thin"). Cells arrive as props (Paper 16FP-0).
 * - `TwoLineRow`       a list row with a title, a grey line and a status at the right (Paper 16EK-0).
 */

const RING = 'border-wds-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--wds-primary)_12%,transparent)]';

export function ShiftChip({
  tone,
  label,
  long = false,
  chosen = false,
  flagged = false,
  changedFrom,
  onSelect,
  disabled = false,
  ariaLabel,
  className,
}: {
  tone: ShiftChipTone;
  /** "06–14", or the long "Morning 06:00 to 14:00". */
  label: string;
  long?: boolean;
  chosen?: boolean;
  flagged?: boolean;
  /** "Morning": draws "Changed from Morning" under the chip. */
  changedFrom?: string;
  /** Present only when the viewer may change the shift; without it the chip is plain text. */
  onSelect?: (opener: HTMLElement) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const paint = SHIFT_PAINT[tone];
  const box = cn(
    'inline-flex h-[26px] items-center justify-center border',
    long ? 'px-3' : 'w-[74px] overflow-hidden text-ellipsis whitespace-nowrap px-1',
    tone === 'leave' ? 'font-wds-sans text-[12px] leading-4' : 'font-wds-mono text-[11px] leading-[14px]',
    paint.chip,
    flagged && 'border-2 border-wds-caramel-600',
    chosen && RING,
    className
  );
  const chip = onSelect ? (
    <button type="button" onClick={(e) => onSelect(e.currentTarget)} disabled={disabled} aria-pressed={chosen} aria-label={ariaLabel} className={cn(box, MOTION, FOCUS_RING, PRESSED, 'disabled:pointer-events-none disabled:opacity-60', onHover('brightness-[0.97]'))}>
      {label}
    </button>
  ) : (
    <span aria-label={ariaLabel} className={box}>
      {label}
    </span>
  );
  if (!changedFrom) return chip;
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      {chip}
      <span className="font-wds-sans text-[11px] leading-[14px] text-wds-warning-fg">Changed from {changedFrom}</span>
    </span>
  );
}

export function PickShiftButton({ children = 'Pick shift', onClick, disabled = false, ariaLabel }: { children?: React.ReactNode; onClick: () => void; disabled?: boolean; ariaLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn('flex h-8 w-[84px] items-center justify-center border border-dashed border-wds-neutral-400 font-wds-sans text-[12px] leading-4 text-wds-primary', MOTION, FOCUS_RING, PRESSED, 'disabled:pointer-events-none disabled:opacity-60', onHover('bg-wds-neutral-50'))}
    >
      {children}
    </button>
  );
}

export function ShiftLegend({ items, className }: { items: ReadonlyArray<{ tone: ShiftTone; label?: string }>; className?: string }) {
  return (
    <ul aria-label="Shift colours" className={cn('m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1.5 p-0', className)}>
      {items.map((i) => (
        <li key={i.tone} className="flex items-center gap-1.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          <span aria-hidden className={cn('h-3 w-3 border', SHIFT_PAINT[i.tone].chip)} />
          {i.label ?? SHIFT_PAINT[i.tone].label}
        </li>
      ))}
    </ul>
  );
}

export function ShiftSwatchPicker({
  value,
  onChange,
  label = 'Colour on the rota',
  names,
  disabled = false,
}: {
  value: ShiftTone;
  onChange: (tone: ShiftTone) => void;
  label?: string;
  /** Names for screen readers; default is the palette's own. */
  names?: Partial<Record<ShiftTone, string>>;
  disabled?: boolean;
}) {
  const refs = React.useRef(new Map<string, HTMLButtonElement>());
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2.5">
      {SHIFT_TONES.map((tone) => {
        const chosen = tone === value;
        return (
          <button
            key={tone}
            ref={(el) => {
              if (el) refs.current.set(tone, el);
              else refs.current.delete(tone);
            }}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-label={names?.[tone] ?? SHIFT_PAINT[tone].label}
            tabIndex={chosen ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(tone)}
            onKeyDown={(e) => {
              const next = nextInGroup(e.key, SHIFT_TONES, value);
              if (next === null) return;
              e.preventDefault();
              onChange(next as ShiftTone);
              refs.current.get(next)?.focus();
            }}
            className={cn('h-7 w-7 shrink-0 border', SHIFT_PAINT[tone].chip, MOTION, FOCUS_RING, PRESSED, 'disabled:pointer-events-none disabled:opacity-60', chosen && 'border-2 border-wds-text-ink')}
          />
        );
      })}
    </div>
  );
}

export interface ShiftGridCell {
  tone: ShiftChipTone;
  label: string;
  long?: boolean;
  flagged?: boolean;
  changedFrom?: string;
  chosen?: boolean;
  ariaLabel?: string;
  /** Only when the viewer may edit this cell. Receives the chip, so a popover can anchor to it. */
  onSelect?: (opener: HTMLElement) => void;
}

/** A day with no shift. Without `onSelect` it is the plain dash; with it, a quiet button that opens the same picker as a chip. */
export interface ShiftGridEmptyCell {
  empty: true;
  chosen?: boolean;
  ariaLabel?: string;
  onSelect?: (opener: HTMLElement) => void;
}

export interface ShiftGridRow {
  id: string;
  name: string;
  /** Role, or a note. */
  sub?: string;
  /** Amber for a note that needs a look ("Also at Highway Sat"). */
  subTone?: 'default' | 'warning';
  /** One entry per day; `null` is a day off (drawn "—"). */
  cells: ReadonlyArray<ShiftGridCell | ShiftGridEmptyCell | null>;
  hours: string;
}

export interface ShiftGridFooterCell {
  text: string;
  tone?: 'default' | 'warning' | 'faint';
}

export function ShiftGrid({
  days,
  rows,
  footer,
  personHeading = 'PERSON',
  hoursHeading = 'HRS',
  label,
  className,
}: {
  /** "MON 12" ... one per day. */
  days: readonly string[];
  rows: readonly ShiftGridRow[];
  footer?: { label: string; cells: readonly ShiftGridFooterCell[] };
  personHeading?: string;
  hoursHeading?: string;
  /** Accessible name of the table ("Barista rota, 12 to 18 October"). */
  label: string;
  className?: string;
}) {
  const width = 150 + days.length * 84 + 56;
  const headClass = 'font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary';
  return (
    <div className={cn('overflow-x-auto border border-wds-border bg-wds-surface', className)}>
      <table aria-label={label} className="border-collapse" style={{ width, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 150 }} />
          {days.map((d) => (
            <col key={d} style={{ width: 84 }} />
          ))}
          <col style={{ width: 56 }} />
        </colgroup>
        <thead>
          <tr className="h-8 border-b border-wds-text-ink">
            <th scope="col" className={cn('pl-3 text-left align-middle', headClass)}>
              {personHeading}
            </th>
            {days.map((d) => (
              <th key={d} scope="col" className={cn('text-center align-middle', headClass)}>
                {d}
              </th>
            ))}
            <th scope="col" className={cn('pr-2.5 text-right align-middle', headClass)}>
              {hoursHeading}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="h-[42px] border-b border-wds-neutral-100">
              <th scope="row" className="pl-3 text-left align-middle font-normal">
                <span className="block truncate font-wds-sans text-[13px] leading-4 text-wds-text-ink">{r.name}</span>
                {r.sub ? <span className={cn('block truncate font-wds-sans text-[11px] leading-[14px]', r.subTone === 'warning' ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{r.sub}</span> : null}
              </th>
              {days.map((d, i) => {
                const c = r.cells[i] ?? null;
                return (
                  <td key={d} data-row={r.id} data-day={i} className="text-center align-middle">
                    {c && 'empty' in c ? (
                      c.onSelect ? (
                        <button
                          type="button"
                          onClick={(e) => c.onSelect?.(e.currentTarget)}
                          aria-label={c.ariaLabel ?? `${r.name}, ${d}, no shift`}
                          aria-pressed={c.chosen ?? false}
                          className={cn('inline-flex h-[26px] w-[74px] items-center justify-center border border-transparent font-wds-sans text-[13px] leading-4 text-wds-neutral-400', MOTION, FOCUS_RING, PRESSED, onHover('border-wds-neutral-400 border-dashed'), c.chosen && RING)}
                        >
                          —
                        </button>
                      ) : (
                        <span aria-label={c.ariaLabel ?? `${r.name}, ${d}, no shift`} className="font-wds-sans text-[13px] leading-4 text-wds-neutral-400">
                          —
                        </span>
                      )
                    ) : c ? (
                      <ShiftChip tone={c.tone} label={c.label} long={c.long} flagged={c.flagged} changedFrom={c.changedFrom} chosen={c.chosen} ariaLabel={c.ariaLabel ?? `${r.name}, ${d}, ${c.label}`} onSelect={c.onSelect} />
                    ) : (
                      <span aria-label={`${r.name}, ${d}, no shift`} className="font-wds-sans text-[13px] leading-4 text-wds-neutral-400">
                        —
                      </span>
                    )}
                  </td>
                );
              })}
              <td className="pr-2.5 text-right align-middle font-wds-mono text-[12px] leading-4 text-wds-text-ink">{r.hours}</td>
            </tr>
          ))}
        </tbody>
        {footer ? (
          <tfoot>
            <tr className="h-9 bg-wds-neutral-50">
              <th scope="row" className={cn('pl-3 text-left align-middle', headClass)}>
                {footer.label}
              </th>
              {footer.cells.map((c, i) => (
                <td
                  key={i}
                  className={cn(
                    'text-center align-middle font-wds-mono text-[12px] leading-4',
                    c.tone === 'warning' ? 'font-semibold text-wds-warning-fg' : c.tone === 'faint' ? 'text-wds-neutral-400' : 'text-wds-text-ink'
                  )}
                >
                  {c.text}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

export function TwoLineRow({
  title,
  sub,
  status,
  statusTone = 'default',
  selected = false,
  onSelect,
  className,
}: {
  title: string;
  sub?: string;
  /** The word at the right ("3 need a look", "Complete"). */
  status?: string;
  statusTone?: 'default' | 'warning' | 'success';
  selected?: boolean;
  /** Present when the row can be chosen; without it the row is plain text. */
  onSelect?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className={cn('font-wds-sans text-[14px] leading-[18px] text-wds-text-ink', selected && 'font-medium')}>{title}</span>
        {status ? (
          <span className={cn('shrink-0 font-wds-sans text-[12px] leading-4', statusTone === 'warning' ? 'text-wds-warning-fg' : statusTone === 'success' ? 'text-wds-success-fg' : 'text-wds-text-secondary')}>{status}</span>
        ) : null}
      </span>
      {sub ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{sub}</span> : null}
    </>
  );
  const base = cn('flex w-full flex-col gap-0.5 py-2.5 pl-[18px] pr-4 text-left', selected ? 'border-l-2 border-l-wds-caramel-600 bg-wds-neutral-100 pl-4' : '', className);
  if (!onSelect) return <div className={base}>{body}</div>;
  return (
    <button type="button" onClick={onSelect} aria-current={selected ? 'true' : undefined} className={cn(base, MOTION, FOCUS_RING, selected ? undefined : onHover('bg-wds-neutral-50'))}>
      {body}
    </button>
  );
}
