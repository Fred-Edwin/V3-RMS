'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { formatReference } from '../../lib/copy/states-copy';
import { DialogButton } from '../dialogs/kit-dialog';

/**
 * The three desktop messages of Paper Chapter 16 step 3, on a `#E6E4DF`-style ground (the canvas): a card 600 wide with a 1 px border, 26/28
 * padding, a mono kicker, a 20/26 title. They hold no data of their own: words and actions come in as props; the table of codes is
 * `lib/messages.ts`. A blocking card is an `alertdialog` and moves focus to its first button; Escape on the conflict card means "Keep theirs".
 */
const CARD = 'flex w-full max-w-[600px] flex-col gap-3.5 border border-wds-border bg-wds-surface px-7 py-[26px]';
const KICKER = 'font-wds-mono text-[10px] leading-3 tracking-[0.08em]';
const TITLE = 'm-0 font-wds-sans text-[20px] font-semibold leading-[26px] text-wds-text-ink';
const BODY = 'm-0 font-wds-sans text-[14px] leading-[21px] text-wds-text-secondary';

/** Focus the first button when a blocking card appears (the person must answer or leave it). */
function useFirstButtonFocus(): React.RefObject<HTMLDivElement> {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, []);
  return ref;
}

export interface ChangedCardProps {
  /** Who changed it first: "Faith Njeri, Branch Manager". */
  by: string;
  /** "Mon 19 Oct 14:02". */
  when: string;
  /** "Your change to the Service rota was not saved, so nothing was overwritten." */
  what?: string;
  /** The three lines of the grey box: the cell, what the other person set, what you tried. */
  cell: string;
  theirs: string;
  yours: string;
  onKeepTheirs: () => void;
  /** Offered only where one cell or one clock fix conflicts (SD32); elsewhere the card has Keep theirs only. */
  onUseMine?: () => void;
  busy?: boolean;
}

/** `CHANGED BY SOMEONE ELSE FIRST`: nothing was overwritten, and the person decides whose change stands. */
export function ChangedBySomeoneElseCard({ by, when, what, cell, theirs, yours, onKeepTheirs, onUseMine, busy = false }: ChangedCardProps) {
  const ref = useFirstButtonFocus();
  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-labelledby="changed-title"
      aria-describedby="changed-body"
      className={CARD}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onKeepTheirs();
      }}
    >
      <span className={cn(KICKER, 'text-wds-warning-fg')}>CHANGED BY SOMEONE ELSE FIRST</span>
      <h2 id="changed-title" className={TITLE}>
        {by} changed {when}
      </h2>
      <p id="changed-body" className={BODY}>
        {what ?? 'Your change was not saved, so nothing was overwritten. Your other changes on this page are kept.'}
      </p>
      <dl className="m-0 flex flex-col gap-1 border border-wds-border bg-wds-neutral-50 px-3.5 py-3 font-wds-sans text-[13px] leading-[19px]">
        <dt className="font-medium text-wds-text-ink">{cell}</dt>
        <dd className="m-0 text-wds-text-secondary">{theirs}</dd>
        <dd className="m-0 text-wds-text-secondary">{yours}</dd>
      </dl>
      <div className="flex justify-end gap-2.5">
        <DialogButton kind="cancel" size="lg" disabled={busy} onClick={onKeepTheirs}>
          Keep theirs
        </DialogButton>
        {onUseMine ? (
          <DialogButton kind="primary" size="lg" disabled={busy} onClick={onUseMine}>
            {busy ? 'Saving…' : 'Use mine instead'}
          </DialogButton>
        ) : null}
      </div>
    </div>
  );
}

/** `NOT IN YOUR MENU`: a 404 for a page the role may not open. Nothing was changed. */
export function NotInYourMenuCard({ onHome }: { onHome: () => void }) {
  const ref = useFirstButtonFocus();
  return (
    <div ref={ref} role="alert" className={CARD}>
      <span className={cn(KICKER, 'text-wds-text-secondary')}>NOT IN YOUR MENU</span>
      <h2 className={TITLE}>This page is not part of your work here</h2>
      <p className={BODY}>The link you opened belongs to another role. Nothing was changed. If you need it, ask HR to give you access.</p>
      <div className="flex justify-end">
        <DialogButton kind="primary" size="lg" onClick={onHome}>
          Go to Home
        </DialogButton>
      </div>
    </div>
  );
}

/** `A FAULT ON OUR SIDE`: a 5xx with its reference so support can find the log line. The work stays on the page. */
export function FaultCard({ reference, when, onRetry, onCopy }: { reference: string | null; when: string; onRetry: () => void; onCopy?: (reference: string) => void }) {
  const ref = useFirstButtonFocus();
  const code = reference ? formatReference(reference) : null;
  return (
    <div ref={ref} role="alert" className={cn(CARD, 'border-t-[3px] border-t-wds-error-fg')}>
      <span className={cn(KICKER, 'text-wds-error-fg')}>A FAULT ON OUR SIDE</span>
      <h2 className={TITLE}>We could not save that. Nothing was changed.</h2>
      <p className={BODY}>Your work is still on this page. Try again in a moment. If it keeps happening, give this reference to support.</p>
      {code ? (
        <p className="m-0 border border-wds-border bg-wds-neutral-50 px-3.5 py-2.5 font-wds-mono text-[12px] leading-4 text-wds-text-ink">
          Reference {code} · {when}
        </p>
      ) : null}
      <div className="flex justify-end gap-2.5">
        {code && onCopy ? (
          <DialogButton kind="cancel" size="lg" onClick={() => onCopy(code)}>
            Copy reference
          </DialogButton>
        ) : null}
        <DialogButton kind="primary" size="lg" onClick={onRetry}>
          Try again
        </DialogButton>
      </div>
    </div>
  );
}
