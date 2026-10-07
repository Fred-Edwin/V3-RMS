'use client';

import * as React from 'react';

import { SearchInput } from '@/components/ui2/search-input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui2/sheet';
import { Combobox } from '@/components/ui2/combobox';
import { EmptyState, ErrorState } from '@/components/app/shell/shell-states';
import { Skeleton } from '@/components/ui2/skeleton';
import { PREP_STATES_COPY } from '../lib/states-copy';
import type { OutputsResponse } from '../types/prep-contract';

export type OutputOption = OutputsResponse['items'][number];

/**
 * The "Something else" picker (Paper step 2, `6S9-0`): "What did you make?", a search box and the prepped items with their unit on
 * the right. A bottom sheet on a phone and a tablet; on a computer the manager's drawer uses the closed select (`OutputSelect`).
 */
export interface OutputPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outputs: OutputOption[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onPick: (itemId: string) => void;
}

export function OutputPicker({ open, onOpenChange, outputs, loading, error, onRetry, onPick }: OutputPickerProps) {
  const [query, setQuery] = React.useState('');
  React.useEffect(() => {
    if (open) setQuery('');
  }, [open]);
  const shown = (outputs ?? []).filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 sm:mx-auto sm:max-w-[520px]">
        <SheetHeader className="border-b-0 px-wds-4 pb-wds-3">
          <SheetTitle className="text-[20px] font-semibold leading-6">What did you make?</SheetTitle>
          <SheetDescription>Choose the item you produced. Inputs come next.</SheetDescription>
        </SheetHeader>
        <div className="px-wds-4 pb-wds-3">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search prepped items" aria-label="Search prepped items" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-wds-4 pb-wds-4">
          {loading ? (
            <div className="flex flex-col gap-wds-3 py-wds-2" aria-busy="true" aria-label="Loading prepped items">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState title={PREP_STATES_COPY.record.outputsErrorTitle} description={error} onRetry={onRetry} />
          ) : (outputs ?? []).length === 0 ? (
            <EmptyState title={PREP_STATES_COPY.record.outputsEmptyTitle} description={PREP_STATES_COPY.record.outputsEmptyDescription} />
          ) : shown.length === 0 ? (
            <p className="py-wds-6 text-center font-wds-sans text-wds-body-sm text-wds-text-copy-muted">No prepped item matches “{query}”.</p>
          ) : (
            <ul>
              {shown.map((o) => (
                <li key={o.itemId} className="border-b border-wds-neutral-100 last:border-b-0">
                  <button type="button" onClick={() => onPick(o.itemId)} className="flex min-h-14 w-full items-center justify-between gap-wds-3 py-wds-2.5 text-left outline-none transition-colors hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-wds-sans text-[16px] leading-5 text-wds-text-ink">{o.name}</span>
                      <span className="truncate font-wds-sans text-wds-caption text-wds-text-copy-muted">{o.expectedText ?? 'No usual figure yet'}</span>
                    </span>
                    <span className="shrink-0 font-wds-mono text-wds-caption text-wds-text-copy-muted">{o.unit}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The manager drawer's closed select: "What did you make?" with every prepped item. */
export function OutputSelect({ outputs, value, onChange, disabled }: { outputs: OutputOption[]; value: string | undefined; onChange: (itemId: string) => void; disabled?: boolean }) {
  return (
    <Combobox
      value={value}
      onValueChange={onChange}
      options={outputs.map((o) => ({ value: o.itemId, label: o.name }))}
      placeholder="Choose the item you made"
      aria-label="What did you make?"
      chevron
      disabled={disabled}
    />
  );
}
