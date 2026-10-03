import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import type { SupplierCatalogLine, SupplierCatalogSummary, SupplierPackMismatch } from '../../types/supplier';
import {
  formatAmount,
  formatDayMonth,
  lastUpdateText,
  ownPackCount,
  packLabel,
  perUnitText,
  priceAlertSentence,
  priceAlertTag,
} from '../../lib/supplier-logic';
import { trimDecimal } from '../../lib/item-format';
import { CatalogKpiStrip, type CatalogKpiCell } from '../catalog/catalog-kpi-strip';
import { StockEmptyCard } from '../stock/stock-states';
import { InlineNotice, QuietAction, TabHeading, tableHead } from './supplier-ui';

export interface CatalogTabProps {
  supplierName: string;
  lines: SupplierCatalogLine[];
  summary: SupplierCatalogSummary | null;
  mismatches: SupplierPackMismatch[];
  canEdit: boolean;
  /** The line whose preferred switch is being saved. */
  savingPreferredId: string | null;
  onAddOne: (itemId?: string) => void;
  onAddSeveral: () => void;
  onSetPreferred: (line: SupplierCatalogLine) => void;
}

function LineName({ line }: { line: SupplierCatalogLine }) {
  const theirs = [line.supplierItemName, line.supplierItemCode].filter(Boolean);
  return (
    <span className="flex min-w-0 grow basis-0 flex-col gap-0.5 pr-4">
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
        <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{line.itemName}</span>
        {line.priceAlert ? (
          <span className="whitespace-nowrap border border-wds-warning-border bg-wds-warning-bg px-1.5 py-px font-wds-sans text-[11px] leading-[14px] text-wds-warning-fg">
            ▲ {priceAlertTag(line.priceAlert)}
          </span>
        ) : null}
      </span>
      {theirs.length > 0 ? (
        <span className="flex items-baseline gap-2">
          {line.supplierItemName ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-faint">{line.supplierItemName}</span> : null}
          {line.supplierItemCode ? <span className="font-wds-mono text-[11px] leading-4 text-wds-text-faint">{line.supplierItemCode}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

function PreferredCell({ line, canEdit, saving, onSet }: { line: SupplierCatalogLine; canEdit: boolean; saving: boolean; onSet: () => void }) {
  if (line.isPreferred) {
    const confirm = line.preferredNeedsConfirm;
    return (
      <span className="flex items-center gap-[7px]">
        <span aria-hidden className="size-1.5 shrink-0 rounded-[3px] bg-wds-success-fg" />
        {confirm && canEdit ? (
          <button
            type="button"
            disabled={saving}
            onClick={onSet}
            title="Press to confirm this supplier as preferred"
            className="whitespace-nowrap rounded-wds-sm font-wds-sans text-[13px] leading-4 text-wds-warning-fg underline-offset-2 hover:underline focus-visible:outline-none focus-visible:shadow-wds-ring disabled:opacity-60"
          >
            Preferred · confirm
          </button>
        ) : (
          <span className={cn('whitespace-nowrap font-wds-sans text-[13px] leading-4', confirm ? 'text-wds-warning-fg' : 'text-wds-success-fg')}>
            {confirm ? 'Preferred · confirm' : 'Preferred'}
          </span>
        )}
      </span>
    );
  }
  return canEdit ? (
    <QuietAction className="whitespace-nowrap text-wds-text-faint" disabled={saving} onClick={onSet}>
      Set preferred
    </QuietAction>
  ) : (
    <span className="font-wds-sans text-[13px] leading-4 text-wds-text-faint">—</span>
  );
}

/**
 * Catalog tab (Paper step 20): what this supplier sells, under their name and code, with price alerts, the receipt or
 * hand that set each price, and the four numbers above. A line is keyed by item + their pack, so the same item can
 * appear twice. The Price alerts cell filters the rows to the ones with an alert.
 */
export function CatalogTab({ supplierName, lines, summary, mismatches, canEdit, savingPreferredId, onAddOne, onAddSeveral, onSetPreferred }: CatalogTabProps) {
  const first = supplierName.split(/\s+/)[0] ?? supplierName;
  const [alertsOnly, setAlertsOnly] = React.useState(false);
  const shown = alertsOnly ? lines.filter((l) => l.priceAlert) : lines;
  const own = ownPackCount(lines);

  const latestReceipt = lines
    .filter((l) => l.lastReceipt && l.lastPriceAt)
    .sort((a, b) => new Date(b.lastPriceAt as string).getTime() - new Date(a.lastPriceAt as string).getTime())[0];

  const cells: CatalogKpiCell[] = summary
    ? [
        {
          key: 'items',
          label: 'Items they sell',
          value: String(summary.itemsTheySell),
          sub: `price lines${lines.length !== summary.itemsTheySell ? `: ${lines.length}` : ''}${own > 0 ? `, ${own} in its own pack` : ''}`,
        },
        {
          key: 'alerts',
          label: 'Price alerts',
          value: String(summary.priceAlerts),
          sub: priceAlertSentence(lines),
          attention: summary.priceAlerts > 0,
          arrow: true,
          onSelect: () => setAlertsOnly((on) => !on),
          active: alertsOnly,
        },
        {
          key: 'last',
          label: 'Last receipt',
          value: summary.lastReceiptAt ? formatDayMonth(summary.lastReceiptAt) : '—',
          sub: latestReceipt?.lastReceipt?.reference ?? (summary.lastReceiptAt ? 'signed receipt' : 'none yet'),
        },
        {
          key: 'spend',
          label: 'Spend · 90 days',
          value: `KES ${formatAmount(summary.spend90Days)}`,
          sub: 'on signed receipts',
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <TabHeading
        title={`What ${first} sells us`}
        actions={
          canEdit ? (
            <>
              <Button variant="secondary" className="h-[34px] px-3.5" onClick={() => onAddOne()}>Add one</Button>
              <Button className="h-[34px] px-4" onClick={onAddSeveral}>Add several items</Button>
            </>
          ) : null
        }
      >
        Prices update by themselves from signed receipts. A hand-set price is logged. A different pack gets its own line.
      </TabHeading>

      {cells.length > 0 ? <CatalogKpiStrip cells={cells} /> : null}

      {mismatches.length > 0 ? (
        <InlineNotice>
          <span className="font-medium">Pack not on file.</span>{' '}
          {mismatches.slice(0, 3).map((m, i) => (
            <span key={m.receiptLineId}>
              {i > 0 ? '; ' : ''}
              {m.reference}: {m.itemName}
              {m.packBuyUnit ? ` in a ${m.packSize ? `${trimDecimal(m.packSize)} ` : ''}${m.packBuyUnit}` : ''} at KES {formatAmount(m.unitPrice)}
              {canEdit ? (
                <>
                  {' '}
                  <button type="button" onClick={() => onAddOne(m.inventoryItemId)} className="font-medium underline underline-offset-2">
                    Add this pack
                  </button>
                </>
              ) : null}
            </span>
          ))}
          {mismatches.length > 3 ? ` and ${mismatches.length - 3} more` : ''}. Their price was not updated.
        </InlineNotice>
      ) : null}

      {lines.length === 0 ? (
        <div className="flex justify-center border border-wds-border bg-white px-4 py-8">
          <StockEmptyCard
            title="Nothing on file yet"
            description={`Add what ${first} sells and at what price. Prices then update from signed receipts.`}
            actionLabel={canEdit ? 'Add several items' : undefined}
            onAction={canEdit ? onAddSeveral : undefined}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div role="table" aria-label="What this supplier sells" className="min-w-[1000px] border border-wds-border bg-white">
            <div role="row" className="flex h-[34px] items-center border-b border-wds-text-ink px-4">
              <span role="columnheader" className={cn(tableHead, 'min-w-0 grow basis-0')}>ITEM</span>
              <span role="columnheader" className={cn(tableHead, 'w-[130px] shrink-0')}>THEIR PACK</span>
              <span role="columnheader" className={cn(tableHead, 'w-[110px] shrink-0 text-right')}>PRICE · KES</span>
              <span role="columnheader" className={cn(tableHead, 'w-[110px] shrink-0 text-right')}>PER KG / L</span>
              <span role="columnheader" className={cn(tableHead, 'w-[270px] shrink-0 pl-7')}>LAST UPDATE</span>
              <span role="columnheader" className={cn(tableHead, 'w-[150px] shrink-0')}>PREFERRED</span>
              <span role="columnheader" className="w-[70px] shrink-0" />
            </div>
            {shown.length === 0 ? (
              <p className="px-4 py-6 text-center font-wds-sans text-[13px] leading-4 text-wds-text-secondary">No price alerts. Press the Price alerts number again to see every line.</p>
            ) : (
              shown.map((line) => (
                <div key={line.id} role="row" className="flex min-h-14 items-center border-b border-wds-neutral-100 px-4 py-1.5 last:border-b-0">
                  <LineName line={line} />
                  <span role="cell" className="w-[130px] shrink-0 font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{packLabel(line)}</span>
                  <span role="cell" className="w-[110px] shrink-0 text-right font-wds-mono text-[13px] leading-4 text-wds-text-ink">
                    {line.lastPrice ? formatAmount(line.lastPrice) : <span className="text-wds-text-faint" title="The first signed receipt sets it">to confirm</span>}
                  </span>
                  <span role="cell" className="w-[110px] shrink-0 text-right font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{perUnitText(line) ?? ''}</span>
                  <span role="cell" className="w-[270px] shrink-0 pl-7 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{lastUpdateText(line)}</span>
                  <span role="cell" className="w-[150px] shrink-0">
                    <PreferredCell line={line} canEdit={canEdit} saving={savingPreferredId === line.id} onSet={() => onSetPreferred(line)} />
                  </span>
                  <span role="cell" className="flex w-[70px] shrink-0 justify-end">
                    {canEdit ? (
                      <Link
                        href={`/app/inventory/catalog?item=${line.inventoryItemId}`}
                        className="rounded-wds-sm font-wds-sans text-[13px] font-medium leading-4 text-wds-espresso-700 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:shadow-wds-ring"
                      >
                        History
                      </Link>
                    ) : null}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
