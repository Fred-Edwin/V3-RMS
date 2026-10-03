import * as React from 'react';

import { cn } from '@/lib/cn';
import type { SupplierDetail } from '../types/supplier';
import { formatFullDate, termsLongLabel } from '../lib/supplier-logic';
import { StatusPill, TypeTag } from './supplier-ui';

export type SupplierTab = 'overview' | 'contacts' | 'payment' | 'catalog' | 'documents';

const TAB_LABEL: Record<SupplierTab, string> = {
  overview: 'Overview',
  contacts: 'Contacts',
  payment: 'Payment',
  catalog: 'Catalog',
  documents: 'Documents',
};
const TAB_ORDER: readonly SupplierTab[] = ['overview', 'contacts', 'payment', 'catalog', 'documents'];

/** The supplier's name with its status and type, and the one line under it (Paper steps 16 and 17). */
export function SupplierTitle({ supplier }: { supplier: SupplierDetail }) {
  const meta = [
    supplier.code,
    termsLongLabel(supplier.defaultPaymentTerms, supplier.paymentDays),
    supplier.category?.name,
    `Created ${formatFullDate(supplier.createdAt)}${supplier.createdBy ? ` by ${supplier.createdBy.name}` : ''}`,
  ].filter(Boolean);
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-wds-sans text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-wds-text-ink">{supplier.name}</h1>
        <StatusPill status={supplier.status} />
        <TypeTag type={supplier.type} />
      </div>
      <p className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{meta.join(' · ')}</p>
    </div>
  );
}

/**
 * The five tabs. A count beside a label is how many rows its tab holds; `null` shows none (still loading).
 * The active tab has the 2px primary underline.
 */
export function SupplierTabs({ active, counts, onChange }: { active: SupplierTab; counts: Partial<Record<SupplierTab, number | null>>; onChange: (tab: SupplierTab) => void }) {
  return (
    <div role="tablist" aria-label="Supplier" className="flex shrink-0 gap-7 border-b border-wds-border">
      {TAB_ORDER.map((tab) => {
        const selected = tab === active;
        const count = counts[tab];
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`supplier-tab-${tab}`}
            aria-selected={selected}
            aria-controls={`supplier-panel-${tab}`}
            onClick={() => onChange(tab)}
            className={cn(
              'flex gap-1.5 border-b-2 pb-2.5 font-wds-sans text-[14px] leading-[18px] transition-colors duration-150 focus-visible:outline-none focus-visible:shadow-[0_2px_0_0_var(--wds-selected-edge)]',
              selected ? 'border-wds-selected-edge font-medium text-wds-text-ink' : 'border-transparent text-wds-text-secondary hover:text-wds-text-ink'
            )}
          >
            {TAB_LABEL[tab]}
            {count !== null && count !== undefined ? <span className="pt-0.5 font-wds-mono text-[11px] leading-[14px] font-normal text-wds-text-faint">{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
