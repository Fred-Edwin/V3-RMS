import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Workforce status tag — the square, bordered pill used for file status
 * ("Complete", "Needs finishing", "Probation ends 14 Oct"), employment tags
 * ("Monthly", "Clocks in", "Casual") and checklist chips ("✓ Identity").
 * Paper: Employees list R3E-0 (row size) and employee file 11LC-0 (header size).
 *
 * Square corners and a 1 px border, 12 px text. Colour carries the status:
 * success = done, warning = needs a look, error = a problem, info = for your
 * information, neutral = a plain label (outlined, no fill).
 */
export type StatusTagTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const toneClass: Record<StatusTagTone, string> = {
  success: 'border-wds-success-border bg-wds-success-bg text-wds-success-fg',
  warning: 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
  error: 'border-wds-error-border bg-wds-error-bg text-wds-error-fg',
  info: 'border-wds-info-border bg-wds-info-bg text-wds-info-fg',
  neutral: 'border-wds-border-strong bg-transparent text-wds-text-secondary',
};

export interface StatusTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusTagTone;
  /** `row` is 2 px tall padding (tables); `header` is 3 px (file header, checklist chips). */
  size?: 'row' | 'header';
  /** Leading mark, for checklist chips: done is "✓", open is "○". */
  mark?: 'done' | 'open';
}

export function StatusTag({ tone, size = 'row', mark, className, children, ...props }: StatusTagProps) {
  return (
    <span
      className={cn(
        'inline-block whitespace-nowrap border px-2 font-wds-sans text-[12px] leading-4',
        size === 'row' ? 'py-0.5' : 'py-[3px]',
        toneClass[tone],
        className
      )}
      {...props}
    >
      {mark ? <span aria-hidden>{mark === 'done' ? '✓ ' : '○ '}</span> : null}
      {mark ? <span className="sr-only">{mark === 'done' ? 'Done: ' : 'Open: '}</span> : null}
      {children}
    </span>
  );
}

/**
 * Every tag the Employees, file and Home screens draw, by key, so a screen asks
 * for "bank missing" and not for a colour. The label is a default; a screen may
 * pass its own words (dates in "Probation ends 14 Oct" come from data).
 */
export type WorkforceTagKey =
  | 'complete'
  | 'needsFinishing'
  | 'probationEnds'
  | 'bankMissing'
  | 'contractMissing'
  | 'onProbation'
  | 'monthly'
  | 'casual'
  | 'clocksIn'
  | 'noLogin'
  | 'exited'
  | 'late'
  | 'overtime'
  | 'pending'
  | 'approved'
  | 'declined';

export const WORKFORCE_TAGS: Record<WorkforceTagKey, { tone: StatusTagTone; label: string }> = {
  complete: { tone: 'success', label: 'Complete' },
  needsFinishing: { tone: 'warning', label: 'Needs finishing' },
  probationEnds: { tone: 'warning', label: 'Probation ends' },
  bankMissing: { tone: 'warning', label: 'Bank details missing' },
  contractMissing: { tone: 'warning', label: 'No contract yet' },
  onProbation: { tone: 'warning', label: 'On probation' },
  monthly: { tone: 'neutral', label: 'Monthly' },
  casual: { tone: 'neutral', label: 'Casual' },
  clocksIn: { tone: 'neutral', label: 'Clocks in' },
  noLogin: { tone: 'neutral', label: 'No login' },
  exited: { tone: 'neutral', label: 'Exited' },
  late: { tone: 'error', label: 'Late' },
  overtime: { tone: 'info', label: 'Overtime' },
  pending: { tone: 'warning', label: 'Pending' },
  approved: { tone: 'success', label: 'Approved' },
  declined: { tone: 'error', label: 'Declined' },
};

export function WorkforceTag({
  tag,
  label,
  size,
  className,
}: {
  tag: WorkforceTagKey;
  /** Overrides the default words, for data-driven labels such as a date. */
  label?: string;
  size?: StatusTagProps['size'];
  className?: string;
}) {
  const def = WORKFORCE_TAGS[tag];
  return (
    <StatusTag tone={def.tone} size={size} className={className}>
      {label ?? def.label}
    </StatusTag>
  );
}
