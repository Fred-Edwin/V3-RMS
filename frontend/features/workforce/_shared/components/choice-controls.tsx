'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { DISABLED, FOCUS_RING, MOTION, PRESSED, onHover } from '../lib/interaction';

/**
 * Controls that choose.
 *
 * - `ChoiceChips`   one choice from a short row of chips (unpaid break 18XL-0, decision 1CQE-0).
 * - `OptionList`    full-width stacked options, the chosen one filled ink, optional tick (19FV-0).
 * - `RadioCards`    radio rows with a title and a line (18Y7-0, 1BC7-0): warm fill + espresso border when chosen.
 * - `ActionCards`   stacked cards that DO something, one of them brown (1BAE-0).
 * - `RemovableChip` / `AddChip`  a chosen item with a ×, and the dashed "+ Department" (18YK-0).
 *
 * The first three are real radio inputs under the paint, so arrow keys move and a screen
 * reader hears "radio, 2 of 5". `ChipLegend` is the heading they share with `ReasonChips`.
 */

export type LegendStyle = 'caps' | 'sentence';

/** The legend over a group: mono capitals ("WHY, FROM THE RECORD") or a sentence ("If you decline, say why"), with an optional hint. */
export function ChipLegend({ children, style = 'caps', hint }: { children: React.ReactNode; style?: LegendStyle; hint?: string }) {
  return (
    <legend
      className={cn(
        'mb-2.5 flex items-baseline gap-2 p-0',
        style === 'caps' ? 'font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary' : 'font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink'
      )}
    >
      {children}
      {hint ? <span className="font-wds-sans text-[12px] font-normal leading-4 tracking-normal text-wds-text-secondary">{hint}</span> : null}
    </legend>
  );
}

export interface ChoiceOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function ChoiceChips({
  legend,
  legendStyle = 'sentence',
  hint,
  options,
  value,
  onChange,
  size = 'md',
  disabled = false,
  name,
  trailing,
}: {
  legend: string;
  legendStyle?: LegendStyle;
  /** "optional" or "required", shown after the legend. */
  hint?: 'optional' | 'required';
  options: readonly ChoiceOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** `md` 13 px (py 5, px 12); `sm` 12 px (px 10), the reason chips of a dialog. */
  size?: 'md' | 'sm';
  disabled?: boolean;
  name?: string;
  /** Something at the end of the row ("Paid hours: 7.5 h"). */
  trailing?: React.ReactNode;
}) {
  const autoName = React.useId();
  const groupName = name ?? autoName;
  return (
    <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
      <ChipLegend style={legendStyle} hint={hint}>
        {legend}
      </ChipLegend>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((o) => {
          const chosen = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                'relative inline-flex cursor-pointer items-center border py-[5px] font-wds-sans',
                size === 'sm' ? 'px-2.5 text-[12px] leading-4' : 'px-3 text-[13px] leading-4',
                MOTION,
                'has-[:focus-visible]:shadow-wds-ring motion-safe:active:scale-[0.98]',
                (disabled || o.disabled) && 'pointer-events-none opacity-60',
                chosen ? 'border-wds-text-ink bg-wds-text-ink text-wds-primary-fg' : cn('border-wds-border-strong text-wds-text-ink', onHover('bg-wds-neutral-50'))
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={o.value}
                checked={chosen}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="absolute inset-0 m-0 cursor-pointer opacity-0 focus-visible:outline-none"
              />
              {o.label}
            </label>
          );
        })}
        {trailing ? <span className="ml-auto font-wds-sans text-[13px] leading-4 text-wds-text-ink">{trailing}</span> : null}
      </div>
    </fieldset>
  );
}

export function OptionList({
  legend,
  options,
  value,
  onChange,
  tick = false,
  disabled = false,
  name,
}: {
  /** The question. Read by screen readers only: the screen's own heading above the list shows it. */
  legend: string;
  options: readonly ChoiceOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** A ✓ at the right of the chosen option. */
  tick?: boolean;
  disabled?: boolean;
  name?: string;
}) {
  const autoName = React.useId();
  const groupName = name ?? autoName;
  return (
    <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-col gap-2.5">
        {options.map((o) => {
          const chosen = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                'relative flex h-[52px] cursor-pointer items-center justify-between border px-4 font-wds-sans text-[15px] leading-[18px]',
                MOTION,
                'has-[:focus-visible]:shadow-wds-ring motion-safe:active:scale-[0.99]',
                (disabled || o.disabled) && 'pointer-events-none opacity-60',
                chosen ? 'border-wds-text-ink bg-wds-text-ink text-wds-primary-fg' : cn('border-wds-border-strong text-wds-text-ink', onHover('bg-wds-neutral-50'))
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={o.value}
                checked={chosen}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="absolute inset-0 m-0 cursor-pointer opacity-0 focus-visible:outline-none"
              />
              {o.label}
              {tick && chosen ? <span aria-hidden>✓</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export interface RadioCardOption {
  value: string;
  title: string;
  description?: string;
  disabled?: boolean;
}

export function RadioCards({
  legend,
  legendStyle = 'sentence',
  options,
  value,
  onChange,
  columns = 1,
  disabled = false,
  name,
}: {
  legend: string;
  legendStyle?: LegendStyle;
  options: readonly RadioCardOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** 2 puts the cards side by side ("Nyeri Town only | Every site"). */
  columns?: 1 | 2 | 3;
  disabled?: boolean;
  name?: string;
}) {
  const autoName = React.useId();
  const groupName = name ?? autoName;
  return (
    <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
      <ChipLegend style={legendStyle}>{legend}</ChipLegend>
      <div className={cn('grid gap-2.5', columns === 3 ? 'sm:grid-cols-3' : columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1')}>
        {options.map((o) => {
          const chosen = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                'relative flex cursor-pointer items-center gap-2.5 border px-3 py-2.5',
                MOTION,
                'has-[:focus-visible]:shadow-wds-ring',
                (disabled || o.disabled) && 'pointer-events-none opacity-60',
                chosen
                  ? 'border-wds-primary bg-[color-mix(in_oklab,var(--wds-caramel-100)_55%,white)]'
                  : cn('border-wds-border-strong', onHover('bg-wds-neutral-50'))
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={o.value}
                checked={chosen}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="absolute inset-0 m-0 cursor-pointer opacity-0 focus-visible:outline-none"
              />
              <span
                aria-hidden
                className={cn('h-4 w-4 shrink-0 rounded-full bg-wds-surface', MOTION, chosen ? 'border-[5px] border-wds-primary' : 'border border-wds-text-faint')}
              />
              <span className="flex min-w-0 flex-col">
                <span className={cn('font-wds-sans text-[13px] leading-4 text-wds-text-ink', chosen && 'font-medium')}>{o.title}</span>
                {o.description ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{o.description}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export interface ActionCardItem {
  key: string;
  title: string;
  description?: string;
  onSelect: () => void;
  /** The one brown card. At most one per group. */
  primary?: boolean;
  disabled?: boolean;
  /** Why it cannot be used now, shown under the description. A role-blocked action is not passed at all. */
  disabledReason?: string;
}

export function ActionCards({ items, label, className }: { items: readonly ActionCardItem[]; label: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-col gap-2.5', className)}>
      {items.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={a.onSelect}
          disabled={a.disabled}
          className={cn(
            'flex flex-col items-stretch gap-0.5 px-4 py-3.5 text-left',
            MOTION,
            FOCUS_RING,
            PRESSED,
            DISABLED,
            a.primary ? cn('bg-wds-primary', onHover('bg-wds-primary-hover')) : cn('border border-wds-border-strong', onHover('bg-wds-neutral-50'))
          )}
        >
          <span className={cn('font-wds-sans text-[15px] leading-[18px]', a.primary ? 'font-semibold text-wds-primary-fg' : 'font-medium text-wds-text-ink')}>{a.title}</span>
          {a.description ? (
            <span className={cn('font-wds-sans text-[12px] leading-4', a.primary ? 'text-[color-mix(in_oklab,var(--wds-primary-fg)_82%,var(--wds-primary))]' : 'text-wds-text-secondary')}>
              {a.description}
            </span>
          ) : null}
          {a.disabled && a.disabledReason ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{a.disabledReason}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** A chosen item with a real × button ("Pastry ×"). */
export function RemovableChip({ label, onRemove, removeLabel, disabled = false }: { label: string; onRemove: () => void; removeLabel?: string; disabled?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-wds-text-ink bg-wds-text-ink py-[5px] pl-2.5 pr-1.5 font-wds-sans text-[13px] leading-4 text-wds-primary-fg">
      {label}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={removeLabel ?? `Remove ${label}`}
        className={cn('flex h-5 w-5 items-center justify-center', MOTION, FOCUS_RING, DISABLED, 'focus-visible:shadow-[0_0_0_2px_var(--wds-surface)]', onHover('bg-white/15'))}
      >
        <span aria-hidden>×</span>
      </button>
    </span>
  );
}

/** The dashed "+ Department" chip that opens a picker. */
export function AddChip({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center border border-dashed border-wds-neutral-400 px-2.5 py-[5px] font-wds-sans text-[13px] leading-4 text-wds-primary',
        MOTION,
        FOCUS_RING,
        PRESSED,
        DISABLED,
        onHover('bg-wds-neutral-50')
      )}
    >
      {children}
    </button>
  );
}
