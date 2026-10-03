'use client';

import * as React from 'react';

import { Skeleton } from '@/components/ui2/skeleton';
import { Button } from '@/components/ui2/button';
import { useRestockHistory, type RestockHistoryTarget } from '../hooks/use-restock-history';
import type { RestockHistoryEntry } from '../../types';
import { formatHistoryWhen } from '../../catalog/lib/item-price';
import { DrawerFrame, DrawerHost, DrawerError, SecondaryFooterButton } from '../../catalog/components/drawer-parts';
import { formatNumber } from '../../_shared/components/stock-format';
import { StockEmptyCard, StockErrorCard } from '../../_shared/components/stock-states';
import * as DialogPrimitive from '@radix-ui/react-dialog';

/** What was asked for: one item's history, or the location's recent changes. */
export interface HistoryRequest extends RestockHistoryTarget {
  /** "Sugar, white" for one item; omitted for the recent changes. */
  itemName?: string;
  /** "Central Store" or "Kitchen · Nyeri Town". */
  whoseLabel: string;
}

/** "150 → 180 kg", "Set to 120 kg", "Cleared (was 120 kg)". */
export function describeChange(entry: Pick<RestockHistoryEntry, 'oldLevel' | 'newLevel' | 'usageUnit'>): string {
  const { oldLevel, newLevel, usageUnit } = entry;
  if (newLevel === null) return oldLevel === null ? 'Cleared' : `Cleared (was ${formatNumber(oldLevel)} ${usageUnit})`;
  if (oldLevel === null) return `Set to ${formatNumber(newLevel)} ${usageUnit}`;
  return `${formatNumber(oldLevel)} → ${formatNumber(newLevel)} ${usageUnit}`;
}

function HistoryRow({
  entry,
  showItem,
  busy,
  anyBusy,
  readOnly,
  onPutBack,
}: {
  entry: RestockHistoryEntry;
  showItem: boolean;
  busy: boolean;
  anyBusy: boolean;
  readOnly: boolean;
  onPutBack: () => void;
}) {
  const canPutBack = entry.oldLevel !== null && !readOnly;
  return (
    <li className="flex items-center gap-2 border-b border-wds-neutral-100 py-3">
      <span className="flex w-[92px] shrink-0 flex-col gap-0.5">
        <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-ink">{formatHistoryWhen(entry.createdAt)}</span>
        <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{entry.changedBy.name}</span>
      </span>
      <span className="flex min-w-0 grow basis-0 flex-col gap-0.5">
        {showItem ? <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">{entry.itemName}</span> : null}
        <span className="font-wds-mono text-[13px] leading-4 text-wds-text-ink">{describeChange(entry)}</span>
        {entry.reason ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{entry.reason}</span> : entry.oldLevel === null ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">First level for this item</span> : null}
      </span>
      <span className="flex w-[110px] shrink-0 justify-end">
        {canPutBack ? (
          <Button
            variant="secondary"
            className="h-[30px] w-[110px] !px-2 text-[13px] text-wds-espresso-700"
            disabled={anyBusy}
            onClick={onPutBack}
            aria-label={`Put back ${formatNumber(entry.oldLevel ?? 0)} ${entry.usageUnit} for ${entry.itemName}`}
          >
            {busy ? 'Putting back…' : `Put back ${formatNumber(entry.oldLevel ?? 0)}`}
          </Button>
        ) : null}
      </span>
    </li>
  );
}

export interface RestockHistoryDrawerProps {
  request: HistoryRequest | null;
  onClose: () => void;
  /** A level was put back: the page behind reloads its rows and strip. */
  onPutBack: () => void;
  /** The reader may look but not change: no Put back. */
  readOnly?: boolean;
}

/**
 * Level history — Paper step 13: when, who, "150 → 180 kg", the reason, and "Put back 150" on every row
 * that replaced an earlier level. A put back adds a new entry; the old one stays on record.
 */
export function RestockHistoryDrawer({ request, onClose, onPutBack, readOnly = false }: RestockHistoryDrawerProps) {
  // Keep the last request while the drawer slides out, so the title does not blank mid-animation.
  const lastRequest = React.useRef<HistoryRequest | null>(null);
  if (request) lastRequest.current = request;
  const shown = request ?? lastRequest.current;
  const history = useRestockHistory(request);
  const { entries, status, error, reload, putBack, puttingBackId, putBackError } = history;

  const perItem = Boolean(shown?.inventoryItemId);
  const nowLevel = perItem && entries[0] ? entries[0].newLevel : null;
  const subtitle = perItem
    ? `${shown?.whoseLabel ?? ''}${entries[0] ? ` · ${nowLevel === null ? 'no level now' : `now ${formatNumber(nowLevel)} ${entries[0].usageUnit}`}` : ''}`
    : `${shown?.whoseLabel ?? ''} · latest changes across items`;

  const handlePutBack = async (changeId: string) => {
    const entry = await putBack(changeId);
    if (entry) onPutBack();
  };

  return (
    <DrawerHost open={request !== null} onOpenChange={(open) => (open ? undefined : onClose())} label="Restock level history">
      <DrawerFrame
        eyebrow="Restock level history"
        title={perItem ? (shown?.itemName ?? 'Item') : 'Recent changes'}
        subtitle={subtitle}
        bodyGap="form"
        footer={
          <span className="flex w-full justify-end">
            <DialogPrimitive.Close asChild>
              <SecondaryFooterButton className="!px-[22px]">Close</SecondaryFooterButton>
            </DialogPrimitive.Close>
          </span>
        }
      >
        {putBackError ? <DrawerError>{putBackError}</DrawerError> : null}
        {status === 'error' ? (
          <StockErrorCard title="Couldn’t load the history" description={error ?? 'Try again.'} onRetry={() => void reload()} className="py-6" />
        ) : status === 'idle' || (status === 'loading' && entries.length === 0) ? (
          <div role="status" aria-live="polite" className="flex flex-col gap-3">
            <span className="sr-only">Loading history</span>
            <Skeleton className="h-4 w-[60%]" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : entries.length === 0 ? (
          <StockEmptyCard className="py-6" title="No changes yet" description={perItem ? 'This item’s level has not been set or changed here.' : 'No level has been set or changed here yet.'} />
        ) : (
          <div className="flex flex-col">
            <div className="flex h-8 shrink-0 items-center border-b border-wds-text-ink">
              <span className="w-[100px] shrink-0 font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">WHEN</span>
              <span className="grow font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink">CHANGE</span>
              <span className="w-[110px] shrink-0" />
            </div>
            <ul aria-label="Level changes">
              {entries.map((entry) => (
                <HistoryRow
                  key={entry.id}
                  entry={entry}
                  showItem={!perItem}
                  readOnly={readOnly}
                  busy={puttingBackId === entry.id}
                  anyBusy={puttingBackId !== null}
                  onPutBack={() => void handlePutBack(entry.id)}
                />
              ))}
            </ul>
          </div>
        )}
        <div className="border border-wds-border bg-wds-neutral-50 px-3.5 py-3">
          <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            Putting a level back adds a new entry. The old entry stays on record. The same list shows changes a Department Head makes to their own levels.
          </p>
        </div>
      </DrawerFrame>
    </DrawerHost>
  );
}
