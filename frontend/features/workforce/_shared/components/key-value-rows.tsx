import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Label left, value right (Paper 1J7K-0 "Approve the October run?", 1DAK-0). The
 * list starts under a 1 px ink rule; each row has a hairline under it. Numbers
 * and money are `mono`; words are plain. `from` draws the struck old value and
 * an arrow before the new one.
 */

export type ValueTone = 'default' | 'success' | 'warning' | 'error' | 'muted';

export const VALUE_TONE_CLASS: Record<ValueTone, string> = {
  default: 'text-wds-text-ink',
  success: 'text-wds-success-fg',
  warning: 'text-wds-warning-fg',
  error: 'text-wds-error-fg',
  muted: 'text-wds-text-secondary',
};

export interface KeyValueRow {
  label: string;
  value: React.ReactNode;
  /** Numbers, money, times: Geist Mono. */
  mono?: boolean;
  tone?: ValueTone;
  /** The old value, struck out, before the new one. */
  from?: string;
}

export function KeyValueRows({
  rows,
  'aria-label': ariaLabel,
  topRule = true,
  className,
}: {
  rows: KeyValueRow[];
  'aria-label'?: string;
  /** The ink rule over the first row (as in the approval dialogs). */
  topRule?: boolean;
  className?: string;
}) {
  return (
    <dl aria-label={ariaLabel} className={cn('m-0 flex flex-col', topRule && 'border-t border-wds-text-ink', className)}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-wds-neutral-100 py-[9px]">
          <dt className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{r.label}</dt>
          <dd className={cn('m-0 text-right text-[13px] leading-4', r.mono ? 'font-wds-mono' : 'font-wds-sans', VALUE_TONE_CLASS[r.tone ?? 'default'])}>
            {r.from !== undefined ? (
              <>
                <span className="text-wds-text-secondary line-through decoration-wds-neutral-400">{r.from}</span>
                <span aria-hidden className="mx-2 text-wds-text-faint">→</span>
                <span className="sr-only"> to </span>
              </>
            ) : null}
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
