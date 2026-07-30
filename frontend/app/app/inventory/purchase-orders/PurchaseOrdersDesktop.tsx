'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Pencil, Plus, RotateCcw, Search, Send, Truck, Undo2, X, XCircle } from 'lucide-react';
import Link from 'next/link';
import {
  Button,
  Card,
  ConfirmDialog,
  ExcelTable,
  IconButton,
  Input,
  PageHeader,
  PageLayout,
  type ExcelColumn,
  type SelectOption,
  Select,
} from '@/components/ui';
import { PurchaseOrderStatusBadge } from '@/components/inventory/PurchaseOrderStatusBadge';
import { QuantityInput } from '@/components/inventory/QuantityInput';
import {
  cancelPurchaseOrder,
  getPurchaseOrder,
  listInventoryItems,
  listPurchaseOrders,
  receivePurchaseOrderLine,
  reversePurchaseOrderLineReceipt,
  sendPurchaseOrder,
  unsendPurchaseOrder,
  updatePurchaseOrderLines,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { cn } from '@/lib/cn';
import { buyUnitCostValue } from '@/lib/inventory-format';
import type { InventoryItem, PurchaseOrder, PurchaseOrderStatus } from '@/types/inventory';

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });

const formatKes = (value: number): string =>
  `Ksh ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const orderTotal = (po: PurchaseOrder): number =>
  po.lines.reduce((sum, line) => sum + parseFloat(line.orderedQty) * parseFloat(line.unitPrice), 0);

const STATUS_FILTERS: SelectOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

interface OrderRow extends Record<string, unknown> {
  po: PurchaseOrder;
}

type LineState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
interface DraftLine {
  receivedQty: string;
  invoicePrice: string;
  state: LineState;
}

interface EditLine {
  inventoryItemId: string;
  name: string;
  buyUnit: string;
  qty: string;
  unitPrice: string;
}

// app/app/layout.tsx mounts {children} twice for STORE_MANAGER (dual desktop
// sidebar + CSS-hidden mobile shell) — no mobile variant of this screen
// exists yet (Session 8), so the mobile-shell copy renders nothing rather
// than duplicating data-fetching and DOM element ids.
export function PurchaseOrdersDesktop(): JSX.Element | null {
  const isDesktop = useIsDesktopShell();
  if (!isDesktop) return null;
  return <PurchaseOrdersDesktopInner />;
}

function PurchaseOrdersDesktopInner(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('');

  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftLine>>({});
  const [confirmAction, setConfirmAction] = useState<'send' | 'cancel' | 'unsend' | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<PurchaseOrder['lines'][number] | null>(null);

  // DRAFT line editing
  const [isEditingLines, setIsEditingLines] = useState(false);
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [catalogItems, setCatalogItems] = useState<InventoryItem[]>([]);
  const [itemPickerSearch, setItemPickerSearch] = useState('');
  const [isSavingLines, setIsSavingLines] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await listPurchaseOrders(accessToken);
      setOrders(result);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load purchase orders', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = useCallback((po: PurchaseOrder) => {
    setSelectedPo(po);
    setIsEditingLines(false);
    const nextDrafts: Record<string, DraftLine> = {};
    for (const line of po.lines) {
      nextDrafts[line.id] = {
        receivedQty: line.receivedQty !== '0' ? line.receivedQty : line.orderedQty,
        invoicePrice: line.invoicePrice ?? line.unitPrice,
        state: 'idle',
      };
    }
    setDrafts(nextDrafts);
  }, []);

  const refreshSelected = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      const fresh = await getPurchaseOrder(id, accessToken);
      setSelectedPo(fresh);
      void load();
    },
    [accessToken, load],
  );

  const rows = useMemo<OrderRow[]>(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((po) => !statusFilter || po.status === statusFilter)
      .filter((po) => !q || po.poNumber.toLowerCase().includes(q) || po.supplier.name.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((po) => ({ po }));
  }, [orders, search, statusFilter]);

  const handleSend = async () => {
    if (!accessToken || !selectedPo) return;
    setIsActing(true);
    try {
      await sendPurchaseOrder(selectedPo.id, accessToken);
      toast({ variant: 'success', title: 'Purchase order sent', message: `${selectedPo.poNumber} was sent to ${selectedPo.supplier.name}.` });
      await refreshSelected(selectedPo.id);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to send order', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsActing(false);
      setConfirmAction(null);
    }
  };

  const handleCancel = async () => {
    if (!accessToken || !selectedPo) return;
    setIsActing(true);
    try {
      await cancelPurchaseOrder(selectedPo.id, accessToken);
      toast({ variant: 'success', title: 'Purchase order cancelled', message: `${selectedPo.poNumber} was cancelled.` });
      await refreshSelected(selectedPo.id);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to cancel order', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsActing(false);
      setConfirmAction(null);
    }
  };

  const handleUnsend = async () => {
    if (!accessToken || !selectedPo) return;
    setIsActing(true);
    try {
      await unsendPurchaseOrder(selectedPo.id, accessToken);
      toast({ variant: 'success', title: 'Purchase order returned to draft', message: `${selectedPo.poNumber} can now be edited.` });
      await refreshSelected(selectedPo.id);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to unsend order', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsActing(false);
      setConfirmAction(null);
    }
  };

  const openEditLines = () => {
    if (!selectedPo) return;
    setEditLines(
      selectedPo.lines.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        name: line.inventoryItem.name,
        buyUnit: line.inventoryItem.buyUnit,
        qty: line.orderedQty,
        unitPrice: line.unitPrice,
      })),
    );
    setItemPickerSearch('');
    setIsEditingLines(true);
    if (accessToken && catalogItems.length === 0) {
      void listInventoryItems(accessToken, { isActive: true }).then(setCatalogItems).catch(() => {});
    }
  };

  const addEditLine = (item: InventoryItem) => {
    setEditLines((prev) => {
      if (prev.some((l) => l.inventoryItemId === item.id)) return prev;
      return [...prev, { inventoryItemId: item.id, name: item.name, buyUnit: item.buyUnit, qty: '1', unitPrice: buyUnitCostValue(item).toString() }];
    });
  };

  const removeEditLine = (itemId: string) => {
    setEditLines((prev) => prev.filter((l) => l.inventoryItemId !== itemId));
  };

  const updateEditLine = (itemId: string, patch: Partial<Pick<EditLine, 'qty' | 'unitPrice'>>) => {
    setEditLines((prev) => prev.map((l) => (l.inventoryItemId === itemId ? { ...l, ...patch } : l)));
  };

  const handleSaveLines = async () => {
    if (!accessToken || !selectedPo) return;
    if (editLines.length === 0) {
      toast({ variant: 'error', title: 'Add at least one item', message: 'A purchase order needs at least one line.' });
      return;
    }
    const invalid = editLines.find((l) => !l.qty || parseFloat(l.qty) <= 0);
    if (invalid) {
      toast({ variant: 'error', title: 'Check quantities', message: `${invalid.name} needs a quantity greater than 0.` });
      return;
    }
    setIsSavingLines(true);
    try {
      await updatePurchaseOrderLines(
        selectedPo.id,
        editLines.map((l) => ({ inventoryItemId: l.inventoryItemId, orderedQty: l.qty, unitPrice: l.unitPrice })),
        accessToken,
      );
      toast({ variant: 'success', title: 'Purchase order updated', message: `${selectedPo.poNumber} was updated.` });
      setIsEditingLines(false);
      await refreshSelected(selectedPo.id);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to save changes', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSavingLines(false);
    }
  };

  const handleReverseReceipt = async () => {
    if (!accessToken || !selectedPo || !reverseTarget) return;
    setIsActing(true);
    try {
      const updated = await reversePurchaseOrderLineReceipt(selectedPo.id, reverseTarget.id, accessToken);
      setSelectedPo(updated);
      toast({ variant: 'success', title: 'Receipt reversed', message: `${reverseTarget.inventoryItem.name} can be received again.` });
      void load();
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to reverse receipt', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsActing(false);
      setReverseTarget(null);
    }
  };

  const handleReceiveLine = async (lineId: string) => {
    if (!accessToken || !selectedPo) return;
    const draft = drafts[lineId];
    if (!draft) return;
    setDrafts((d) => ({ ...d, [lineId]: { ...draft, state: 'saving' } }));
    try {
      const updated = await receivePurchaseOrderLine(
        selectedPo.id,
        lineId,
        { receivedQty: draft.receivedQty, invoicePrice: draft.invoicePrice },
        accessToken,
      );
      setSelectedPo(updated);
      setDrafts((d) => ({ ...d, [lineId]: { ...draft, state: 'saved' } }));
      void load();
    } catch (error) {
      setDrafts((d) => ({ ...d, [lineId]: { ...draft, state: 'error' } }));
      toast({ variant: 'error', title: 'Failed to record receipt', message: error instanceof Error ? error.message : 'Please try again.' });
    }
  };

  const columns: ExcelColumn<OrderRow>[] = [
    {
      key: 'poNumber',
      label: 'PO Number',
      render: (row) => (
        <button type="button" onClick={() => openDetail(row.po)} className="font-medium text-office-ink hover:underline">
          {row.po.poNumber}
        </button>
      ),
    },
    { key: 'supplier', label: 'Supplier', render: (row) => row.po.supplier.name },
    { key: 'status', label: 'Status', render: (row) => <PurchaseOrderStatusBadge status={row.po.status} /> },
    { key: 'lines', label: 'Lines', numeric: true, render: (row) => row.po.lines.length },
    { key: 'total', label: 'Total', numeric: true, render: (row) => <span className="font-semibold">{formatKes(orderTotal(row.po))}</span> },
    { key: 'createdAt', label: 'Date', render: (row) => formatDate(row.po.createdAt) },
  ];

  const isDiscrepant = (line: PurchaseOrder['lines'][number], draft: DraftLine): boolean => {
    const received = parseFloat(draft.receivedQty || '0');
    return draft.receivedQty !== '' && received !== parseFloat(line.orderedQty);
  };

  return (
    <PageLayout className="animate-fade-up">
      <PageHeader
        title="Purchase Orders"
        subtitle={`${orders.length} orders`}
        action={
          <Link href="/app/inventory/purchase-orders/new">
            <Button leftIcon={<Plus size={18} />}>New Purchase Order</Button>
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-56">
            <Select
              options={STATUS_FILTERS}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | '')}
            />
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by PO number or supplier…" className="pl-9" />
          </div>
        </div>

        <ExcelTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.po.id}
          isLoading={isLoading}
          headerTone="navy"
          emptyState={
            <div className="px-4 py-10 text-center text-body-sm text-stone-500">
              {orders.length === 0 ? 'No purchase orders yet.' : 'No orders match your filters.'}
            </div>
          }
        />
      </Card>

      {selectedPo && (
        <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(28,25,23,0.4)]" onClick={() => setSelectedPo(null)}>
          <div
            className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl animate-fade-up motion-reduce:animate-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-4">
              <div>
                <h2 className="text-heading-md font-semibold text-stone-900">{selectedPo.poNumber}</h2>
                <p className="text-label-md text-stone-500">{selectedPo.supplier.name} · {formatDate(selectedPo.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PurchaseOrderStatusBadge status={selectedPo.status} />
                <IconButton icon={<X size={18} />} label="Close" variant="ghost" size="sm" onClick={() => setSelectedPo(null)} />
              </div>
            </div>

            {selectedPo.status === 'DRAFT' && !isEditingLines && (
              <div className="flex gap-3 border-b border-stone-100 px-6 py-3">
                <Button leftIcon={<Send size={16} />} onClick={() => setConfirmAction('send')}>Send to Supplier</Button>
                <Button variant="secondary" leftIcon={<Pencil size={16} />} onClick={openEditLines}>Edit Lines</Button>
                <Button variant="destructive" leftIcon={<XCircle size={16} />} onClick={() => setConfirmAction('cancel')}>Cancel Order</Button>
              </div>
            )}
            {selectedPo.status === 'SENT' && (
              <div className="flex gap-3 border-b border-stone-100 px-6 py-3">
                <Button variant="secondary" leftIcon={<Undo2 size={16} />} onClick={() => setConfirmAction('unsend')}>Unsend</Button>
                <Button variant="destructive" leftIcon={<XCircle size={16} />} onClick={() => setConfirmAction('cancel')}>Cancel Order</Button>
              </div>
            )}
            {selectedPo.status === 'PARTIALLY_RECEIVED' && (
              <div className="flex gap-3 border-b border-stone-100 px-6 py-3">
                <Button variant="destructive" leftIcon={<XCircle size={16} />} onClick={() => setConfirmAction('cancel')}>Cancel Order</Button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {selectedPo.status === 'DRAFT' && isEditingLines ? (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-label-sm font-semibold uppercase tracking-wide text-stone-500">Edit Lines</p>
                    <button type="button" onClick={() => setIsEditingLines(false)} className="text-label-md text-stone-500 underline">
                      Cancel editing
                    </button>
                  </div>

                  {editLines.length > 0 && (
                    <ul className="mb-4 divide-y divide-stone-100 rounded-md border border-stone-100">
                      {editLines.map((line) => (
                        <li key={line.inventoryItemId} className="flex items-end gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body-sm font-medium text-stone-900">{line.name}</p>
                          </div>
                          <QuantityInput
                            label="Qty"
                            unit={line.buyUnit}
                            value={line.qty}
                            onValueChange={(v) => updateEditLine(line.inventoryItemId, { qty: v })}
                            className="w-40 shrink-0"
                          />
                          <QuantityInput
                            label="Unit Price"
                            unit="Ksh"
                            value={line.unitPrice}
                            onValueChange={(v) => updateEditLine(line.inventoryItemId, { unitPrice: v })}
                            className="w-28 shrink-0"
                          />
                          <IconButton icon={<X size={15} />} label={`Remove ${line.name}`} variant="ghost" size="sm" onClick={() => removeEditLine(line.inventoryItemId)} />
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-stone-500">Add an item</p>
                  <div className="relative mb-2">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <Input value={itemPickerSearch} onChange={(e) => setItemPickerSearch(e.target.value)} placeholder="Search items…" className="pl-9" />
                  </div>
                  <ul className="mb-4 max-h-48 divide-y divide-stone-100 overflow-y-auto rounded-md border border-stone-100">
                    {catalogItems
                      .filter((item) => item.name.toLowerCase().includes(itemPickerSearch.trim().toLowerCase()))
                      .filter((item) => !editLines.some((l) => l.inventoryItemId === item.id))
                      .slice(0, 20)
                      .map((item, index) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => addEditLine(item)}
                            className="flex w-full items-center gap-2.5 px-4 py-2 text-left hover:bg-stone-50"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-label-sm font-semibold tabular-nums text-stone-500">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-body-sm text-stone-800">{item.name}</span>
                            <Plus size={15} className="shrink-0 text-stone-400" />
                          </button>
                        </li>
                      ))}
                  </ul>

                  <div className="flex justify-end gap-3 border-t border-stone-100 pt-4">
                    <Button variant="secondary" onClick={() => setIsEditingLines(false)}>Cancel</Button>
                    <Button onClick={() => void handleSaveLines()} isLoading={isSavingLines}>Save Changes</Button>
                  </div>
                </>
              ) : selectedPo.status === 'DRAFT' || selectedPo.status === 'CANCELLED' || selectedPo.status === 'CLOSED' ? (
                <>
                  <p className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-stone-500">Lines</p>
                  <ul className="divide-y divide-stone-100 rounded-md border border-stone-100">
                    {selectedPo.lines.map((line) => {
                      const currentBuyCost = buyUnitCostValue(line.inventoryItem);
                      const isStale = selectedPo.status === 'DRAFT' && Math.abs(currentBuyCost - parseFloat(line.unitPrice)) > 0.01;
                      return (
                        <li key={line.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-body-sm font-medium text-stone-900">{line.inventoryItem.name}</p>
                            <p className="text-label-sm text-stone-500">
                              {line.orderedQty} {line.inventoryItem.buyUnit} @ {formatKes(parseFloat(line.unitPrice))}
                            </p>
                            {isStale && (
                              <p className="mt-0.5 flex items-center gap-1 text-label-sm text-warning">
                                <AlertTriangle size={12} /> Supplier&rsquo;s current price is {formatKes(currentBuyCost)} — this line may be outdated
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-body-sm font-semibold text-stone-700">
                            {formatKes(parseFloat(line.orderedQty) * parseFloat(line.unitPrice))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <>
                  <p className="mb-2 flex items-center gap-1.5 text-label-sm font-semibold uppercase tracking-wide text-stone-500">
                    <Truck size={14} /> Receiving
                  </p>
                  <ul className="space-y-2">
                    {selectedPo.lines.map((line) => {
                      const draft = drafts[line.id];
                      if (!draft) return null;
                      const alreadyReceived = line.receivedQty !== '0';
                      const discrepant = isDiscrepant(line, draft);
                      return (
                        <li
                          key={line.id}
                          className={cn(
                            'rounded-md border p-3',
                            discrepant ? 'border-danger-border bg-danger-bg' : 'border-stone-100',
                          )}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-body-sm font-medium text-stone-900">{line.inventoryItem.name}</p>
                            <span className="text-label-sm text-stone-500">Ordered: {line.orderedQty} {line.inventoryItem.buyUnit}</span>
                          </div>
                          {alreadyReceived ? (
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-label-md text-success">Received {line.receivedQty} {line.inventoryItem.buyUnit} @ {formatKes(parseFloat(line.invoicePrice ?? line.unitPrice))}</p>
                              <Button size="sm" variant="ghost" leftIcon={<RotateCcw size={13} />} onClick={() => setReverseTarget(line)}>
                                Correct this line
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-end gap-3">
                              <QuantityInput
                                label="Actual Qty"
                                unit={line.inventoryItem.buyUnit}
                                value={draft.receivedQty}
                                onValueChange={(v) => setDrafts((d) => ({ ...d, [line.id]: { ...draft, receivedQty: v, state: 'dirty' } }))}
                              />
                              <QuantityInput
                                label="Invoice Price"
                                unit="Ksh"
                                value={draft.invoicePrice}
                                onValueChange={(v) => setDrafts((d) => ({ ...d, [line.id]: { ...draft, invoicePrice: v, state: 'dirty' } }))}
                              />
                              <Button size="sm" onClick={() => handleReceiveLine(line.id)} isLoading={draft.state === 'saving'}>
                                Confirm
                              </Button>
                            </div>
                          )}
                          {discrepant && !alreadyReceived && (
                            <p className="mt-2 flex items-center gap-1.5 text-label-sm text-danger">
                              <AlertTriangle size={13} />
                              {Math.abs(parseFloat(draft.receivedQty) - parseFloat(line.orderedQty)).toFixed(2)} {line.inventoryItem.buyUnit} {parseFloat(draft.receivedQty) < parseFloat(line.orderedQty) ? 'less' : 'more'} than ordered
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmAction === 'send'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleSend}
        title="Send this purchase order?"
        description={`${selectedPo?.poNumber ?? 'This order'} will be sent to ${selectedPo?.supplier.name ?? 'the supplier'}. You can still unsend it afterwards if you need to make changes, as long as nothing has been received yet.`}
        confirmLabel="Send Order"
        isLoading={isActing}
      />
      <ConfirmDialog
        isOpen={confirmAction === 'unsend'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleUnsend}
        title="Unsend this purchase order?"
        description={`${selectedPo?.poNumber ?? 'This order'} will return to Draft so you can edit it. You'll need to send it again once you're done.`}
        confirmLabel="Unsend"
        isLoading={isActing}
      />
      <ConfirmDialog
        isOpen={confirmAction === 'cancel'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleCancel}
        title="Cancel this purchase order?"
        description={`${selectedPo?.poNumber ?? 'This order'} will be cancelled and can no longer be actioned. This cannot be undone.`}
        confirmLabel="Cancel Order"
        isLoading={isActing}
      />
      <ConfirmDialog
        isOpen={!!reverseTarget}
        onClose={() => setReverseTarget(null)}
        onConfirm={handleReverseReceipt}
        title="Correct this receiving line?"
        description={`This reverses the receipt of ${reverseTarget?.receivedQty ?? ''} ${reverseTarget?.inventoryItem.buyUnit ?? ''} of ${reverseTarget?.inventoryItem.name ?? 'this item'} — stock on hand will be adjusted back down, and you can receive this line again with the correct amounts.`}
        confirmLabel="Reverse Receipt"
        isLoading={isActing}
      />
    </PageLayout>
  );
}
