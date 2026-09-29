'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { Combobox } from '@/components/ui2/combobox';
import { Topbar } from '@/components/app/shell/topbar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { NewGoodsReceiptMobile } from './new-goods-receipt-mobile';
import { ReceiptLineAddInline } from '../receipt-line-add-inline';
import { ReceiptLineGrid, type ReceiptLineRow } from '../receipt-line-grid';
import { SignSheetDialog } from '../sign-sheet';
import { useGoodsReceiptForm } from '../../hooks/use-goods-receipt-form';
import { useWdsToast } from '@/hooks/useWdsToast';
import { useAuthStore } from '@/store/authStore';
import { listItems, listSuppliers } from '../../services';
import { getExpectedDelivery, getLastPrice } from '../../services/receiving-api-service';
import type { CreateGoodsReceiptInput, GoodsReceiptDetail } from '../../types/receiving';
import type { InventoryItem, Supplier, SupplierPaymentTerms } from '../../types';

interface DraftLine {
  id: string;
  inventoryItemId: string;
  itemName: string;
  buyUnit: string;
  unitConversionLabel: string;
  qty: string;
  unitPrice: string;
  lastPrice: string | null;
  /** Set when this line came from the linked expected delivery — drives the qty-discrepancy badge. */
  expectedQty: string | null;
}

function toReceiptLineRow(line: DraftLine): ReceiptLineRow {
  const qtyNum = Number(line.qty) || 0;
  const priceNum = Number(line.unitPrice) || 0;
  const subtotal = (qtyNum * priceNum).toFixed(2);
  const lastPriceNum = line.lastPrice != null ? Number(line.lastPrice) : null;
  const priceAlertLabel =
    lastPriceNum && lastPriceNum > 0 && priceNum > lastPriceNum
      ? `${Math.round(((priceNum - lastPriceNum) / lastPriceNum) * 100)}% above last`
      : undefined;

  const expectedQtyNum = line.expectedQty != null ? Number(line.expectedQty) : null;
  let qtyDiscrepancyLabel: string | undefined;
  if (expectedQtyNum != null && qtyNum !== expectedQtyNum) {
    const diff = expectedQtyNum - qtyNum;
    qtyDiscrepancyLabel =
      diff > 0
        ? `Short ${diff} ${line.buyUnit} vs. expected`
        : `${Math.abs(diff)} ${line.buyUnit} over expected`;
  }

  return {
    id: line.id,
    itemName: line.itemName,
    unitConversionLabel: line.unitConversionLabel,
    qty: line.qty,
    buyUnit: line.buyUnit,
    unitPrice: line.unitPrice,
    subtotal,
    priceAlertLabel,
    qtyDiscrepancyLabel,
  };
}

/**
 * New Goods Receipt — screen 4 (`UQE-0` desktop, `4m` mobile). Reference:
 * `docs/features/inventory/06-sessions/milestone-2-s6-frontend-goods-receipt-prompt.md`.
 *
 * When a `?expectedDeliveryId=` param is present (the Receiving worklist's
 * "Receive" click), the form prefills supplier, payment terms, and every
 * line from that delivery — per Paper's own copy on `UQE-0`
 * ("Lines pre-filled from the linked purchase list — adjust quantity and
 * price to match what actually arrived"). Receiving without one (walk-in /
 * no expected delivery) still starts blank.
 *
 * Price-alert badges here are advisory / client-computed against
 * `getLastPrice` — the backend is the source of truth for what actually
 * triggers a persisted alert at sign time (`GoodsReceiptLine.priceAlert`).
 * Qty-discrepancy badges are purely a client-side comparison against the
 * linked delivery's estimate — nothing is persisted or enforced server-side.
 */
export function NewGoodsReceiptScreen() {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');
  const router = useRouter();
  const searchParams = useSearchParams();
  const expectedDeliveryId = searchParams?.get('expectedDeliveryId') ?? undefined;

  const { receiptId, saveDraft, savingDraft, draftError, sign, signing, signError } = useGoodsReceiptForm();
  const { toast } = useWdsToast();
  const role = useAuthStore((s) => s.role);
  const canListSuppliers = role === 'STORE_MANAGER';

  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = React.useState('');
  const [paymentTerms, setPaymentTerms] = React.useState<SupplierPaymentTerms>('INVOICE_TO_FOLLOW');
  const [supplierDocNumber, setSupplierDocNumber] = React.useState('');
  const [supplierDocDate, setSupplierDocDate] = React.useState('');
  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [addingLine, setAddingLine] = React.useState(false);
  const [signSheetOpen, setSignSheetOpen] = React.useState(false);
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = React.useState<Set<string>>(new Set());
  const [signedReceiptId, setSignedReceiptId] = React.useState<string | null>(null);
  const [savedReceipt, setSavedReceipt] = React.useState<GoodsReceiptDetail | null>(null);
  const [prefillNotice, setPrefillNotice] = React.useState(false);
  const [deliverySupplierName, setDeliverySupplierName] = React.useState('');

  React.useEffect(() => {
    // The supplier list is Store-Manager-only (the Attendant gets 403); an
    // Attendant's receipt is always prefilled from the expected delivery,
    // which carries the supplier name.
    if (canListSuppliers) {
      void listSuppliers({ includeRetired: false, perPage: 100 }).then((res) => setSuppliers(res.data));
    }
    void listItems({ includeRetired: false, perPage: 100 }).then((res) => setItems(res.data));
  }, [canListSuppliers]);

  // Prefill from the linked expected delivery, once, on mount.
  React.useEffect(() => {
    if (!expectedDeliveryId) return;
    let cancelled = false;
    void (async () => {
      const delivery = await getExpectedDelivery(expectedDeliveryId);
      if (cancelled) return;
      if (delivery.supplierId) setSupplierId(delivery.supplierId);
      if (delivery.supplierName) setDeliverySupplierName(delivery.supplierName);
      if (delivery.paymentTerms) setPaymentTerms(delivery.paymentTerms);
      const prefilled = await Promise.all(
        delivery.lines.map(async (line) => {
          const last = await getLastPrice(line.inventoryItemId);
          return {
            id: crypto.randomUUID(),
            inventoryItemId: line.inventoryItemId,
            itemName: line.itemName,
            buyUnit: line.buyUnit,
            unitConversionLabel: `buy: ${line.buyUnit} → usage: ${line.usageUnit}`,
            qty: line.quantity,
            unitPrice: last?.unitPrice ?? line.estimatedUnitPrice,
            lastPrice: last?.unitPrice ?? null,
            expectedQty: line.quantity,
          } satisfies DraftLine;
        }),
      );
      if (cancelled) return;
      setLines(prefilled);
      setPrefillNotice(true);
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately run once per mounted expectedDeliveryId — re-running on
    // every suppliers/items refetch would clobber the user's own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expectedDeliveryId]);

  const supplierOptions = React.useMemo(() => suppliers.map((s) => ({ value: s.id, label: s.name })), [suppliers]);

  const handleSupplierChange = (value: string) => {
    setSupplierId(value);
    const supplier = suppliers.find((s) => s.id === value);
    if (supplier) setPaymentTerms(supplier.defaultPaymentTerms);
  };

  const handleAddItem = async (item: InventoryItem) => {
    const last = await getLastPrice(item.id);
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        inventoryItemId: item.id,
        itemName: item.name,
        buyUnit: item.buyUnit,
        unitConversionLabel: `buy: ${item.buyUnit} → usage: ${item.usageUnit}`,
        qty: '1',
        unitPrice: last?.unitPrice ?? item.currentCost,
        lastPrice: last?.unitPrice ?? item.currentCost,
        expectedQty: null,
      },
    ]);
    setAddingLine(false);
  };

  const handleQtyChange = (id: string, value: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, qty: value } : l)));
  };

  const handleUnitPriceChange = (id: string, value: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, unitPrice: value } : l)));
  };

  const rows = React.useMemo(() => lines.map(toReceiptLineRow), [lines]);
  const receiptTotal = rows.reduce((sum, r) => sum + (Number(r.subtotal) || 0), 0);
  const alertedRows = React.useMemo(() => rows.filter((r) => r.priceAlertLabel), [rows]);

  const toggleAcknowledged = (id: string) => {
    setAcknowledgedAlertIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allAlertsAcknowledged = alertedRows.every((r) => acknowledgedAlertIds.has(r.id));
  const canSign =
    Boolean(supplierId) &&
    lines.length > 0 &&
    lines.every((l) => Number(l.qty) > 0 && Number(l.unitPrice) >= 0) &&
    allAlertsAcknowledged;

  const buildInput = (): CreateGoodsReceiptInput => ({
    supplierId,
    expectedDeliveryId,
    paymentTerms,
    supplierDocNumber: supplierDocNumber || undefined,
    // The date input gives back a plain "YYYY-MM-DD" string; the backend's
    // supplierDocDate is a full ISO 8601 datetime (z.string().datetime()),
    // same convention as every other date field in this contract.
    supplierDocDate: supplierDocDate ? new Date(`${supplierDocDate}T00:00:00.000Z`).toISOString() : undefined,
    lines: lines.map((l) => ({
      inventoryItemId: l.inventoryItemId,
      quantityBuyUnit: l.qty,
      unitPrice: l.unitPrice,
    })),
  });

  const handleSaveDraft = async () => {
    if (!supplierId) return;
    const saved = await saveDraft(buildInput());
    if (saved) {
      setSavedReceipt(saved);
      toast({ variant: 'success', title: 'Saved' });
    }
  };

  const handleOpenSignSheet = async () => {
    if (!canSign) return;
    const saved = await saveDraft(buildInput());
    if (saved) {
      setSavedReceipt(saved);
      setSignSheetOpen(true);
    }
  };

  const handleSignSubmit = async (pin: string) => {
    if (!receiptId || !savedReceipt) return;
    // acknowledgedAlertIds holds client-side draft-line ids (the grid's row
    // keys); the sign endpoint needs the server's GoodsReceiptLine ids,
    // matched here by inventoryItemId since the draft save just returned them.
    const acceptedServerIds = savedReceipt.lines
      .filter((serverLine) => {
        const draftLine = lines.find((l) => l.inventoryItemId === serverLine.inventoryItemId);
        return draftLine && acknowledgedAlertIds.has(draftLine.id);
      })
      .map((serverLine) => serverLine.id);
    const result = await sign(receiptId, { pin, acceptedPriceAlerts: acceptedServerIds });
    if (result.ok) {
      setSignSheetOpen(false);
      router.push(`/app/inventory/receiving/${result.receipt.id}`);
    } else if (result.error.kind === 'already-signed-or-empty') {
      setSignedReceiptId(receiptId);
    }
  };

  const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? (supplierId ? deliverySupplierName : '');

  if (!hydrated) return null;
  if (!isDesktop) {
    return (
      <NewGoodsReceiptMobile
        suppliers={suppliers}
        supplierId={supplierId}
        onSupplierChange={handleSupplierChange}
        paymentTerms={paymentTerms}
        onPaymentTermsChange={setPaymentTerms}
        supplierDocNumber={supplierDocNumber}
        onSupplierDocNumberChange={setSupplierDocNumber}
        rows={rows}
        onQtyChange={handleQtyChange}
        onUnitPriceChange={handleUnitPriceChange}
        items={items}
        onAddItem={(item) => void handleAddItem(item)}
        alertedRows={alertedRows}
        acknowledgedAlertIds={acknowledgedAlertIds}
        onToggleAcknowledged={toggleAcknowledged}
        receiptTotal={receiptTotal}
        onSaveDraft={() => void handleSaveDraft()}
        savingDraft={savingDraft}
        draftError={draftError}
        canSign={canSign}
        onSignAndSave={() => void handleOpenSignSheet()}
        prefillNotice={prefillNotice}
        signSheetOpen={signSheetOpen}
        onSignSheetOpenChange={setSignSheetOpen}
        supplierName={supplierName}
        lineCount={lines.length}
        onSignSubmit={(pin) => void handleSignSubmit(pin)}
        signing={signing}
        signError={signError}
        signedReceiptId={signedReceiptId}
        onViewSignedReceipt={() => signedReceiptId && router.push(`/app/inventory/receiving/${signedReceiptId}`)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar
        breadcrumb={{ section: 'Receiving', sectionHref: '/app/inventory/receiving', screen: 'New Goods Receipt' }}
        className="shrink-0"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-h1 text-wds-text-ink">New Goods Receipt</h1>
          <p className="font-wds-sans text-wds-body-sm text-wds-text-copy-muted">
            Record what actually arrived, then sign to move stock at the Central Store.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-wds-md border border-wds-border bg-wds-surface p-wds-4">
          <div className="flex flex-col gap-wds-1.5">
            <label className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Supplier</label>
            <Combobox
              value={supplierOptions.find((o) => o.value === supplierId)?.label ?? ''}
              onValueChange={handleSupplierChange}
              options={supplierOptions}
              placeholder="Select a supplier"
              aria-label="Supplier"
            />
          </div>
          <div className="flex flex-col gap-wds-1.5">
            <label className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Payment terms</label>
            <div className="flex h-8 w-fit overflow-hidden rounded-wds-sm border border-wds-border-strong">
              {(['INVOICE_TO_FOLLOW', 'PAY_NOW'] as const).map((terms) => (
                <button
                  key={terms}
                  type="button"
                  onClick={() => setPaymentTerms(terms)}
                  className={`px-wds-3 font-wds-sans text-wds-body-sm transition-colors ${
                    paymentTerms === terms ? 'bg-wds-neutral-950 text-white' : 'bg-wds-surface text-wds-text-copy-muted hover:bg-wds-neutral-50'
                  }`}
                >
                  {terms === 'INVOICE_TO_FOLLOW' ? 'Invoice' : 'Paid on delivery'}
                </button>
              ))}
            </div>
            <span className="font-wds-sans text-[11px] leading-[15px] text-wds-text-faint">
              Defaults from the supplier — you can change it for this receipt.
            </span>
          </div>
          <div className="flex flex-col gap-wds-1.5">
            <label className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Invoice / delivery note number</label>
            <input
              value={supplierDocNumber}
              onChange={(e) => setSupplierDocNumber(e.target.value)}
              placeholder="Optional — can be added later"
              className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-3 font-wds-sans text-wds-body-sm text-wds-text-ink focus-visible:outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring"
            />
          </div>
          <div className="flex flex-col gap-wds-1.5">
            <label className="font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted">Document date</label>
            <input
              type="date"
              value={supplierDocDate}
              onChange={(e) => setSupplierDocDate(e.target.value)}
              className="h-8 rounded-wds-sm border border-wds-border-strong bg-wds-surface px-wds-3 font-wds-sans text-wds-body-sm text-wds-text-ink focus-visible:outline-none focus-visible:border-wds-primary focus-visible:shadow-wds-ring"
            />
          </div>
        </div>

        {prefillNotice ? (
          <div className="flex items-start gap-wds-2 rounded-wds-md border border-wds-info-border bg-wds-info-bg px-wds-4 py-wds-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" className="mt-0.5 shrink-0">
              <path d="M9 11l3 3L22 4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-wds-info-fg" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-wds-info-fg" />
            </svg>
            <p className="font-wds-sans text-wds-body-sm text-wds-info-fg">
              Lines pre-filled from the linked purchase list — adjust quantity and price to match what actually arrived.
            </p>
          </div>
        ) : null}

        <ReceiptLineGrid
          rows={rows}
          onQtyChange={handleQtyChange}
          onUnitPriceChange={handleUnitPriceChange}
          onAddLine={() => setAddingLine(true)}
          addLineSlot={
            addingLine ? (
              <ReceiptLineAddInline items={items} onAdd={(item) => void handleAddItem(item)} onCancel={() => setAddingLine(false)} />
            ) : (
              <button
                type="button"
                onClick={() => setAddingLine(true)}
                className="flex h-11 shrink-0 items-center px-wds-4 text-left font-wds-sans text-wds-body-sm text-wds-caramel-600"
              >
                + Add item not on the purchase list
              </button>
            )
          }
        />

        {alertedRows.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-wds-md border border-wds-warning-fg bg-wds-surface p-wds-4">
            <p className="font-wds-sans text-wds-body-sm font-medium text-wds-warning-fg">
              Confirm the price on {alertedRows.length === 1 ? 'this line' : 'these lines'} before signing:
            </p>
            {alertedRows.map((row) => (
              <label key={row.id} className="flex items-center gap-wds-2 font-wds-sans text-wds-body-sm text-wds-text-ink">
                <input
                  type="checkbox"
                  checked={acknowledgedAlertIds.has(row.id)}
                  onChange={() => toggleAcknowledged(row.id)}
                />
                {row.itemName} — {row.priceAlertLabel}
              </label>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 rounded-wds-md border border-wds-border bg-wds-surface-sunken p-wds-4">
          <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
            On sign: stock rises at the Central Store · status becomes{' '}
            {paymentTerms === 'PAY_NOW' ? 'Paid' : 'Received — invoice pending'} · Store Manager notified.
          </p>
          {draftError ? <p className="font-wds-sans text-wds-caption text-wds-error-fg">{draftError}</p> : null}
          <div className="flex items-center justify-between">
            <span className="font-wds-mono text-wds-body-sm text-wds-text-ink">Total: KES {receiptTotal.toLocaleString()}</span>
            <div className="flex gap-wds-2">
              <Button variant="secondary" onClick={handleSaveDraft} disabled={!supplierId || lines.length === 0 || savingDraft}>
                {savingDraft ? 'Saving…' : 'Save draft'}
              </Button>
              <Button onClick={handleOpenSignSheet} disabled={!canSign || savingDraft || signing}>
                Sign & save
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SignSheetDialog
        open={signSheetOpen}
        onOpenChange={setSignSheetOpen}
        title="Sign & save"
        subtitle="Confirm this receipt with your PIN."
        helperText="Signing writes stock to the Central Store ledger and cannot be undone."
        documentSummary={{ title: supplierName, detail: `${lines.length} lines · KES ${receiptTotal.toLocaleString()}` }}
        confirmLabel={signError?.kind === 'already-signed-or-empty' ? 'View receipt' : 'Sign & save'}
        onSubmit={(pin) => {
          if (signError?.kind === 'already-signed-or-empty' && signedReceiptId) {
            router.push(`/app/inventory/receiving/${signedReceiptId}`);
            return;
          }
          void handleSignSubmit(pin);
        }}
        submitting={signing}
        error={signError?.message}
      />
    </div>
  );
}
