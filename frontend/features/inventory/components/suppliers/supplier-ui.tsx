import * as React from 'react';

import { cn } from '@/lib/cn';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui2/dropdown-menu';
import type { SupplierStatus, SupplierType } from '../../types/supplier';
import { SUPPLIER_STATUS_LABEL, SUPPLIER_TYPE_LABEL } from '../../lib/supplier-logic';

/** The pieces the supplier screens share: status and type tags, selectable chips, filter menus. */

const STATUS_TONE: Record<SupplierStatus, { dot: string; text: string; box: string }> = {
  ACTIVE: { dot: 'bg-wds-success-fg', text: 'text-wds-success-fg', box: 'border-wds-success-border bg-wds-success-bg' },
  ON_HOLD: { dot: 'bg-wds-warning-fg', text: 'text-wds-warning-fg', box: 'border-wds-warning-border bg-wds-warning-bg' },
  ARCHIVED: { dot: 'bg-wds-neutral-400', text: 'text-wds-text-secondary', box: 'border-wds-border-strong bg-wds-neutral-50' },
};

/** Dot and word, no box: the Status column of the list. */
export function StatusText({ status }: { status: SupplierStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span className="flex items-center gap-[7px]">
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-[3px]', tone.dot)} />
      <span className={cn('font-wds-sans text-[13px] leading-4', tone.text)}>{SUPPLIER_STATUS_LABEL[status]}</span>
    </span>
  );
}

/** The tinted pill beside the supplier's name. */
export function StatusPill({ status }: { status: SupplierStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span className={cn('flex items-center gap-1.5 border px-2 py-0.5', tone.box)}>
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-[3px]', tone.dot)} />
      <span className={cn('font-wds-sans text-[12px] leading-4', tone.text)}>{SUPPLIER_STATUS_LABEL[status]}</span>
    </span>
  );
}

export function TypeTag({ type }: { type: SupplierType }) {
  return <span className="border border-wds-border-strong bg-white px-2 py-0.5 font-wds-sans text-[12px] leading-4 text-wds-text-ink">{SUPPLIER_TYPE_LABEL[type]}</span>;
}

/** A choice in a drawer (Regular / Occasional, Invoice to follow / Pay now): the picked one has the 1.5px selected edge. */
export function ChoiceChip({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center whitespace-nowrap px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink transition-[background-color,border-color,transform] duration-150 rounded-wds-sm',
        'focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98] disabled:opacity-60',
        selected ? 'border-[1.5px] border-wds-selected-edge bg-wds-espresso-50 font-medium' : 'border border-wds-border-strong bg-white hover:bg-wds-neutral-50'
      )}
    >
      {children}
    </button>
  );
}

export interface FilterMenuOption<T extends string> {
  value: T | null;
  label: string;
}

/** A filter chip with a menu: "Status: Active ▾". `value` null means the "All" option. */
export function FilterMenu<T extends string>({
  name,
  valueLabel,
  options,
  onSelect,
  align = 'start',
}: {
  name: string;
  valueLabel: string;
  options: FilterMenuOption<T>[];
  onSelect: (value: T | null) => void;
  align?: 'start' | 'end';
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-wds-sm border border-wds-border-strong bg-white px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink transition-colors hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:shadow-wds-ring"
        >
          {name}: {valueLabel} <span aria-hidden className="ml-1.5 text-[9px]">▾</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {options.map((option) => (
          <DropdownMenuItem key={option.label} onSelect={() => onSelect(option.value)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The two-line header of every list screen: title and one sentence. */
export function PageHeading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <h1 className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">{title}</h1>
      <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{children}</p>
    </div>
  );
}

/** A tab's heading: title, one sentence, and the primary actions on the right (Paper steps 18, 20, 22, 23). */
export function TabHeading({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">{title}</h2>
        <p className="max-w-[820px] font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{children}</p>
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

/** The mono, uppercase header cell of the tab tables. */
export const tableHead = 'font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink';

/** A text action in a row ("Change", "Edit", "History"): espresso, medium. */
export function RowAction({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-wds-sm font-wds-sans text-[13px] font-medium leading-4 text-wds-espresso-700 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:shadow-wds-ring disabled:opacity-60',
        className
      )}
      {...props}
    />
  );
}

/** A quiet text action ("Remove", "Make primary", "Set preferred"): muted until hovered. */
export function QuietAction({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-wds-sm font-wds-sans text-[13px] leading-4 text-wds-text-secondary transition-colors hover:text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring disabled:opacity-60',
        className
      )}
      {...props}
    />
  );
}

/** A small inline problem or note at the top of a tab (a failed row action). */
export function InlineNotice({ children, tone = 'error' }: { children: React.ReactNode; tone?: 'error' | 'warning' | 'info' }) {
  return (
    <div
      role={tone === 'info' ? 'status' : 'alert'}
      className={cn(
        'border px-3.5 py-2.5 font-wds-sans text-[12px] leading-4',
        tone === 'error' && 'border-wds-error-border bg-wds-error-bg text-wds-error-fg',
        tone === 'warning' && 'border-wds-warning-border bg-wds-warning-bg text-wds-warning-fg',
        tone === 'info' && 'border-wds-info-border bg-wds-info-bg text-wds-info-fg'
      )}
    >
      {children}
    </div>
  );
}
