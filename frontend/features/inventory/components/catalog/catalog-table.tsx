import * as React from 'react';

import { cn } from '@/lib/cn';
import type { InventoryItemListRow } from '../../types';
import { ITEM_TYPE_DOT_CLASS, ITEM_TYPE_LABEL } from '../../lib/item-labels';
import { formatDayMonthShort, formatHowWeBuy, formatUsedBy, trimDecimal } from '../../lib/item-format';

const headCell = 'font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink';

export interface CatalogTableProps {
  rows: InventoryItemListRow[];
  /** Restock level is a Store Manager figure; attendants never see it. */
  showRestockLevel: boolean;
  onRowClick?: (row: InventoryItemListRow) => void;
  /** The row just added: tinted, with a "New · add a supplier" tag until a supplier is added. */
  highlightId?: string | null;
  className?: string;
}

function MatchedLine({ matchedOn }: { matchedOn: NonNullable<InventoryItemListRow['matchedOn']> }) {
  const isCode = matchedOn.field === 'supplierItemCode';
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-warning-fg">MATCHED</span>
      <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        {matchedOn.supplier.name} {isCode ? 'code' : 'name'}
      </span>
      <span className={cn('text-[12px] leading-4 text-wds-text-ink', isCode ? 'font-wds-mono' : 'font-wds-sans')}>{matchedOn.value}</span>
    </span>
  );
}

/**
 * Items table — Paper step 01 ("Items table"): no header fill, an ink rule
 * under the header, 46px rows (taller when a supplier's code or name matched
 * the search). Retired rows are drawn faint, with no type dot.
 *
 * Suppliers is the count of suppliers with a line for the item ("—" for none).
 */
export function CatalogTable({ rows, showRestockLevel, onRowClick, highlightId, className }: CatalogTableProps) {
  return (
    <div role="table" aria-label="Items" className={cn('min-w-[860px] border border-wds-border bg-white', className)}>
      <div role="row" className="flex h-[34px] items-center border-b border-wds-text-ink px-4">
        <span role="columnheader" className={cn(headCell, 'min-w-0 grow basis-0')}>
          ITEM
        </span>
        <span role="columnheader" className={cn(headCell, 'w-[150px] shrink-0')}>
          WHAT IT IS
        </span>
        <span role="columnheader" className={cn(headCell, 'w-[120px] shrink-0')}>
          CATEGORY
        </span>
        <span role="columnheader" className={cn(headCell, 'w-[160px] shrink-0')}>
          HOW WE BUY IT
        </span>
        {showRestockLevel ? (
          <span role="columnheader" className={cn(headCell, 'w-[120px] shrink-0 text-right')}>
            RESTOCK LEVEL
          </span>
        ) : null}
        <span role="columnheader" className={cn(headCell, 'w-[90px] shrink-0 text-right')}>
          SUPPLIERS
        </span>
        <span role="columnheader" className={cn(headCell, 'w-[160px] shrink-0 pl-6')}>
          USED BY
        </span>
      </div>
      {rows.map((row) => {
        const retired = row.retiredAt !== null;
        const interactive = onRowClick !== undefined;
        return (
          <div
            key={row.id}
            role="row"
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? () => onRowClick(row) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }
                : undefined
            }
            className={cn(
              'flex min-h-[46px] items-center border-b border-wds-neutral-100 px-4 last:border-b-0',
              row.matchedOn ? 'py-2' : null,
              interactive && 'cursor-pointer transition-colors duration-150 hover:bg-wds-neutral-50 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]',
              highlightId === row.id && 'bg-wds-espresso-50 hover:bg-wds-espresso-50'
            )}
          >
            <span role="cell" className="flex min-w-0 grow basis-0 flex-col gap-[3px]">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'font-wds-sans text-[14px] leading-[18px]',
                    retired ? 'text-wds-text-muted' : 'font-medium text-wds-text-ink'
                  )}
                >
                  {row.name}
                  {retired ? ' (retired)' : ''}
                </span>
                {highlightId === row.id ? (
                  <span className="shrink-0 border border-wds-warning-border bg-wds-warning-bg px-1.5 py-px font-wds-sans text-[11px] leading-[14px] text-wds-warning-fg">
                    New · add a supplier
                  </span>
                ) : null}
              </span>
              {row.matchedOn ? <MatchedLine matchedOn={row.matchedOn} /> : null}
              {row.matchedOn?.field === 'supplierItemCode' && row.matchedOn.supplierItemName ? (
                <span className="font-wds-sans text-[12px] leading-4 text-wds-text-muted">Their name: {row.matchedOn.supplierItemName}</span>
              ) : null}
            </span>
            <span role="cell" className="w-[150px] shrink-0">
              {retired ? (
                <span className="font-wds-sans text-[13px] leading-4 text-wds-text-muted">{ITEM_TYPE_LABEL[row.type]}</span>
              ) : (
                <span className="flex items-center gap-[7px] font-wds-sans text-[13px] leading-4 text-wds-text-ink">
                  <span aria-hidden className={cn('size-1.5 shrink-0 rounded-[3px]', ITEM_TYPE_DOT_CLASS[row.type])} />
                  {ITEM_TYPE_LABEL[row.type]}
                </span>
              )}
            </span>
            <span role="cell" title={row.category?.name} className={cn('w-[120px] shrink-0 truncate font-wds-sans text-[13px] leading-4', retired ? 'text-wds-text-muted' : 'text-wds-text-ink')}>
              {row.category?.name ?? <span className="text-wds-text-muted">—</span>}
            </span>
            <span
              role="cell"
              className={cn('w-[160px] shrink-0 truncate font-wds-mono text-[12px] leading-4', retired ? 'text-wds-text-muted' : 'text-wds-text-secondary')}
              title={formatHowWeBuy(row)}
            >
              {formatHowWeBuy(row)}
            </span>
            {showRestockLevel ? (
              <span role="cell" className="w-[120px] shrink-0 text-right font-wds-mono text-[13px] leading-4 text-wds-text-ink">
                {!retired && row.centralStoreRestockLevel != null ? `${trimDecimal(row.centralStoreRestockLevel)} ${row.usageUnit}` : ''}
              </span>
            ) : null}
            <span
              role="cell"
              className={cn('w-[90px] shrink-0 text-right font-wds-mono text-[13px] leading-4', row.supplierCount > 0 ? 'text-wds-text-ink' : 'text-wds-text-muted')}
            >
              {retired ? '' : row.supplierCount > 0 ? row.supplierCount : '—'}
            </span>
            <span
              role="cell"
              className={cn('w-[160px] shrink-0 truncate pl-6 font-wds-sans text-[13px] leading-4', retired ? 'text-wds-text-muted' : 'text-wds-text-secondary')}
              title={retired ? undefined : formatUsedBy(row)}
            >
              {retired && row.retiredAt ? `Retired ${formatDayMonthShort(row.retiredAt)}` : formatUsedBy(row)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
