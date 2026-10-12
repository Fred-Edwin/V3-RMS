'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * Phone number pad with the one action key (Paper "Counting redesign", steps 2, 4 and 17; `1WIL-0`, `1WQJ-0`, `1X5I-0`).
 * Twelve keys (1 to 9, ".", 0, backspace) in a 3-column grid, and a tall action key on the right whose label follows the box:
 * `Next` (primary) when a number is typed, `Skip` (neutral) when the box is empty, `Keep` (neutral, with the figure under it) in a
 * recount. The label and tone are the caller's; this only draws them. Touch targets are 48 px tall; every key has hover (pointer
 * devices only), pressed, focus-ring and disabled states; the press scale is skipped under `prefers-reduced-motion`.
 */
export interface KeypadAction {
  label: string;
  /** A second line under the label, mono ("164 kg"). */
  detail?: string;
  tone: 'primary' | 'neutral';
  onPress: () => void;
  disabled?: boolean;
  /** Why the key is disabled, for assistive tech and the tooltip. */
  disabledReason?: string;
}

export interface KeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  action: KeypadAction;
  /** Disables the digits too (a save in flight that must not take new numbers). */
  disabled?: boolean;
  /**
   * `paper` is the Branch waste sheet (owner ruling D7): keys 46 high, no top border, panel padding 10/12, the word "Delete" instead of the
   * icon, and the Add key on the token gradient. The default look of every other keypad does not change.
   */
  look?: 'default' | 'paper';
  className?: string;
}

const ROWS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

const keyBase =
  'flex h-12 grow basis-0 items-center justify-center border border-wds-border bg-wds-surface font-wds-sans text-[22px] leading-7 text-wds-text-ink outline-none transition-[background-color,transform,box-shadow] duration-100 ease-out focus-visible:shadow-wds-ring disabled:pointer-events-none disabled:opacity-50 motion-safe:active:scale-[0.97] active:bg-wds-neutral-100 [@media(hover:hover)]:hover:bg-wds-neutral-50';

export function Keypad({ onDigit, onBackspace, action, disabled = false, look = 'default', className }: KeypadProps) {
  const paper = look === 'paper';
  const keyClass = paper ? cn(keyBase, 'h-[46px]') : keyBase;
  return (
    <div className={cn('flex shrink-0 gap-2 bg-wds-neutral-100 px-3', paper ? 'py-2.5' : 'border-t border-wds-border-strong pb-3.5 pt-2.5', className)}>
      <div className="flex grow flex-col gap-2" role="group" aria-label="Number pad">
        {ROWS.map((row) => (
          <div key={row.join('')} className="flex gap-2">
            {row.map((digit) => (
              <button key={digit} type="button" className={keyClass} disabled={disabled} onClick={() => onDigit(digit)}>
                {digit}
              </button>
            ))}
          </div>
        ))}
        <div className="flex gap-2">
          <button type="button" className={keyClass} disabled={disabled} onClick={() => onDigit('.')} aria-label="Decimal point">
            .
          </button>
          <button type="button" className={keyClass} disabled={disabled} onClick={() => onDigit('0')}>
            0
          </button>
          <button type="button" className={cn(keyClass, paper && 'text-[14px] leading-[18px]')} disabled={disabled} onClick={onBackspace} aria-label="Delete the last digit">
            {paper ? (
              'Delete'
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="text-wds-neutral-700">
                <path d="M9 6h11v12H9l-6-6z M12 10l4 4 M16 10l-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={action.onPress}
        disabled={action.disabled}
        title={action.disabled ? action.disabledReason : undefined}
        className={cn(
          'flex w-[104px] shrink-0 flex-col items-center justify-center gap-0.5 font-wds-sans outline-none transition-[background-color,transform,box-shadow,opacity] duration-100 ease-out focus-visible:shadow-wds-ring disabled:pointer-events-none disabled:opacity-50 motion-safe:active:scale-[0.98]',
          action.tone === 'primary' && paper
            ? 'bg-wds-gradient-primary text-white [@media(hover:hover)]:hover:brightness-110 active:brightness-95'
            : action.tone === 'primary'
            ?// Paper draws this tall key a little lighter than the full-width buttons (oklab 47.8 % at the top).
              'bg-[linear-gradient(180deg_in_oklab,color-mix(in_oklab,var(--wds-primary-btn-start)_67%,var(--wds-primary-btn-end)),var(--wds-primary-btn-end))] text-wds-surface [@media(hover:hover)]:hover:brightness-110 active:brightness-95'
            : 'border border-wds-border-strong bg-wds-surface text-wds-text-ink [@media(hover:hover)]:hover:bg-wds-neutral-50 active:bg-wds-neutral-100',
        )}
      >
        <span className="text-[17px] font-semibold leading-[22px]">{action.label}</span>
        {action.detail ? <span className="font-wds-mono text-wds-caption text-wds-text-secondary">{action.detail}</span> : null}
      </button>
    </div>
  );
}
