import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import type { SupplierListRow } from '../../types/supplier';
import { PROFILE_TOTAL, SUPPLIER_TYPE_LABEL, contactLine, formatAmount, profileLabel, termsLabel } from '../../lib/supplier-logic';
import { StatusText } from './supplier-ui';

const headCell = 'font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink';

/**
 * The suppliers table — Paper step 14: no header fill, an ink rule under the header, 54px rows. Profile turns
 * warning-coloured below 7 of 7. Owed is "—" when nothing is owed, and red on a supplier that is on hold.
 */
export function SuppliersTable({ rows }: { rows: SupplierListRow[] }) {
  return (
    <div role="table" aria-label="Suppliers" className="min-w-[900px] border border-wds-border bg-white">
      <div role="row" className="flex h-[34px] items-center border-b border-wds-text-ink px-4">
        <span role="columnheader" className={cn(headCell, 'w-[130px] shrink-0')}>
          CODE
        </span>
        <span role="columnheader" className={cn(headCell, 'min-w-0 grow basis-0')}>
          SUPPLIER
        </span>
        <span role="columnheader" className={cn(headCell, 'w-[100px] shrink-0')}>
          TYPE
        </span>
        <span role="columnheader" className={cn(headCell, 'w-[100px] shrink-0')}>
          STATUS
        </span>
        <span role="columnheader" className={cn(headCell, 'w-[140px] shrink-0')}>
          TERMS
        </span>
        <span role="columnheader" className={cn(headCell, 'w-[90px] shrink-0')}>
          PROFILE
        </span>
        <span role="columnheader" className={cn(headCell, 'w-[100px] shrink-0 text-right')}>
          OWED · KES
        </span>
      </div>
      {rows.map((row) => {
        const owed = Number.parseFloat(row.owedAmount) > 0;
        return (
          <Link
            key={row.id}
            role="row"
            href={`/app/inventory/suppliers/${row.id}`}
            className="flex h-[54px] items-center border-b border-wds-neutral-100 px-4 transition-colors duration-150 last:border-b-0 hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]"
          >
            <span role="cell" className="w-[130px] shrink-0 font-wds-mono text-[12px] leading-4 text-wds-text-secondary">
              {row.code}
            </span>
            <span role="cell" className="flex min-w-0 grow basis-0 flex-col gap-0.5">
              <span className="truncate font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{row.name}</span>
              <span className="truncate font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{contactLine(row)}</span>
            </span>
            <span role="cell" className="w-[100px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-ink">
              {SUPPLIER_TYPE_LABEL[row.type]}
            </span>
            <span role="cell" className="w-[100px] shrink-0">
              <StatusText status={row.status} />
            </span>
            <span role="cell" className="w-[140px] shrink-0 font-wds-sans text-[13px] leading-4 text-wds-text-ink">
              {termsLabel(row.defaultPaymentTerms, row.paymentDays)}
            </span>
            <span
              role="cell"
              className={cn('w-[90px] shrink-0 font-wds-mono text-[12px] leading-4', row.profileDone < PROFILE_TOTAL ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}
            >
              {profileLabel(row.profileDone)}
            </span>
            <span
              role="cell"
              className={cn(
                'w-[100px] shrink-0 text-right font-wds-mono text-[13px] leading-4',
                !owed ? 'text-wds-text-muted' : row.status === 'ON_HOLD' ? 'text-wds-error-fg' : 'text-wds-text-ink'
              )}
            >
              {owed ? formatAmount(row.owedAmount) : '—'}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
