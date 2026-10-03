'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import type { InventoryItemDetail, ItemHistoryEntry, ItemSupplierLine } from '../../types';
import { ITEM_TYPE_DOT_CLASS, ITEM_TYPE_LABEL } from '../../lib/item-labels';
import { formatDayMonthShort, formatPackLine, formatUsedBy, itemNeedsSetup, trimDecimal } from '../../lib/item-format';
import { formatHistoryEntry, formatHistoryWhen, formatMoney } from '../../lib/item-price';
import { DangerLink, DrawerError, DrawerFrame, FactRow, SectionLabel, SecondaryFooterButton, Tag } from './drawer-parts';

const kes = formatMoney;

/** Price per usage unit for a supplier line: the line's pack if it names one, else the item's. */
function pricePerUsageUnit(line: ItemSupplierLine, item: InventoryItemDetail): string | null {
  if (!line.lastPrice) return null;
  const perPack = line.packSize ?? item.conversionFactor ?? item.packSize;
  if (!perPack || Number.parseFloat(perPack) <= 0) return null;
  return kes(String(Number.parseFloat(line.lastPrice) / Number.parseFloat(perPack)));
}

function SupplierLineRow({ line, item }: { line: ItemSupplierLine; item: InventoryItemDetail }) {
  const priced = line.lastPrice !== null;
  const tag = line.isPreferred ? (
    line.preferredNeedsConfirm ? <Tag tone="warning">Preferred · confirm</Tag> : <Tag tone="success">Preferred</Tag>
  ) : !priced ? (
    <Tag tone="warning">To confirm</Tag>
  ) : null;
  const names = line.supplierItemName || line.supplierItemCode;
  const pack = line.buyUnit ? `${line.buyUnit}${line.packSize ? ` of ${trimDecimal(line.packSize)} ${item.usageUnit}` : ''}` : null;
  const perUnit = pricePerUsageUnit(line, item);
  return (
    <div className="flex items-center gap-3 border-b border-wds-neutral-100 py-3">
      <div className="flex min-w-0 grow flex-col gap-[3px]">
        <span className="flex items-center gap-2">
          <span className="truncate font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{line.supplierName}</span>
          {tag}
        </span>
        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          {names
            ? `Their name: ${[line.supplierItemName, line.supplierItemCode].filter(Boolean).join(' · ')}`
            : 'Their name and code: not set yet'}
          {pack ? ` · ${pack}` : ''}
          <br />
          {priced
            ? line.lastPriceSetBy
              ? `Price set by ${line.lastPriceSetBy.name}${line.lastPriceAt ? ` on ${formatDayMonthShort(line.lastPriceAt)}` : ''}. Updates from signed receipts.`
              : `Price from a signed receipt${line.lastPriceAt ? ` on ${formatDayMonthShort(line.lastPriceAt)}` : ''}. Updates from each signed receipt.`
            : 'Not priced yet. The first signed receipt fills the price.'}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="whitespace-nowrap font-wds-mono text-[13px] leading-4 text-wds-text-ink">
          {priced && line.lastPrice ? `${kes(line.lastPrice)} / ${line.buyUnit ?? item.buyUnit}` : 'No price yet'}
        </span>
        <span className="whitespace-nowrap font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">
          {priced ? (perUnit ? `${perUnit} / ${item.usageUnit}` : '') : 'first receipt sets it'}
        </span>
      </div>
    </div>
  );
}

export interface ItemDetailViewProps {
  item: InventoryItemDetail;
  /** What happened to the item, newest first; `null` when it could not be read (the panel is then left out). */
  history: ItemHistoryEntry[] | null;
  onEdit: () => void;
  onAddSeller: () => void;
  onRetire: () => void;
  onRestore: () => void;
  restoreBusy: boolean;
  actionError: string | null;
  onOpenRestockLevels: () => void;
}

/**
 * The item page (Paper steps 05 and 07): pack and units, restock level, who sells
 * it with their name and code under each supplier, and a history of every change.
 */
export function ItemDetailView({ item, history, onEdit, onAddSeller, onRetire, onRestore, restoreBusy, actionError, onOpenRestockLevels }: ItemDetailViewProps) {
  const retired = item.retiredAt !== null;
  const bought = item.type !== 'PREPPED';
  const todo: string[] = [];
  if (!retired) {
    if (bought && itemNeedsSetup(item)) todo.push('Set the pack and units, so receiving counts it right.');
    if (bought && item.suppliers.length === 0) todo.push(`Add who sells it, so ${item.name} can go on an order.`);
    if (!item.category) todo.push('Choose a category.');
  }
  const onHand = trimDecimal(item.centralStoreOnHand);

  return (
    <DrawerFrame
      bodyGap="page"
      titleSize="page"
      title={item.name}
      subtitle={
        <span className="flex items-center gap-2.5 font-wds-sans text-[13px] leading-4">
          <span className="flex items-center gap-1.5 text-wds-text-secondary">
            <span aria-hidden className={cn('size-1.5 shrink-0 rounded-[3px]', ITEM_TYPE_DOT_CLASS[item.type])} />
            {ITEM_TYPE_LABEL[item.type]}
          </span>
          {item.category ? (
            <>
              <span aria-hidden className="text-wds-text-muted">
                ·
              </span>
              <span className="text-wds-text-secondary">{item.category.name}</span>
            </>
          ) : null}
          {retired ? (
            <>
              <span aria-hidden className="text-wds-text-muted">
                ·
              </span>
              <span className="text-wds-text-muted">Retired {formatDayMonthShort(item.retiredAt ?? '')}</span>
            </>
          ) : null}
        </span>
      }
      footer={
        <>
          {retired ? (
            <button
              type="button"
              onClick={onRestore}
              disabled={restoreBusy}
              className="rounded-wds-sm font-wds-sans text-[14px] leading-[18px] text-wds-espresso-700 hover:underline focus-visible:outline-none focus-visible:shadow-wds-ring disabled:opacity-60"
            >
              Restore item
            </button>
          ) : (
            <DangerLink onClick={onRetire}>Retire item</DangerLink>
          )}
          <SecondaryFooterButton onClick={onEdit} className="!px-5 font-medium">
            Edit item
          </SecondaryFooterButton>
        </>
      }
    >
      {actionError ? <DrawerError>{actionError}</DrawerError> : null}
      {todo.length > 0 ? (
        <div className="flex gap-2.5 border border-wds-warning-border bg-wds-warning-bg px-3.5 py-3">
          <span aria-hidden className="mt-[5px] size-1.5 shrink-0 rounded-[3px] bg-wds-warning-fg" />
          <div className="flex flex-col gap-0.5">
            <span className="font-wds-sans text-[13px] font-semibold leading-4 text-wds-warning-fg">
              Needs setup · {todo.length === 1 ? 'one thing left' : `${todo.length} things left`}
            </span>
            {todo.map((line) => (
              <span key={line} className="font-wds-sans text-[12px] leading-4 text-wds-text-ink">
                {line}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <SectionLabel>How we buy and use it</SectionLabel>
        <div className="flex flex-col border-t border-wds-text-ink">
          {bought ? (
            <FactRow label="Pack" mono>
              {formatPackLine(item)}
            </FactRow>
          ) : null}
          <FactRow label="Stock kept in" mono>
            {item.usageUnit}
          </FactRow>
          <FactRow label="Used by">{formatUsedBy(item)}</FactRow>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Restock level</SectionLabel>
        <div className="flex items-center justify-between border border-wds-border px-3.5 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">
              Central Store · {item.centralStoreRestockLevel ? `${trimDecimal(item.centralStoreRestockLevel)} ${item.usageUnit}` : 'not set'}
            </span>
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
              On hand {onHand} {item.usageUnit} · suggestions cover {item.daysOfCover ? trimDecimal(item.daysOfCover) : '15'} days · departments set their own
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenRestockLevels}
            className="shrink-0 rounded-wds-sm font-wds-sans text-[13px] font-medium leading-4 text-wds-espresso-700 hover:underline focus-visible:outline-none focus-visible:shadow-wds-ring"
          >
            Restock levels →
          </button>
        </div>
      </div>

      {bought ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <SectionLabel>Who sells it</SectionLabel>
            {item.suppliers.length > 0 && !retired ? (
              <button
                type="button"
                onClick={onAddSeller}
                className="rounded-wds-sm font-wds-sans text-[13px] font-medium leading-4 text-wds-espresso-700 hover:underline focus-visible:outline-none focus-visible:shadow-wds-ring"
              >
                + Add another
              </button>
            ) : null}
          </div>
          {item.suppliers.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 border border-dashed border-wds-border-strong p-5">
              <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Nobody yet</span>
              {!retired ? (
                <Button className="h-[34px] !px-4 text-[13px]" onClick={onAddSeller}>
                  Add who sells it
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col border-t border-wds-text-ink">
              {item.suppliers.map((line) => (
                <SupplierLineRow key={line.lineId} line={line} item={item} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {history !== null ? (
        <div className="flex flex-col gap-2">
          <SectionLabel>History</SectionLabel>
          <div className="flex flex-col border-t border-wds-text-ink">
            {history.length === 0 ? (
              <p className="py-[9px] font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Nothing recorded yet. Changes from now on are kept here.</p>
            ) : (
              history.map((entry) => (
                <div key={entry.id} className="flex gap-3.5 border-b border-wds-neutral-100 py-[9px]">
                  <span className="w-[92px] shrink-0 font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{formatHistoryWhen(entry.createdAt)}</span>
                  <span className="flex min-w-0 grow flex-col gap-0.5">
                    <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{formatHistoryEntry(entry)}</span>
                    {entry.reason ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Reason: {entry.reason}</span> : null}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </DrawerFrame>
  );
}

