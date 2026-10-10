'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { CheckDisc } from './day-parts';

export interface FileTab<T extends string> {
  id: T;
  label: string;
  /** The count after the label in mono ("Documents 1"); absent for Items. */
  count?: number;
}

/**
 * The tabs of a closed day file (Paper B11, B12b, B13): padding 10 14, 14/18, the active tab ink and weight 600 with a 2px #B0610F underline
 * on a 1px ink rail, counts in mono 12/16 after the label. A `tablist` with arrow keys, Home and End; the panel is named by the active tab.
 * Nothing animates on a key press.
 */
export function FileTabs<T extends string>({ tabs, active, onChange, panelId, label }: { tabs: readonly FileTab<T>[]; active: T; onChange: (id: T) => void; panelId: string; label: string }) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const onKeyDown = (event: React.KeyboardEvent): void => {
    const at = tabs.findIndex((t) => t.id === active);
    const next = event.key === 'ArrowRight' ? tabs[(at + 1) % tabs.length] : event.key === 'ArrowLeft' ? tabs[(at - 1 + tabs.length) % tabs.length] : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : undefined;
    if (!next) return;
    event.preventDefault();
    onChange(next.id);
    refs.current[next.id]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 border-b border-wds-text-ink">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`${panelId}-tab-${t.id}`}
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative -mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 font-wds-sans text-[14px] leading-[18px] outline-none transition-colors duration-150 ease-out focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]',
              on ? 'border-wds-selected-edge font-semibold text-wds-text-ink' : 'border-transparent text-wds-text-secondary [@media(hover:hover)]:hover:text-wds-text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined ? <span className="font-wds-mono text-[12px] font-normal leading-4 text-wds-text-secondary">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The strip under a closed day's title (Paper B11): three done items on one line (a 16 green tick and 13/18 text) and an info chip at the
 * right. The last item is weight 500. The chip's words change once the correction window has passed (gap G13).
 */
export function DayTracker({ items, chip }: { items: readonly string[]; chip: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-wds-border-strong bg-wds-surface px-4 py-3">
      {items.map((text, i) => (
        <span key={text} className="flex items-center gap-2">
          <CheckDisc size={16} strokeWidth={2.4} />
          <span className={cn('font-wds-sans text-[13px] leading-[18px] text-wds-text-ink', i === items.length - 1 && 'font-medium')}>{text}</span>
        </span>
      ))}
      {chip ? <span className="ml-auto border border-wds-info-border bg-wds-info-bg px-2 py-[3px] font-wds-sans text-[12px] leading-4 text-wds-info-fg">{chip}</span> : null}
    </div>
  );
}
