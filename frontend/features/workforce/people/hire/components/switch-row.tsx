'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

/**
 * A boxed setting with a switch (Paper "Tracks time", "Eligible for overtime"): a title and a grey line at the left, the green
 * switch at the right. It is one `role="switch"` button whose name is the title and whose description is the grey line, so the whole
 * row is the target.
 */
export function SwitchRow({ title, description, checked, onChange, disabled = false }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const id = React.useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 border border-wds-border bg-wds-surface px-3.5 py-3.5 text-left outline-none transition-colors focus-visible:shadow-wds-ring disabled:opacity-60 [@media(hover:hover)]:hover:bg-wds-neutral-50"
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span id={`${id}-t`} className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{title}</span>
        <span id={`${id}-d`} className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{description}</span>
      </span>
      <span aria-hidden className={cn('relative h-[26px] w-[40px] shrink-0 rounded-full transition-colors', checked ? 'bg-wds-success-fg' : 'bg-wds-neutral-300')}>
        <span className={cn('absolute top-[3px] h-5 w-5 rounded-full bg-white transition-[left]', checked ? 'left-[17px]' : 'left-[3px]')} />
      </span>
    </button>
  );
}
