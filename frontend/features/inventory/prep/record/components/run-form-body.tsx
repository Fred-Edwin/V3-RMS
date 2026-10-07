'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import { PrepStepper } from '../../_shared/components/prep-stepper';
import { UsualNote, WarningBox, YieldLine, warningText } from '../../_shared/components/expected-yield-note';
import { PREP_STATES_COPY } from '../../_shared/lib/states-copy';
import { formatQuantity } from '../../_shared/lib/prep-format';
import type { useRecordForm } from '../hooks/use-record-form';

type Form = ReturnType<typeof useRecordForm>;

const sectionLabel = 'font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-copy-muted';

/**
 * The record form's body, shared by the Attendant's screen (phone, tablet, computer) and the manager's drawer (Paper steps 3, 6,
 * 37, 39, 40, 41): the blue usual note, WHAT YOU USED with a stepper per ingredient, "+ Add something else you used", WHAT YOU MADE
 * and the amber warnings. `mode="manager"` swaps "Was 10 kg last time" for "In stock now 41 kg" (only when the server sent stock,
 * which it does only to a caller who may see it). Nothing here blocks the run: warnings are guides.
 */
export function RunFormBody({ form, mode, onAddClick, className }: { form: Form; mode: 'attendant' | 'manager'; onAddClick: () => void; className?: string }) {
  const { output, lines, check } = form;
  if (!output) return null;
  const warning = check ? warningText(check, output.unit) : null;
  const stockFor = (itemId: string): string | null => {
    const s = check?.stock?.find((x) => x.itemId === itemId);
    return s ? formatQuantity(s.onHand) : null;
  };

  return (
    <div className={cn('flex flex-col gap-wds-3.5', className)}>
      {check ? <UsualNote check={check} unit={output.unit} /> : form.linesLoading || lines.length > 0 ? <Skeleton className="h-[52px] w-full" /> : null}

      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>What you used</span>
        {form.linesLoading ? (
          <div className="flex flex-col gap-wds-2 border border-wds-border bg-wds-surface p-wds-2.5" aria-busy="true" aria-label="Loading ingredients">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : lines.length === 0 ? (
          <p className="border border-dashed border-wds-border-strong bg-wds-surface px-wds-3 py-wds-4 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            Nothing used yet. Add what went into this batch.
          </p>
        ) : (
          <ul className="border border-wds-border bg-wds-surface">
            {lines.map((line) => {
              const stock = mode === 'manager' ? stockFor(line.itemId) : null;
              return (
                <li key={line.itemId} className="flex items-center justify-between gap-wds-3 border-b border-wds-neutral-100 px-wds-2.5 py-wds-2 last:border-b-0">
                  <div className="flex min-w-0 flex-col gap-px">
                    <span className="truncate font-wds-sans text-[15px] leading-[18px] text-wds-text-ink">{line.name}</span>
                    {mode === 'manager' ? (
                      stock !== null ? <span className="font-wds-sans text-[11px] leading-[14px] text-wds-text-copy-muted">In stock now {stock} {line.unit}</span> : null
                    ) : line.was !== null ? (
                      <span className="font-wds-sans text-[11px] leading-[14px] text-wds-espresso-600">
                        Was {formatQuantity(line.was)} {line.unit}
                        <span className="hidden md:inline"> last time</span>
                      </span>
                    ) : (
                      <button type="button" onClick={() => form.removeLine(line.itemId)} className="w-fit font-wds-sans text-[11px] leading-[14px] text-wds-text-copy-muted underline outline-none focus-visible:shadow-wds-ring">
                        Remove
                      </button>
                    )}
                  </div>
                  <PrepStepper label={line.name} unit={line.unit} value={line.quantity} onChange={(q) => form.setQuantity(line.itemId, q)} />
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" onClick={onAddClick} className="mt-wds-1.5 w-fit font-wds-sans text-wds-body-sm font-medium text-wds-espresso-700 outline-none hover:underline focus-visible:shadow-wds-ring">
          + Add something else you used
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>What you made</span>
        <div className="flex items-center justify-between gap-wds-3 border border-wds-border bg-wds-surface px-wds-2.5 py-wds-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-wds-sans text-[15px] leading-[18px] text-wds-text-ink">{output.name}</span>
            <YieldLine check={check} />
          </div>
          <PrepStepper label={`${output.name} made`} unit={output.unit} value={form.made} onChange={form.changeMade} wide />
        </div>
      </div>

      {warning ? <WarningBox>{warning}</WarningBox> : null}
      {check?.typoSuspect.suspect && check.typoSuspect.text ? <WarningBox>{check.typoSuspect.text}</WarningBox> : null}
      {form.checkFailed ? <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{PREP_STATES_COPY.record.checkFailed}</p> : null}
    </div>
  );
}
