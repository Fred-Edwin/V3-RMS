'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { nextRowToCount, unitHint } from '../lib/count-logic';
import { CountBox, CountRow, FOCUS_ROW } from './phone-parts';

export interface CountListItem {
  id: string;
  name: string;
  unit: string;
}

/**
 * The list of count boxes shared by B3 (count), the recount and B3c (review). One box per item; the whole row is the label, so the
 * touch target is the 61 px row. Enter moves to the next empty box (the keypad's Next does the same). `review` drops the "Count in"
 * hint and marks a figure the person changed since the screen opened with a small amber ring.
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
  // The first empty box takes focus when the list opens, as Paper draws step 3 (a count, not a review).
  React.useEffect(() => {
    if (mode !== 'count') return;
    const first = ids.findIndex((id) => (typed[id] ?? '') === '');
    refs.current[first === -1 ? 0 : first]?.focus({ preventScroll: false });
    // Only when the list first has items.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.length, mode]);

  return (
    <ul aria-label={label} className="min-h-0 flex-1 overflow-y-auto bg-wds-surface">
      {items.map((item, index) => {
        const inputId = `count-${item.id}`;
        return (
          <li key={item.id}>
            <CountRow name={item.name} hint={mode === 'count' ? unitHint(item.unit) : item.unit} htmlFor={inputId} className={cn('min-h-[61px] cursor-text', FOCUS_ROW)}>
              {changedIds?.has(item.id) ? (
                <span className="flex items-center gap-1.5 font-wds-sans text-[12px] leading-4 text-wds-warning-fg">
                  <span aria-hidden="true" className="size-1.5 rounded-full border-[1.5px] border-wds-warning-fg" />
                  <span className="sr-only">Changed</span>
                </span>
              ) : null}
              <CountBox
                id={inputId}
                ref={(el) => {
                  refs.current[index] = el;
                }}
                value={typed[item.id] ?? ''}
                onChange={(v) => onType(item.id, v)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const next = nextRowToCount(ids, typed, index);
                  if (next === null) e.currentTarget.blur();
                  else refs.current[next]?.focus();
                }}
              />
            </CountRow>
          </li>
        );
      })}
    </ul>
  );
}
