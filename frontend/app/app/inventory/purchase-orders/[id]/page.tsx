'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui';
import { PurchaseOrderStatusBadge } from '@/components/inventory/PurchaseOrderStatusBadge';
import { getPurchaseOrder } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import type { PurchaseOrder } from '@/types/inventory';

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });

// Minimal detail view — not design-passed to mockup fidelity yet (only the
// List + New Draft screens had mockups this session). Exists so the list
// screen's tap-through has somewhere real to land, per Session 6 scope.
export default function PurchaseOrderDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

            {po.status === 'DRAFT' && (
              <p className="mb-4 rounded-md bg-warning-bg px-3 py-2 text-label-md font-medium text-warning">
                Waiting for manager to send
              </p>
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
    </div>
  );
}
