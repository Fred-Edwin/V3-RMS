'use client';

import * as React from 'react';

import { SignSheetDialog } from '@/components/app/shell/sign-sheet';
import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { groupByCategory } from '../../hooks/use-section-draft';
import { useRestoreFocus } from '../../hooks/use-restore-focus';
import { SEND_SHEET_COPY } from '../../_shared/lib/phone-words';
import { formatQty } from '../../lib/qty';

export interface SendSheetLine {
  itemId: string;
  itemName: string;
  unit: string;
  qty: string;
  categoryPath: string[];
}

export interface SendSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentName: string;
  reference: string;
  cycleLabel: string;
  branchName: string;
  lines: readonly SendSheetLine[];
  changes: number;
  note: string;
  onNote: (value: string) => void;
  /** Signs and sends. Resolves to the words of the failure, or null when it worked. */
  onSend: (pin: string, idempotencyKey: string) => Promise<string | null>;
}

/** Paper step 5: the summary, the optional note for the Branch Manager and the PIN, as one sheet. */
export function SendSheet({ open, onOpenChange, departmentName, reference, cycleLabel, branchName, lines, changes, note, onNote, onSend }: SendSheetProps) {
  const idem = useIdempotencyKey();
  useRestoreFocus(open);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [showAll, setShowAll] = React.useState(false);
  const groups = React.useMemo(() => groupByCategory(lines), [lines]);

  React.useEffect(() => {
    if (open) {
      setError(undefined);
      setShowAll(false);
    }
  }, [open]);

  const submit = React.useCallback(
    async (pin: string): Promise<void> => {
      setSubmitting(true);
      setError(undefined);
      const failure = await onSend(pin, idem.key());
      setSubmitting(false);
      if (failure) setError(failure);
    },
    [onSend, idem],
  );

  return (
    <SignSheetDialog
      layout="sheet"
      open={open}
      onOpenChange={onOpenChange}
      title={SEND_SHEET_COPY.title(departmentName)}
      subtitle={SEND_SHEET_COPY.subtitle(reference, cycleLabel, branchName)}
      helperText=""
      pinLabel={SEND_SHEET_COPY.pinLabel}
      confirmLabel={SEND_SHEET_COPY.confirm}
      onSubmit={(pin) => void submit(pin)}
      submitting={submitting}
      error={error}
    >
      <section aria-label="Your list" className="flex flex-col border border-wds-border-strong">
        <div className="flex items-end justify-between gap-3 border-b border-wds-text-ink px-4 pb-3.5 pt-4">
          <div className="flex flex-col gap-0.5">
            <p className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">{SEND_SHEET_COPY.yourList}</p>
            <p className="font-wds-sans text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-wds-text-ink">{SEND_SHEET_COPY.items(lines.length)}</p>
          </div>
          {changes > 0 ? (
            <span className="flex items-center gap-1.5 border border-wds-warning-border bg-wds-warning-bg px-[9px] py-1 font-wds-sans text-[12px] leading-[14px] text-wds-warning-fg">
              <span className="size-1.5 rounded-full bg-wds-warning-fg" aria-hidden="true" />
              {SEND_SHEET_COPY.changes(changes)}
            </span>
          ) : null}
        </div>
        {showAll ? (
          <ul className="flex max-h-[280px] flex-col overflow-y-auto">
            {groups.map((group) => (
              <li key={group.heading} className="flex flex-col">
                <p className="border-b border-wds-border bg-wds-neutral-50 px-4 py-2 font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink">{group.heading}</p>
                <ul>
                  {group.lines.map((l) => (
                    <li key={l.itemId} className="flex items-baseline justify-between gap-3 border-b border-wds-border px-4 py-2.5 font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">
                      <span>{l.itemName}</span>
                      <span className="font-wds-mono text-[13px]">
                        {formatQty(l.qty)} {l.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <ul>
            {groups.map((group) => (
              <li key={group.heading} className="flex flex-col gap-[3px] border-b border-wds-border px-4 py-[11px]">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{group.heading}</p>
                  <p className="font-wds-mono text-[13px] leading-4 text-wds-text-secondary">{group.lines.length}</p>
                </div>
                <p className="line-clamp-1 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{group.lines.map((l) => l.itemName).join(', ')}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-wds-border bg-wds-neutral-50 px-4 py-[11px]">
          <p className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{SEND_SHEET_COPY.goesTo}</p>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="-my-3 flex min-h-11 items-center rounded-wds-sm px-1 font-wds-sans text-[13px] font-medium leading-4 text-wds-selected-edge outline-none transition-[background-color,opacity] duration-100 hover:bg-wds-caramel-100 focus-visible:shadow-wds-ring active:opacity-70"
          >
            {showAll ? SEND_SHEET_COPY.hideEveryLine : SEND_SHEET_COPY.seeEveryLine}
          </button>
        </div>
      </section>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="req-note" className="font-wds-mono text-[11px] uppercase leading-[14px] tracking-[0.06em] text-wds-text-secondary">
          {SEND_SHEET_COPY.noteLabel}
        </label>
        <textarea
          id="req-note"
          value={note}
          onChange={(e) => onNote(e.target.value.slice(0, SEND_SHEET_COPY.noteMax))}
          rows={2}
          maxLength={SEND_SHEET_COPY.noteMax}
          className="w-full resize-none border border-wds-border-strong bg-wds-surface px-3 py-2.5 font-wds-sans text-[14px] leading-5 text-wds-text-ink outline-none focus-visible:border-wds-selected-edge focus-visible:shadow-wds-ring"
        />
      </div>
    </SignSheetDialog>
  );
}
