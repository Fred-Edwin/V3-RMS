'use client';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../../../_shared';
import { cardSpeech, timeWords } from '../lib/my-record-words';
import type { RecordItem } from '../types/my-record-types';

/**
 * The entries as cards (Paper 14.2): title, the grey line, the mono time. A flagged card has the amber bar and fill and the words
 * "Needs your answer" (colour is never the only signal). Each card is a button that opens the one entry; the list is a real list.
 */
export function RecordList({ items, now, onOpen }: { items: readonly RecordItem[]; now: Date; onOpen: (item: RecordItem, opener: HTMLElement) => void }) {
  return (
    <ul aria-label="Entries on my record" className="m-0 flex list-none flex-col gap-2 p-0">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            aria-label={cardSpeech(item, now)}
            onClick={(e) => onOpen(item, e.currentTarget)}
            className={cn(
              'relative flex w-full flex-col gap-1 border p-3.5 text-left',
              MOTION,
              FOCUS_RING,
              item.flagged ? 'border-wds-warning-border bg-wds-warning-bg pl-[17px]' : cn('border-wds-border bg-wds-surface', onHover('bg-wds-neutral-50'))
            )}
          >
            {item.flagged ? <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-wds-caramel-500" /> : null}
            <span className="font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">{item.title}</span>
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{item.line}</span>
            <span className="flex items-center justify-between gap-3">
              <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{timeWords(item.occurredAt, now)}</span>
              {item.needsAnswer ? <span className="font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-warning-fg">NEEDS YOUR ANSWER</span> : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
