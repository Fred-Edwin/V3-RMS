import * as React from 'react';

import { cn } from '@/lib/cn';
import { formatMoney } from '../../lib/item-price';
import { FieldLabel } from './drawer-parts';

export interface PriceFieldProps {
  id: string;
  name: string;
  label: string;
  /** The quiet word beside the label ("optional"). */
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  /** Words after the number inside the box: "per bag", "per 50 kg bag". */
  unitText: string;
  /** The price per usage unit shown beside the box: "= KES 178 per kg". Omit when there is nothing to convert. */
  perUsageUnit?: { amount: number; unit: string } | null;
  error?: string;
  /** Box width: 190px for the usual price, 210px for their price (Paper steps 02 and 06). */
  width?: 190 | 210;
}

/**
 * A price per pack with the price per usage unit worked out beside it as it is typed (Paper steps 02 and 06):
 * a bordered box holding KES, the number and "per bag", then "= KES 178 per kg".
 */
export function PriceField({ id, name, label, hint, value, onChange, unitText, perUsageUnit, error, width = 190 }: PriceFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id} hint={hint}>
        {label}
      </FieldLabel>
      <div className="flex items-center gap-2.5">
        <div
          style={{ width }}
          className={cn(
            'flex h-[38px] shrink-0 items-center gap-2 rounded-wds-sm border border-wds-border-strong bg-white px-3 transition-colors',
            'focus-within:border-wds-selected-edge focus-within:shadow-[0_0_0_1px_var(--wds-selected-edge)]',
            error && 'border-wds-error-fg'
          )}
        >
          <span aria-hidden className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">
            KES
          </span>
          <input
            id={id}
            name={name}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            placeholder="8,900"
            className="min-w-0 grow bg-transparent font-wds-mono text-[14px] leading-[18px] text-wds-text-ink outline-none placeholder:text-wds-text-muted"
          />
          <span className="shrink-0 whitespace-nowrap font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{unitText}</span>
        </div>
        {perUsageUnit ? (
          <span aria-live="polite" className="font-wds-mono text-[13px] leading-4 text-wds-text-ink">
            = {formatMoney(perUsageUnit.amount)} per {perUsageUnit.unit}
          </span>
        ) : null}
      </div>
      {error ? (
        <span id={`${id}-error`} role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
          {error}
        </span>
      ) : null}
    </div>
  );
}
