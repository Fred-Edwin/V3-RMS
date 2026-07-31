'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, Truck } from 'lucide-react';
import { HelpTip, IconTile } from '@/components/ui';
import { QuantityInput } from '@/components/inventory/QuantityInput';
import { getPurchaseOrder, receivePurchaseOrderLine } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { cn } from '@/lib/cn';
import type { PurchaseOrder, PurchaseOrderLine } from '@/types/inventory';

type LineState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface DraftLine {
  receivedQty: string;
  invoicePrice: string;
  state: LineState;
  errorMsg?: string;
}

const isDiscrepant = (line: PurchaseOrderLine, draft: DraftLine): boolean => {
  const received = parseFloat(draft.receivedQty || '0');
  const ordered = parseFloat(line.orderedQty);
  return draft.receivedQty !== '' && received !== ordered;
};

// Mobile-only route: reached from Attendant's receiving list and from
// Manager's mobile PO detail ("Receive this delivery" link) — never from
// Manager's desktop, which shows this same flow inline in the Purchase
// Orders slide-over panel instead (PurchaseOrdersDesktop.tsx). STORE_MANAGER's
// dual shell still mounts this page on both the desktop and mobile copies
// (app/app/layout.tsx), so without a shell guard the desktop-shell copy
// would silently double-fetch the PO for nothing.
export default function ReceivingExecutionPage(): JSX.Element {
  const isDesktop = useIsDesktopShell();
  if (isDesktop) return <></>;
  return <ReceivingExecutionPageInner />;
}

// Receiving is inherently per-line (each line hits its own PO-line receive
// endpoint, unlike Stock Count's single bulk submit) — so autosave here is a
// per-line debounce + individual save call, following the payroll sheet's
// idle|dirty|saving|saved|error row-state pattern, adapted to one call per
// line instead of one bulk upsert for the whole sheet.
function ReceivingExecutionPageInner(): JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, DraftLine>>({});

  const draftsRef = useRef(drafts);
  useEffect(() => { draftsRef.current = drafts; }, [drafts]);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveQueue = useRef<Record<string, Promise<void>>>({});

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return;
    setIsLoading(true);
    try {
      const result = await getPurchaseOrder(params.id, accessToken);
      setPo(result);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const line of result.lines) {
          if (next[line.id]) continue;
          const alreadyReceived = line.receivedQty !== '0';
          next[line.id] = {
            receivedQty: alreadyReceived ? line.receivedQty : line.orderedQty,
            invoicePrice: line.invoicePrice ?? line.unitPrice,
            state: alreadyReceived ? 'saved' : 'idle',
          };
        }
        return next;
      });
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load delivery', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, params.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveLineNow = useCallback(async (lineId: string) => {
    if (!accessToken || !po) return;
    const draft = draftsRef.current[lineId];
    if (!draft || draft.state === 'saved' || draft.state === 'saving') return;
    if (!draft.receivedQty || parseFloat(draft.receivedQty) <= 0) return;

    setDrafts((prev) => ({ ...prev, [lineId]: { ...prev[lineId], state: 'saving' } }));
    try {
      const updated = await receivePurchaseOrderLine(
        po.id,
        lineId,
        { receivedQty: draft.receivedQty, invoicePrice: draft.invoicePrice || '0' },
        accessToken,
      );
      setPo(updated);
      setDrafts((prev) => ({ ...prev, [lineId]: { ...prev[lineId], state: 'saved' } }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Save failed';
      setDrafts((prev) => ({ ...prev, [lineId]: { ...prev[lineId], state: 'error', errorMsg: msg } }));
    }
  }, [accessToken, po]);

  // Serializes saves per line so a fast second edit never lands before a
  // slower first one — same race this pattern guards against in the payroll
  // sheet (see that page's rowSaveQueue comment).
  const saveLine = useCallback((lineId: string): Promise<void> => {
    const prior = saveQueue.current[lineId] ?? Promise.resolve();
    const next = prior.catch(() => {}).then(() => saveLineNow(lineId));
    saveQueue.current[lineId] = next;
    return next;
  }, [saveLineNow]);

  const scheduleSave = useCallback((lineId: string) => {
    if (debounceTimers.current[lineId]) clearTimeout(debounceTimers.current[lineId]);
    debounceTimers.current[lineId] = setTimeout(() => { void saveLine(lineId); }, 900);
  }, [saveLine]);

  const updateDraft = (lineId: string, field: 'receivedQty' | 'invoicePrice', value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: value, state: 'dirty', errorMsg: undefined },
    }));
    scheduleSave(lineId);
  };

  const stats = useMemo(() => {
    if (!po) return { completed: 0, total: 0, matched: 0, discrepant: 0, pending: 0, orderValue: 0, receivedValue: 0 };
    let matched = 0;
    let discrepant = 0;
    let pending = 0;
    let orderValue = 0;
    let receivedValue = 0;
    for (const line of po.lines) {
      const draft = drafts[line.id];
      orderValue += parseFloat(line.orderedQty) * parseFloat(line.unitPrice);
      if (!draft || draft.state === 'idle') {
        pending += 1;
        continue;
      }
      const qty = parseFloat(draft.receivedQty || '0');
      const price = parseFloat(draft.invoicePrice || '0');
      receivedValue += qty * price;
      if (isDiscrepant(line, draft)) discrepant += 1;
      else matched += 1;
    }
    const completed = matched + discrepant;
    return { completed, total: po.lines.length, matched, discrepant, pending, orderValue, receivedValue };
  }, [po, drafts]);

  const allSaved = po ? po.lines.every((l) => drafts[l.id]?.state === 'saved') : false;

  const handleConfirmReceipt = async () => {
    if (!po) return;
    Object.values(debounceTimers.current).forEach(clearTimeout);
    await Promise.all(po.lines.map((l) => saveLine(l.id)));
    const stillUnsaved = po.lines.some((l) => draftsRef.current[l.id]?.state !== 'saved');
    if (stillUnsaved) {
      toast({ variant: 'error', title: 'Some lines did not save', message: 'Check the flagged lines and try again.' });
      return;
    }
    toast({ variant: 'success', title: 'Receipt confirmed', message: `${po.poNumber} lines have been received.` });
    router.push('/app/inventory/receiving');
  };

  return (
    <div className="min-h-full bg-crema pb-28">
      <div className="bg-espresso px-4 pb-4 pt-6 text-crema">
        <button type="button" onClick={() => router.push('/app/inventory/receiving')} className="mb-2 flex items-center gap-1 text-label-md text-crema/80">
          <ArrowLeft size={16} /> Receiving
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-crema/10 text-crema">
              <Truck size={22} />
            </div>
            <div>
              <p className="font-display text-heading-md font-medium">{po?.supplier.name ?? 'Loading…'}</p>
              {po && <p className="text-label-md text-amber">{po.poNumber}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {po && (
              <div className="rounded-lg border border-crema/20 px-3 py-1.5 text-right">
                <p className="text-body-sm font-bold tabular-nums">{stats.completed} / {stats.total}</p>
                <p className="text-label-sm text-crema/60">Lines Completed</p>
              </div>
            )}
            <HelpTip
              title="Receiving"
              triggerClassName="flex h-7 w-7 items-center justify-center rounded-full text-crema/70 transition-colors hover:bg-white/10 hover:text-crema focus-visible:outline-none focus-visible:shadow-focus"
            >
              <p>For each line, enter what actually arrived and the price on the invoice — not just what was ordered.</p>
              <p className="mt-2">
                Each line saves on its own as you type. A red line means the received quantity doesn&rsquo;t match
                what was ordered — that&rsquo;s fine, just confirm it&rsquo;s correct before finishing.
              </p>
            </HelpTip>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {isLoading || !po ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-stone-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {po.lines.map((line) => {
              const draft = drafts[line.id] ?? { receivedQty: '', invoicePrice: '', state: 'idle' as LineState };
              const discrepant = isDiscrepant(line, draft);
              const diff = parseFloat(draft.receivedQty || '0') - parseFloat(line.orderedQty);
              return (
                <div
                  key={line.id}
                  className={cn(
                    'rounded-md border p-3',
                    discrepant ? 'border-danger bg-danger-bg' : 'border-stone-200 bg-white',
                  )}
                >
                  <div className="mb-2 flex items-center gap-3">
                    <IconTile icon={Package} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-semibold text-stone-900">{line.inventoryItem.name}</p>
                      <p className="text-label-sm text-stone-500">
                        Ordered {line.orderedQty} {line.inventoryItem.buyUnit}
                      </p>
                    </div>
                    {draft.state === 'saving' && <span className="shrink-0 text-label-sm text-stone-400">Saving…</span>}
                    {draft.state === 'saved' && <span className="shrink-0 text-label-sm text-success">Saved</span>}
                    {draft.state === 'error' && <span className="shrink-0 text-label-sm text-danger">Error</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <QuantityInput
                      label="Actual Received"
                      value={draft.receivedQty}
                      onValueChange={(v) => updateDraft(line.id, 'receivedQty', v)}
                      unit={line.inventoryItem.buyUnit}
                    />
                    <QuantityInput
                      label="Invoice Price"
                      value={draft.invoicePrice}
                      onValueChange={(v) => updateDraft(line.id, 'invoicePrice', v)}
                    />
                  </div>

                  {discrepant && (
                    <p className="mt-2 text-label-md font-semibold text-danger">
                      {diff > 0 ? `${diff} ${line.inventoryItem.buyUnit} more than ordered` : `${Math.abs(diff)} ${line.inventoryItem.buyUnit} less than ordered`}
                    </p>
                  )}
                  {draft.state === 'error' && draft.errorMsg && (
                    <p className="mt-1 text-label-sm text-danger">{draft.errorMsg}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {po && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white px-4 py-3">
          <div className="mb-2 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-body-sm font-bold tabular-nums text-success">{stats.matched}</p>
              <p className="text-label-sm text-stone-500">Matched</p>
            </div>
            <div>
              <p className="text-body-sm font-bold tabular-nums text-danger">{stats.discrepant}</p>
              <p className="text-label-sm text-stone-500">With Discrepancy</p>
            </div>
            <div>
              <p className="text-body-sm font-bold tabular-nums text-stone-700">{stats.pending}</p>
              <p className="text-label-sm text-stone-500">Pending</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleConfirmReceipt()}
            disabled={stats.pending > 0}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber text-label-lg font-semibold text-espresso disabled:opacity-50"
          >
            Confirm Receipt
          </button>
          {!allSaved && stats.pending === 0 && (
            <p className="mt-1 text-center text-label-sm text-stone-400">Finishing up saves…</p>
          )}
        </div>
      )}
    </div>
  );
}
