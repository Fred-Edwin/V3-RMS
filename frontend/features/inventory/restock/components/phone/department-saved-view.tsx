'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { PhoneErrorNote, PhoneFieldLabel, PhonePrimaryButton, PhoneSuccessNote } from '../../../_shared/components/phone-parts';
import { describeChange } from '../history-drawer';
import { formatHistoryWhen } from '../../../catalog/lib/item-price';
import { formatNumber } from '../../../_shared/components/stock-format';
import type { RestockHistoryEntry } from '../../../types';

export interface DepartmentSavedViewProps {
  savedCount: number;
  entries: RestockHistoryEntry[];
  historyStatus: 'idle' | 'loading' | 'error' | 'ready';
  historyError: string | null;
  onRetryHistory: () => void;
  puttingBackId: string | null;
  putBackError: string | null;
  onPutBack: (changeId: string) => void;
  onDone: () => void;
}

/** Levels saved + "Your recent changes" with Put back — Paper step 29. */
export function DepartmentSavedView({
  savedCount,
  entries,
  historyStatus,
  historyError,
  onRetryHistory,
  puttingBackId,
  putBackError,
  onPutBack,
  onDone,
}: DepartmentSavedViewProps) {
  return (
    <div className="flex grow flex-col gap-4 px-4 py-[18px]">
      <PhoneSuccessNote title={`${savedCount} ${savedCount === 1 ? 'level' : 'levels'} saved`}>
        Tomorrow&apos;s requisition will start from {savedCount === 1 ? 'it' : 'them'}.
      </PhoneSuccessNote>
      {putBackError ? <PhoneErrorNote>{putBackError}</PhoneErrorNote> : null}
      <div className="flex flex-col gap-2">
        <PhoneFieldLabel>Your recent changes</PhoneFieldLabel>
        {historyStatus === 'loading' || historyStatus === 'idle' ? (
          <p className="border border-wds-border bg-wds-surface px-3.5 py-3 font-wds-sans text-[13px] text-wds-text-copy-muted">Loading your changes…</p>
        ) : historyStatus === 'error' ? (
          <div className="flex flex-col items-start gap-2 border border-wds-border bg-wds-surface px-3.5 py-3">
            <p className="font-wds-sans text-[13px] text-wds-error-fg">{historyError ?? 'Could not load your changes.'}</p>
            <Button variant="secondary" size="sm" onClick={onRetryHistory}>
              Try again
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <p className="border border-wds-border bg-wds-surface px-3.5 py-3 font-wds-sans text-[13px] text-wds-text-copy-muted">No changes yet.</p>
        ) : (
          <ul className="flex flex-col border border-wds-border bg-wds-surface">
            {entries.slice(0, 8).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 border-b border-wds-border px-3.5 py-3 last:border-b-0">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">
                    {entry.itemName} · {describeChange(entry)}
                  </span>
                  <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-copy-muted">
                    {formatHistoryWhen(entry.createdAt)} · {entry.changedBy.name}
                  </span>
                </div>
                {entry.oldLevel !== null ? (
                  <Button
                    variant="secondary"
                    className="h-[34px] shrink-0 px-3 text-[13px] text-wds-espresso-700"
                    disabled={puttingBackId !== null}
                    onClick={() => onPutBack(entry.id)}
                    aria-label={`Put back ${formatNumber(entry.oldLevel)} ${entry.usageUnit} for ${entry.itemName}`}
                  >
                    {puttingBackId === entry.id ? 'Putting back…' : `Put back ${formatNumber(entry.oldLevel)}`}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="font-wds-sans text-[12px] leading-[17px] text-wds-text-copy-muted">
        Putting a level back adds a new entry. The old one stays on record, and the Store Manager can see both.
      </p>
      <div className="grow" />
      <PhonePrimaryButton onClick={onDone}>Done</PhonePrimaryButton>
    </div>
  );
}
