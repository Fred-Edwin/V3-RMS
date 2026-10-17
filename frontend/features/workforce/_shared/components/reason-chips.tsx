'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../lib/interaction';
import { OTHER_REASON, type ReasonValue } from '../lib/reason';

/**
 * Reason chips: a short list of reasons plus "Other" (rule 06). Real radio
 * inputs under the chips, so the arrow keys move between them and a screen
 * reader hears "radio, 2 of 5". Choosing "Other" opens a text box that gets focus.
 * The screen supplies the reasons and the words.
 */
export interface ReasonOption {
  key: string;
  label: string;
}

export function ReasonChips({
  legend,
  options,
  value,
  onChange,
  otherLabel = 'Other',
  otherPlaceholder = 'Say what happened',
  disabled = false,
  name,
}: {
  legend: string;
  options: ReasonOption[];
  value: ReasonValue;
  onChange: (next: ReasonValue) => void;
  otherLabel?: string;
  otherPlaceholder?: string;
  disabled?: boolean;
  /** Radio group name; give two groups on one screen different names. */
  name?: string;
}) {
  const autoName = React.useId();
  const groupName = name ?? autoName;
  const otherRef = React.useRef<HTMLTextAreaElement>(null);
  const all = [...options, { key: OTHER_REASON, label: otherLabel }];

  React.useEffect(() => {
    if (value.choice === OTHER_REASON) otherRef.current?.focus();
  }, [value.choice]);

  return (
    <fieldset disabled={disabled} className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
      <legend className="mb-2.5 p-0 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((o) => {
          const selected = value.choice === o.key;
          return (
            <label
              key={o.key}
              className={cn(
                'relative inline-flex h-8 cursor-pointer items-center border px-3 font-wds-sans text-[13px] leading-4',
                MOTION,
                'has-[:focus-visible]:shadow-wds-ring',
                'motion-safe:active:scale-[0.98]',
                disabled && 'pointer-events-none opacity-60',
                selected
                  ? 'border-wds-text-ink bg-wds-text-ink text-wds-canvas'
                  : cn('border-wds-border-strong bg-transparent text-wds-text-ink', onHover('bg-wds-neutral-50'))
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={o.key}
                checked={selected}
                onChange={() => onChange({ choice: o.key, otherText: value.otherText })}
                className={cn('absolute inset-0 m-0 cursor-pointer opacity-0', FOCUS_RING)}
              />
              {o.label}
            </label>
          );
        })}
      </div>
      {value.choice === OTHER_REASON ? (
        <textarea
          ref={otherRef}
          rows={2}
          autoComplete="off"
          aria-label={otherLabel}
          placeholder={otherPlaceholder}
          value={value.otherText}
          onChange={(e) => onChange({ choice: OTHER_REASON, otherText: e.target.value })}
          className={cn(
            'w-full resize-none border border-wds-border-strong bg-wds-surface px-3 py-2 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink placeholder:text-wds-text-faint',
            'focus-visible:border-wds-primary focus-visible:outline-none focus-visible:shadow-wds-ring'
          )}
        />
      ) : null}
    </fieldset>
  );
}
