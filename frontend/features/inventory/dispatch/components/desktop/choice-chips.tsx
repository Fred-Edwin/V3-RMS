'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * The reason and kind chips of Paper D15, D16, D20 and the Carriers dialogs: one chip is chosen (dark espresso fill), the others are
 * white with a hairline. A radio group, so the arrow keys move and select, Tab leaves it, and the group has a name.
 */
export function ChoiceChips<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T | ''; options: readonly { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean }) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: React.KeyboardEvent, index: number): void => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    refs.current[next]?.focus();
    const target = options[next];
    if (target) onChange(target.value);
  };
  const focusIndex = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option, index) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={index === focusIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'h-[38px] border px-4 font-wds-sans text-[14px] leading-[18px] outline-none transition-colors duration-150 focus-visible:shadow-wds-ring disabled:opacity-60',
              on ? 'border-wds-espresso-900 bg-wds-espresso-900 text-wds-primary-fg' : 'border-wds-border-strong bg-wds-surface text-wds-text-ink hover:bg-wds-neutral-50',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
