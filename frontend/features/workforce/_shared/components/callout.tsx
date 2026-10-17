import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Callout: the one box for a note, a status card or a banner.
 *
 * Variants (Paper):
 * - `tint`   a tone-coloured box. Neutral is the grey "what changes" note (16W3-0, 1BCF-0);
 *            error is "Not in yet" (1B9X-0); warning is "This payslip is ... " (1S4P-0).
 * - `bar`    a white card with a 4 px left bar in the tone (phone cards 19CT-0, 1PO3-0).
 * - `dashed` an unfilled dashed box for "what this does" (1ISM-0).
 *
 * Options: `kicker` (mono caps over the title), `title`, `bullet` (the square
 * bullet of dialog notes), `action` (buttons under the text, or at the right with
 * `actionAt="end"`, as in the banner "Clocked in at 05:58 · Undo · 1:52", 19XC-0).
 * Words are props; the piece holds none.
 */
export type CalloutTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';
export type CalloutVariant = 'tint' | 'bar' | 'dashed';

const TINT: Record<CalloutTone, { box: string; text: string }> = {
  neutral: { box: 'border-wds-border bg-wds-neutral-50', text: 'text-wds-text-ink' },
  info: { box: 'border-wds-info-border bg-wds-info-bg', text: 'text-wds-info-fg' },
  success: { box: 'border-wds-success-border bg-wds-success-bg', text: 'text-wds-success-fg' },
  warning: { box: 'border-wds-warning-border bg-wds-warning-bg', text: 'text-wds-warning-fg' },
  error: { box: 'border-wds-error-border bg-wds-error-bg', text: 'text-wds-error-fg' },
};

const BAR: Record<CalloutTone, string> = {
  neutral: 'border-l-wds-neutral-400',
  info: 'border-l-wds-info-fg',
  success: 'border-l-wds-success-fg',
  // Paper's amber bar (#B27A0A) has no token; caramel-600 is the nearest (see README).
  warning: 'border-l-wds-caramel-600',
  error: 'border-l-wds-error-fg',
};

const KICKER: Record<CalloutTone, string> = {
  neutral: 'text-wds-text-secondary',
  info: 'text-wds-info-fg',
  success: 'text-wds-success-fg',
  warning: 'text-wds-warning-fg',
  error: 'text-wds-error-fg',
};

export function Callout({
  tone = 'neutral',
  variant = 'tint',
  kicker,
  title,
  children,
  bullet = false,
  action,
  actionAt = 'below',
  size = 'md',
  role,
  className,
}: {
  tone?: CalloutTone;
  variant?: CalloutVariant;
  kicker?: string;
  title?: string;
  children?: React.ReactNode;
  /** The square espresso bullet before the text (dialog notes). */
  bullet?: boolean;
  /** Buttons or a link. */
  action?: React.ReactNode;
  /** `below` puts them under the text; `end` puts them at the right of the text. */
  actionAt?: 'below' | 'end';
  /** `sm` is the dialog note (12/14 padding); `md` is a card (14/16). */
  size?: 'sm' | 'md';
  /** `alert` for an error that appears after an action; plain status otherwise. */
  role?: 'alert' | 'status';
  className?: string;
}) {
  const tint = TINT[tone];
  const bodyColour = variant === 'tint' ? tint.text : variant === 'dashed' ? 'text-wds-text-secondary' : 'text-wds-text-ink';
  const atEnd = Boolean(action) && actionAt === 'end';
  return (
    <div
      role={role}
      className={cn(
        'flex border',
        atEnd ? 'items-center justify-between gap-3' : 'flex-col gap-1.5',
        size === 'sm' ? 'px-3.5 py-3' : 'px-4 py-3.5',
        variant === 'tint' && tint.box,
        variant === 'bar' && cn('border-wds-border border-l-4 bg-wds-surface', BAR[tone]),
        variant === 'dashed' && 'border-dashed border-wds-neutral-400',
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {kicker ? <span className={cn('font-wds-mono text-[10px] leading-3 tracking-[0.08em]', variant === 'tint' ? tint.text : KICKER[tone])}>{kicker}</span> : null}
        {title ? (
          <span
            className={cn(
              'font-wds-sans font-semibold',
              variant === 'bar' ? 'text-[15px] leading-5' : 'text-[14px] leading-[18px]',
              variant === 'tint' ? tint.text : tone === 'success' && atEnd ? 'text-wds-success-fg' : 'text-wds-text-ink'
            )}
          >
            {title}
          </span>
        ) : null}
        {children ? (
          <div className={cn('flex gap-2.5 font-wds-sans text-[13px] leading-[19px]', bodyColour)}>
            {bullet ? <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-wds-primary" /> : null}
            <div className="min-w-0">{children}</div>
          </div>
        ) : null}
      </div>
      {action ? <div className={cn('flex flex-wrap items-center gap-2', atEnd ? 'shrink-0' : 'mt-1')}>{action}</div> : null}
    </div>
  );
}
