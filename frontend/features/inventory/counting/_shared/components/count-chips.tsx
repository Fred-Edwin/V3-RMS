import * as React from 'react';

import { cn } from '@/lib/cn';
import { CAUSE_TEXT, type CountCause, type CountStatus, type LineResult } from '../types/counting-contract';

/**
 * The small chips the Counting screens share. Every one carries words, never colour alone (accessibility rule): a count's status,
 * a line's result against the range, and the five causes. `CauseChips` is the one cause control, used by the review decision panel
 * (step 10), the sign dialog (steps 11 and 14) and, read only, by the Director's and Accountant's views.
 */

const status: Record<CountStatus, string> = {
  OPEN: 'border-wds-border-strong bg-wds-neutral-100 text-wds-neutral-700',
  SUBMITTED: 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
  APPROVED: 'border-wds-success-border bg-wds-success-bg text-wds-success-fg',
};

/** The status chip of a count ("Waiting for you", "In progress", "Approved"). `text` is the server's words. */
export function CountStatusChip({ status: s, text }: { status: CountStatus; text: string }) {
  return <span className={cn('inline-block border px-2 py-0.5 font-wds-sans text-[12px] leading-4', status[s])}>{text}</span>;
}

const RESULT_TEXT: Record<LineResult, string> = {
  MATCHES: 'Matches',
  WITHIN_RANGE: 'Within range',
  EXCEEDS: 'Exceeds the range',
  NOT_COUNTED: 'Not counted',
  NOT_YET: '',
};

const result: Record<LineResult, string> = {
  MATCHES: 'text-wds-success-fg',
  WITHIN_RANGE: 'border border-wds-border-strong bg-wds-neutral-100 text-wds-neutral-700 px-2 py-0.5',
  EXCEEDS: 'border border-wds-error-border bg-wds-error-bg text-wds-error-fg px-2 py-0.5',
  NOT_COUNTED: 'text-wds-text-muted',
  NOT_YET: 'text-wds-text-muted',
};

/** A line's result against the range (Paper step 13's Result column and step 9). `override` replaces the words ("Over 5%, so it will exceed"). */
export function LineResultChip({ result: r, override, className }: { result: LineResult; override?: string; className?: string }) {
  const text = override ?? RESULT_TEXT[r];
  if (!text) return null;
  const withTick = r === 'MATCHES' && !override;
  return (
    <span className={cn('inline-flex items-center gap-1 font-wds-sans text-[12px] leading-4', result[r], override && 'border border-wds-warning-border bg-wds-warning-bg px-2 py-0.5 text-wds-warning-fg', className)}>
      {withTick ? (
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {text}
    </span>
  );
}

export interface CauseChipsProps {
  /** The chosen cause, or null. */
  value: CountCause | null;
  /** The chip marked SUGGESTED. */
  suggested?: CountCause | null;
  /** Omit for the read-only look (a plain chip with the cause in words). */
  onChange?: (cause: CountCause) => void;
  disabled?: boolean;
  /** The group's accessible name. */
  label?: string;
  /** The words on the Other chip where the screen draws more than "Other" ("Other, add a note" in the decision panel). */
  otherLabel?: string;
  className?: string;
}

const CAUSES: CountCause[] = ['PREP_NOT_LOGGED', 'SPOILAGE', 'MISCOUNT', 'LOSS', 'OTHER'];

/**
 * The five cause chips (Paper step 10, `1XM6-0`): Prep use not logged, Spoilage or spill, Miscount, Loss or theft, Other. One may
 * be chosen; the suggested one carries the word SUGGESTED. As a radio group with arrow-key movement. Read only (no `onChange`)
 * draws the chosen cause as a single chip.
 */
export function CauseChips({ value, suggested, onChange, disabled = false, label = 'Cause', otherLabel, className }: CauseChipsProps) {
  if (!onChange) {
    return value ? <span className={cn('inline-block border border-wds-success-border bg-wds-success-bg px-2 py-0.5 font-wds-sans text-[12px] leading-4 text-wds-success-fg', className)}>{CAUSE_TEXT[value]}</span> : null;
  }
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {CAUSES.map((cause) => {
        const on = value === cause;
        return (
          <button
            key={cause}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(cause)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              const next = CAUSES[(CAUSES.indexOf(cause) + (e.key === 'ArrowRight' ? 1 : CAUSES.length - 1)) % CAUSES.length] as CountCause;
              onChange(next);
              (e.currentTarget.parentElement?.querySelector(`[data-cause="${next}"]`) as HTMLElement | null)?.focus();
            }}
            data-cause={cause}
            tabIndex={on || (value === null && cause === CAUSES[0]) ? 0 : -1}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 border px-3 font-wds-sans text-[13px] leading-4 outline-none transition-[background-color,border-color,transform] duration-100 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98] disabled:opacity-50',
              on
                ? 'border-wds-success-border bg-wds-success-bg font-medium text-wds-success-fg'
                : 'border-wds-border-strong bg-wds-surface text-wds-text-ink [@media(hover:hover)]:hover:bg-wds-neutral-50',
            )}
          >
            {on ? (
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
            {cause === 'OTHER' && otherLabel ? otherLabel : CAUSE_TEXT[cause]}
            {suggested === cause ? <span className="font-wds-mono text-[9px] uppercase leading-3 tracking-[0.06em] text-wds-warning-fg">Suggested</span> : null}
          </button>
        );
      })}
    </div>
  );
}
