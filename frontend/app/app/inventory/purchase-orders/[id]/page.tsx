'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Truck, XCircle } from 'lucide-react';
import { Card } from '@/components/ui';
import { PurchaseOrderStatusBadge } from '@/components/inventory/PurchaseOrderStatusBadge';
import { cancelPurchaseOrder, getPurchaseOrder, sendPurchaseOrder } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import type { PurchaseOrder } from '@/types/inventory';

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });

type ConfirmAction = 'send' | 'cancel' | null;

// Mobile-only route: Manager's desktop detail view is a slide-over panel on
// the purchase-orders list (PurchaseOrdersDesktop), never a Link to this
// [id] route. STORE_MANAGER's dual shell still mounts this page on both the
// desktop and mobile copies (app/app/layout.tsx), so without a shell guard
// the desktop-shell copy would silently double-fetch the PO for nothing.
export default function PurchaseOrderDetailPage(): JSX.Element {
  const isDesktop = useIsDesktopShell();
  if (isDesktop) return <></>;
  return <PurchaseOrderDetailPageInner />;
}

// Shared route for both roles. Attendant sees a read-only detail (no
// mockup fidelity — Session 6's flagged deviation). Manager gets the same
// read view plus Send/Cancel actions (§8.3: send/cancel is Manager-only)
// behind a lightweight bottom confirm sheet, per §8.1 row 6's mobile column
// ("a lightweight confirm sheet, not a full modal" — ConfirmDialog's
// centered Modal is the desktop pattern used in PurchaseOrdersDesktop.tsx).
function PurchaseOrderDetailPageInner(): JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const isManager = role === 'STORE_MANAGER';
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [isActing, setIsActing] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return;
    setIsLoading(true);
    try {
      const result = await getPurchaseOrder(params.id, accessToken);
      setPo(result);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load purchase order', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, params.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSend = async () => {
    if (!accessToken || !po) return;
    setIsActing(true);
    try {
      const updated = await sendPurchaseOrder(po.id, accessToken);
      setPo(updated);
      toast({ variant: 'success', title: 'Purchase order sent', message: `${updated.poNumber} was sent to ${updated.supplier.name}.` });
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to send order', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsActing(false);
      setConfirmAction(null);
    }
  };

  const handleCancel = async () => {
    if (!accessToken || !po) return;
    setIsActing(true);
    try {
      const updated = await cancelPurchaseOrder(po.id, accessToken);
      setPo(updated);
      toast({ variant: 'success', title: 'Purchase order cancelled', message: `${updated.poNumber} was cancelled.` });
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to cancel order', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsActing(false);
      setConfirmAction(null);
    }
  };

  const canReceive = po && (po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED');
  const canSend = isManager && po?.status === 'DRAFT';
  const canCancel = isManager && (po?.status === 'DRAFT' || po?.status === 'SENT' || po?.status === 'PARTIALLY_RECEIVED');
  const hasActions = canSend || canCancel || canReceive;

  return (
    <div className="min-h-full bg-crema pb-8">
      <div className="bg-espresso px-4 pb-5 pt-6 text-crema">
        <button
          type="button"
          onClick={() => router.push('/app/inventory/purchase-orders')}
          className="mb-2 flex items-center gap-1 text-label-md text-crema/80"
        >
          <ArrowLeft size={16} /> Purchase Orders
        </button>
        <p className="font-display text-heading-lg font-medium">{po?.poNumber ?? 'Loading…'}</p>
        {po && <p className="text-label-md text-crema/70">{po.supplier.name}</p>}
      </div>

      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-stone-100" />
            ))}
          </div>
        ) : !po ? (
          <p className="py-8 text-center text-body-sm text-stone-500">Purchase order not found.</p>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <PurchaseOrderStatusBadge status={po.status} />
              <span className="text-label-md text-stone-500">{formatDate(po.createdAt)}</span>
            </div>

            {po.status === 'DRAFT' && !isManager && (
              <p className="mb-4 rounded-md bg-warning-bg px-3 py-2 text-label-md font-medium text-warning">
                Waiting for manager to send
              </p>
            )}

            {canReceive && (
              <Link
                href={`/app/inventory/receiving/${po.id}`}
                className="mb-4 flex items-center gap-3 rounded-md border border-amber bg-amber-light/40 p-3"
              >
                <Truck size={20} className="shrink-0 text-espresso" />
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-semibold text-espresso">
                    {po.status === 'PARTIALLY_RECEIVED' ? 'Continue receiving' : 'Receive this delivery'}
                  </p>
                  <p className="text-label-sm text-stone-600">Enter actual quantities and invoice prices</p>
                </div>
                <span className="shrink-0 text-stone-400">›</span>
              </Link>
            )}

            <p className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-stone-500">Lines</p>
            <div className="space-y-2">
              {po.lines.map((line) => (
                <Card key={line.id} className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-stone-900">{line.inventoryItem.name}</p>
                    <p className="text-label-sm text-stone-500">
                      {line.orderedQty} {line.inventoryItem.buyUnit} @ Ksh {parseFloat(line.unitPrice).toFixed(2)}
                      {line.receivedQty !== '0' && ` · Received ${line.receivedQty}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-body-sm font-semibold text-stone-700">
                    Ksh {(parseFloat(line.orderedQty) * parseFloat(line.unitPrice)).toFixed(2)}
                  </span>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Manager action bar — send/cancel, §8.3 */}
      {po && hasActions && (canSend || canCancel) && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex gap-3 border-t border-stone-200 bg-white px-4 py-3">
          {canSend && (
            <button
              type="button"
              onClick={() => setConfirmAction('send')}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-amber text-label-lg font-semibold text-espresso"
            >
              <Send size={18} /> Send to Supplier
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={() => setConfirmAction('cancel')}
              className="flex h-12 items-center justify-center gap-2 rounded-md border border-danger px-4 text-label-lg font-semibold text-danger"
            >
              <XCircle size={18} />
              {!canSend && 'Cancel Order'}
            </button>
          )}
        </div>
      )}

      {/* Lightweight bottom confirm sheet — not a full modal, per §8.1 row 6 */}
      {confirmAction && po && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => !isActing && setConfirmAction(null)}>
          <div className="rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 h-1 w-10 self-center rounded-full bg-stone-200 mx-auto" />
            {confirmAction === 'send' ? (
              <>
                <p className="text-heading-sm font-semibold text-stone-900">Send this purchase order?</p>
                <p className="mt-1.5 text-body-sm text-stone-600">
                  {po.poNumber} will be sent to {po.supplier.name}. It can no longer be edited after sending.
                </p>
              </>
            ) : (
              <>
                <p className="text-heading-sm font-semibold text-stone-900">Cancel this purchase order?</p>
                <p className="mt-1.5 text-body-sm text-stone-600">
                  {po.poNumber} will be cancelled and can no longer be actioned. This cannot be undone.
                </p>
              </>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={isActing}
                className="h-12 flex-1 rounded-md border border-stone-200 text-label-lg font-semibold text-stone-700 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void (confirmAction === 'send' ? handleSend() : handleCancel())}
                disabled={isActing}
                className={
                  confirmAction === 'send'
                    ? 'h-12 flex-1 rounded-md bg-amber text-label-lg font-semibold text-espresso disabled:opacity-50'
                    : 'h-12 flex-1 rounded-md bg-danger text-label-lg font-semibold text-white disabled:opacity-50'
                }
              >
                {isActing ? 'Working…' : confirmAction === 'send' ? 'Send Order' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
