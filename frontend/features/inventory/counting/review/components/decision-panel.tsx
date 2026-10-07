'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { CauseChips } from '../../_shared/components/count-chips';
import { signedQty } from '../../_shared/lib/count-format';
import { MOVEMENT_KINDS, type CountCause, type CountLine, type DecisionBody, type MovementKind } from '../../_shared/types/counting-contract';

const MOVEMENT_TEXT: Record<MovementKind, string> = { DISPATCH: 'Dispatch', PREP_USE: 'Prep use', DELIVERY: 'Delivery', WASTE: 'Waste' };

/**
 * The inline decision panel under a line being decided (Paper step 10, `1XSU-0`): "What explains the 16 kg difference?", the five
 * cause chips with the suggested one marked, "Log a missing movement instead" and "Ask for a recount". One tap on a cause decides
 * the line; "Other" asks for a note first. Both side doors write nothing: a movement logged records its kind, a recount asked sends
 * the Manager to Start a count with the item picked. Escape closes the panel without deciding.
 */
export function DecisionPanel({
  line,
  busy,
  onDecide,
  onClose,
}: {
  line: CountLine;
  busy: boolean;
  onDecide: (decision: DecisionBody) => void;
  onClose: () => void;
}) {
  const current = line.decision?.cause ?? null;
  const [picked, setPicked] = React.useState<CountCause | null>(current);
  const [note, setNote] = React.useState(line.decision?.causeNote ?? '');
  const [movementOpen, setMovementOpen] = React.useState(false);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (picked === 'OTHER') noteRef.current?.focus();
  }, [picked]);

  const choose = (cause: CountCause): void => {
    setPicked(cause);
    if (cause !== 'OTHER') onDecide({ kind: 'WRITE_OFF', cause });
  };

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      className="flex flex-col gap-3.5 border-t border-dashed border-wds-border-strong pb-[18px] pl-12 pr-4 pt-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150"
    >
      <p className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-text-ink" id={`decide-${line.id}`}>
        What explains the {signedQty(line.difference ?? '0', line.unit).replace(/^[−+]/, '')} difference?
      </p>
      <CauseChips value={picked} suggested={line.suggestedCause ?? null} onChange={choose} disabled={busy} label={`Cause for ${line.itemName}`} otherLabel="Other, add a note" className="[&_button]:h-[34px] [&_button]:px-3.5" />
      {picked === 'OTHER' ? (
        <div className="flex max-w-[560px] items-start gap-2">
          <label className="sr-only" htmlFor={`note-${line.id}`}>
            Note for {line.itemName}
          </label>
          <textarea
            id={`note-${line.id}`}
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Say what happened"
            className="min-h-[56px] grow border border-wds-border-strong bg-wds-surface p-2 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink outline-none focus:border-wds-selected-edge focus:shadow-wds-ring"
          />
          <button
            type="button"
            disabled={busy || note.trim() === ''}
            title={note.trim() === '' ? 'Add a note first' : undefined}
            onClick={() => onDecide({ kind: 'WRITE_OFF', cause: 'OTHER', note: note.trim() })}
            className="h-8 shrink-0 bg-wds-gradient-primary px-3.5 font-wds-sans text-[13px] font-semibold leading-4 text-wds-primary-fg outline-none transition-[filter,transform] duration-100 focus-visible:shadow-wds-ring enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:bg-wds-neutral-100 disabled:bg-none disabled:text-wds-text-muted motion-safe:enabled:active:scale-[0.98]"
          >
            Save
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="relative">
          <button
            type="button"
            aria-expanded={movementOpen}
            onClick={() => setMovementOpen((o) => !o)}
            className="font-wds-sans text-[13px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring"
          >
            Log a missing movement instead
          </button>
          {movementOpen ? (
            <ul role="menu" aria-label="Kind of movement" className="absolute left-0 top-6 z-10 flex min-w-[180px] flex-col border border-wds-border-strong bg-wds-surface shadow-wds-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-100">
              {MOVEMENT_KINDS.map((kind) => (
                <li key={kind} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => {
                      setMovementOpen(false);
                      onDecide({ kind: 'MOVEMENT_LOGGED', movementKind: kind });
                    }}
                    className={cn('w-full px-3 py-2 text-left font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none hover:bg-wds-neutral-50 focus-visible:bg-wds-neutral-50 disabled:opacity-50')}
                  >
                    {MOVEMENT_TEXT[kind]}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide({ kind: 'RECOUNT_ASKED' })}
          className="font-wds-sans text-[13px] font-medium leading-4 text-wds-selected-edge underline-offset-4 outline-none hover:underline focus-visible:shadow-wds-ring disabled:opacity-50"
        >
          Ask for a recount
        </button>
        <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">One tap decides the line. You can change it until you sign.</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto h-8 border border-wds-border-strong bg-wds-surface px-3 font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink outline-none transition-[background-color,transform] hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]"
        >
          Not now<span className="sr-only">, close without deciding</span>
        </button>
      </div>
    </div>
  );
}
