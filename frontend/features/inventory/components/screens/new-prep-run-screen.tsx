'use client';

import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { Combobox } from '@/components/ui2/combobox';
import { DrawerShell } from '../drawer-shell';
import { MobileTaskHeader } from '@/components/app/shell/mobile-headers';
import { MobileStatusBar } from '@/components/app/shell/mobile-status-bar';
import { useNewPrepRunForm } from '../../hooks/use-new-prep-run-form';
import { useTypicalYield } from '../../hooks/use-typical-yield';
import { listItems } from '../../services';
import type { InventoryItem } from '../../types';
import type { CreatePrepRunInput, PrepRunDetail } from '../../types/prep';

interface DraftInputLine {
  id: string;
  inventoryItemId: string;
  itemName: string;
  usageUnit: string;
  quantity: string;
}

function TypicalYieldNudge({ outputItemId }: { outputItemId: string | null }) {
  const { typicalYield } = useTypicalYield(outputItemId);
  if (!outputItemId || !typicalYield || typicalYield.sampleSize === 0) return null;
  return (
    <div className="flex items-center gap-wds-2 rounded-wds-md border border-wds-info-border bg-wds-info-bg px-wds-4 py-wds-2.5">
      <span className="font-wds-sans text-wds-body-sm text-wds-info-fg">
        Typical: {typicalYield.typicalInputSummary} → {typicalYield.typicalYield}. A nudge from the rolling average — it never blocks or corrects your entry.
      </span>
    </div>
  );
}

function InputLineRow({
  line,
  onQuantityChange,
  onRemove,
}: {
  line: DraftInputLine;
  onQuantityChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-wds-2 rounded-wds-sm border border-wds-border bg-wds-surface px-wds-3 py-wds-2">
      <span className="grow min-w-0 truncate font-wds-sans text-wds-body-sm text-wds-text-ink" title={line.itemName}>
        {line.itemName}
      </span>
      <input
        type="number"
        min="0"
        step="any"
        value={line.quantity}
        onChange={(e) => onQuantityChange(line.id, e.target.value)}
        className="h-8 w-[90px] rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-2 text-right font-wds-mono text-wds-body-sm text-wds-text-ink focus-visible:outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring"
      />
      <span className="w-[40px] shrink-0 font-wds-sans text-wds-caption text-wds-text-copy-muted">{line.usageUnit}</span>
      <button
        type="button"
        onClick={() => onRemove(line.id)}
        className="shrink-0 font-wds-sans text-wds-caption text-wds-error-fg"
        aria-label={`Remove ${line.itemName}`}
      >
        Remove
      </button>
    </div>
  );
}

export interface NewPrepRunDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunRecorded: (run: PrepRunDetail) => void;
  variant: 'desktop' | 'mobile';
}

/**
 * New prep run — screen 2 (desktop drawer `ZAR-0` / mobile `ZIY-0` + confirm
 * sheet `ZKJ-0`). Uses `DrawerShell` directly (unlike Prep run detail) — this
 * screen has a real primary action, "Confirm run". Flow 3 has no signature
 * step, so this is a single confirm write, not a draft-then-sign flow like
 * Goods Receipt.
 */
export function NewPrepRunDrawer({ open, onOpenChange, onRunRecorded, variant }: NewPrepRunDrawerProps) {
  const { confirmRun, confirming, confirmError, setConfirmError } = useNewPrepRunForm();
  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [outputItemId, setOutputItemId] = React.useState('');
  const [inputLines, setInputLines] = React.useState<DraftInputLine[]>([]);
  const [actualYield, setActualYield] = React.useState('');
  const [addingInput, setAddingInput] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    void listItems({ includeRetired: false, perPage: 100 }).then((res) => setItems(res.data));
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setOutputItemId('');
      setInputLines([]);
      setActualYield('');
      setAddingInput(false);
      setConfirmError(null);
    }
  }, [open, setConfirmError]);

  const outputItem = items.find((i) => i.id === outputItemId);
  const outputOptions = React.useMemo(
    () => items.filter((i) => i.type === 'PREPPED').map((i) => ({ value: i.id, label: i.name })),
    [items],
  );
  // Two-stage prep is allowed — inputs may be prepped or stocked/raw items (Flow 3).
  const inputOptions = React.useMemo(
    () =>
      items
        .filter((i) => i.id !== outputItemId && !inputLines.some((l) => l.inventoryItemId === i.id))
        .map((i) => ({ value: i.id, label: i.name })),
    [items, outputItemId, inputLines],
  );

  const handleAddInput = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setInputLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), inventoryItemId: item.id, itemName: item.name, usageUnit: item.usageUnit, quantity: '' },
    ]);
    setAddingInput(false);
  };

  const handleQuantityChange = (id: string, value: string) => {
    setInputLines((prev) => prev.map((l) => (l.id === id ? { ...l, quantity: value } : l)));
  };

  const handleRemoveInput = (id: string) => {
    setInputLines((prev) => prev.filter((l) => l.id !== id));
  };

  const canConfirm =
    Boolean(outputItemId) &&
    inputLines.length > 0 &&
    inputLines.every((l) => Number(l.quantity) > 0) &&
    Number(actualYield) > 0;

  // Client-side preview only — advisory, matching ZAR-0's "= Σ input cost ÷
  // yield" footer. The server is the source of truth for the persisted
  // outputUnitCost (computed inside createPrepRun's transaction).
  const totalInputCostPreview = inputLines.reduce((sum, l) => {
    const item = items.find((i) => i.id === l.inventoryItemId);
    const qty = Number(l.quantity) || 0;
    const cost = item ? Number(item.currentCost) : 0;
    return sum + qty * cost;
  }, 0);
  const actualYieldNum = Number(actualYield) || 0;
  const outputUnitCostPreview = actualYieldNum > 0 ? totalInputCostPreview / actualYieldNum : null;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    const input: CreatePrepRunInput = {
      outputItemId,
      inputLines: inputLines.map((l) => ({ inventoryItemId: l.inventoryItemId, quantity: l.quantity })),
      actualYield,
    };
    const run = await confirmRun(input);
    if (run) onRunRecorded(run);
  };

  if (!open) return null;

  const body = (
    <div className="flex flex-col gap-wds-4">
      <div className="flex flex-col gap-wds-1.5">
        <label className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Output item</label>
        <Combobox
          value={outputOptions.find((o) => o.value === outputItemId)?.label ?? ''}
          onValueChange={setOutputItemId}
          options={outputOptions}
          placeholder="Select a prepped item"
          aria-label="Output item"
        />
      </div>

      <TypicalYieldNudge outputItemId={outputItemId || null} />

      <div className="flex flex-col gap-wds-2">
        <div className="flex items-center justify-between">
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Inputs consumed</span>
        </div>
        {inputLines.map((line) => (
          <InputLineRow key={line.id} line={line} onQuantityChange={handleQuantityChange} onRemove={handleRemoveInput} />
        ))}
        {addingInput ? (
          <Combobox
            value=""
            onValueChange={handleAddInput}
            options={inputOptions}
            placeholder="Search items to add…"
            aria-label="Input item to add"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingInput(true)}
            className="flex h-9 items-center px-wds-1 text-left font-wds-sans text-wds-body-sm text-wds-caramel-600"
          >
            + Add input
          </button>
        )}
      </div>

      <div className="flex gap-wds-3">
        <div className="flex grow flex-col gap-wds-1.5">
          <label className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Actual yield</label>
          <input
            type="number"
            min="0"
            step="any"
            value={actualYield}
            onChange={(e) => setActualYield(e.target.value)}
            placeholder="0"
            className="h-8 rounded-wds-sm border-[1.5px] border-wds-primary bg-wds-surface px-wds-3 font-wds-mono text-wds-body-sm text-wds-text-ink focus-visible:outline-none focus-visible:shadow-wds-ring"
          />
        </div>
        <div className="flex w-[96px] shrink-0 flex-col gap-wds-1.5">
          <label className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Unit</label>
          <div className="flex h-8 items-center rounded-wds-sm border border-wds-border bg-wds-neutral-50 px-wds-3 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            {outputItem?.usageUnit ?? '—'}
          </div>
        </div>
      </div>

      {confirmError ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{confirmError}</p> : null}

      <div className="flex flex-col gap-wds-1.5 border-t border-wds-border pt-wds-4">
        <div className="flex items-baseline justify-between">
          <span className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Output unit cost</span>
          <span className="font-wds-mono text-wds-body text-wds-text-ink">
            {outputUnitCostPreview !== null && outputItem
              ? `KES ${outputUnitCostPreview.toFixed(2)} / ${outputItem.usageUnit}`
              : '—'}
          </span>
        </div>
        <span className="font-wds-sans text-wds-field-label text-wds-text-faint">
          = Σ input cost KES {totalInputCostPreview.toLocaleString()} ÷ {actualYield || 0} {outputItem?.usageUnit ?? ''}. No signature — the ledger records who and when.
        </span>
      </div>
    </div>
  );

  if (variant === 'mobile') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-wds-canvas">
        <MobileStatusBar />
        <MobileTaskHeader
          title="New prep run"
          subtitle="One atomic ledger transaction, recorded after the batch is done"
          trailingAction="Cancel"
          onBack={() => onOpenChange(false)}
          onTrailingAction={() => onOpenChange(false)}
        />
        <div className="flex-1 overflow-y-auto p-wds-4">{body}</div>
        <div className="p-wds-4">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm || confirming}
            className="flex h-11 w-full items-center justify-center rounded-wds-md bg-wds-gradient-primary font-wds-sans text-wds-body font-medium text-wds-primary-fg disabled:opacity-60"
          >
            {confirming ? 'Confirming…' : 'Confirm run'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="New prep run"
      description="One atomic ledger transaction — inputs consumed, output produced. Recorded after the batch is done."
      primaryLabel="Confirm run"
      onPrimaryAction={() => void handleConfirm()}
      primaryDisabled={!canConfirm || confirming}
    >
      {body}
    </DrawerShell>
  );
}
