'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { isFigure, nextRowToCount, stepFigure } from '../lib/count-logic';
import { CountBox, CountRow, FOCUS_ROW } from './phone-parts';

export interface CountListItem {
  id: string;
  name: string;
  unit: string;
  /** The group heading the item sits under ("Dry goods"). Headings show only when there is more than one group. */
  section?: string;
  /** Replaces the unit line under the name, e.g. "kg · was 8 last night". */
  note?: string;
}

/** Takes focus to the first box that has no figure yet and brings it to the middle of the list. */
export function focusNextBlank(): void {
  const box = document.querySelector<HTMLInputElement>('input[data-count-blank="true"]');
  if (!box) return;
  box.focus({ preventScroll: true });
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

const STEP_BUTTON =
  'flex h-full shrink-0 items-center justify-center font-wds-sans leading-5 outline-none transition-[background-color] duration-100 focus-visible:shadow-[inset_0_0_0_2px_var(--wds-primary-btn-start)] active:bg-wds-neutral-100';

/**
 * The list of count boxes shared by B3 (count), the recount and B3c (review). One box per item, with a − and a + beside it so a
 * figure can be tapped up or down as well as typed; the whole row is the label. Enter moves to the next empty box (the keypad's Next
 * does the same). Items with a `section` sit under a heading that says how many of that group are counted. `review` marks a figure
 * the person changed since the screen opened with a small amber ring.
 */
export function CountList({
  items,
  typed,
  onType,
  mode,
  changedIds,
  label,
}: {
  items: readonly CountListItem[];
  typed: Readonly<Record<string, string>>;
  onType: (itemId: string, value: string) => void;
  mode: 'count' | 'review';
  changedIds?: ReadonlySet<string>;
  label: string;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const ids = React.useMemo(() => items.map((i) => i.id), [items]);
  const sectionTotals = React.useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of items) if (item.section) totals.set(item.section, (totals.get(item.section) ?? 0) + 1);
    return totals;
  }, [items]);
  const showHeadings = sectionTotals.size > 1;
  // The first empty box takes focus when the list opens, as Paper draws step 3 (a count, not a review).
  React.useEffect(() => {
    if (mode !== 'count') return;
    const first = ids.findIndex((id) => (typed[id] ?? '') === '');
    refs.current[first === -1 ? 0 : first]?.focus({ preventScroll: false });
    // Only when the list first has items.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.length, mode]);

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-wds-surface">
      <ul aria-label={label} className="min-h-0 flex-1 overflow-y-auto bg-wds-surface">
        {items.map((item, index) => {
          const inputId = `count-${item.id}`;
          const value = typed[item.id] ?? '';
          const startsSection = showHeadings && item.section !== undefined && item.section !== items[index - 1]?.section;
          const counted = startsSection ? items.filter((i) => i.section === item.section && isFigure(typed[i.id])).length : 0;
          return (
            <React.Fragment key={item.id}>
              {startsSection ? (
                <li aria-hidden="true" className="flex items-center justify-between border-b border-wds-border bg-wds-neutral-50 px-5 py-2.5">
                  <span className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-neutral-700">{item.section}</span>
                  <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                    {counted} of {sectionTotals.get(item.section ?? '')} counted
                  </span>
                </li>
              ) : null}
              <li>
                <CountRow name={item.name} hint={item.note ?? item.unit} htmlFor={inputId} className={cn('min-h-[61px] cursor-text gap-2.5', FOCUS_ROW, changedIds?.has(item.id) && 'bg-wds-caramel-100 shadow-[inset_3px_0_0_0_var(--wds-primary-btn-start)]')}>
                  {changedIds?.has(item.id) ? (
                    <span className="flex items-center gap-1.5 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">
                      <span aria-hidden="true" className="size-1.5 rounded-full border-[1.5px] border-wds-warning-fg" />
                      <span className="sr-only">Changed</span>
                    </span>
                  ) : null}
                  {/* One joined control: a quiet −, the figure (the biggest thing on the row), a caramel +. */}
                  <div className="flex h-11 w-[150px] shrink-0 border border-wds-border-strong bg-white transition-shadow duration-100 focus-within:border-[var(--wds-primary-btn-start)] focus-within:shadow-[0_0_0_3px_var(--wds-caramel-100)]">
                    <button
                      type="button"
                      aria-label={`Take one from ${item.name}`}
                      disabled={isFigure(value) && Number(value) <= 0}
                      onClick={() => onType(item.id, stepFigure(value, -1))}
                      className={cn(STEP_BUTTON, 'w-11 border-0 border-r border-wds-border-strong bg-wds-neutral-50 text-[24px] text-wds-neutral-500 disabled:text-[#C9C4BB]')}
                    >
                      −
                    </button>
                    <CountBox
                      id={inputId}
                      data-count-blank={isFigure(value) ? 'false' : 'true'}
                      ref={(el) => {
                        refs.current[index] = el;
                      }}
                      value={value}
                      onChange={(v) => onType(item.id, v)}
                      className="h-full min-w-0 flex-1 border-0 text-[22px] font-semibold leading-7 focus:border-0 focus:shadow-none"
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        const next = nextRowToCount(ids, typed, index);
                        if (next === null) e.currentTarget.blur();
                        else refs.current[next]?.focus();
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`Add one to ${item.name}`}
                      onClick={() => onType(item.id, stepFigure(value, 1))}
                      className={cn(STEP_BUTTON, 'w-11 border-0 border-l border-wds-border-strong bg-wds-caramel-100 text-[24px] font-medium text-[var(--wds-primary-btn-start)]')}
                    >
                      +
                    </button>
                  </div>
                </CountRow>
              </li>
            </React.Fragment>
          );
        })}
      </ul>
    </main>
  );
}
