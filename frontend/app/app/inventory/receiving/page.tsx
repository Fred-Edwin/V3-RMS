'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Truck } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui';
import { PurchaseOrderStatusBadge } from '@/components/inventory/PurchaseOrderStatusBadge';
import { listPurchaseOrders } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import type { PurchaseOrder } from '@/types/inventory';

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });

export default function ReceivingListPage(): JSX.Element {
  const role = useAuthStore((state) => state.role);
  const router = useRouter();

  // Manager's desktop receiving flow lives inside the Purchase Orders
  // detail panel (opening a SENT/PARTIALLY_RECEIVED order shows the same
  // receiving table inline) — no separate desktop route, per §8.1 row 7
  // ("same core flow as mobile... on desktop it can show the full PO
  // alongside a wider discrepancy table"). Redirect Manager there instead
  // of duplicating the flow in a second screen.
  useEffect(() => {
    if (role === 'STORE_MANAGER') {
      router.replace('/app/inventory/purchase-orders');
    }
  }, [role, router]);

  if (role === 'STORE_MANAGER') {
    return <div className="min-h-full bg-crema" />;
  }
  return <ReceivingListAttendant />;
}

function ReceivingListAttendant(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [sent, partial] = await Promise.all([
        listPurchaseOrders(accessToken, 'SENT'),
        listPurchaseOrders(accessToken, 'PARTIALLY_RECEIVED'),
      ]);
      setOrders([...sent, ...partial]);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load deliveries', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () => [...orders].sort((a, b) => new Date(a.sentAt ?? a.createdAt).getTime() - new Date(b.sentAt ?? b.createdAt).getTime()),
    [orders],
  );

  return (
    <div className="min-h-full bg-crema">
      <div className="bg-espresso px-4 pb-5 pt-6 text-crema">
        <p className="font-display text-heading-lg font-medium">Receiving</p>
        <p className="text-label-md text-crema/70">Deliveries waiting to be received</p>
      </div>

      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-stone-100" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<Truck size={40} />}
            heading="Nothing to receive right now"
            body="Purchase orders appear here once your manager sends them to the supplier."
          />
        ) : (
          <div className="space-y-3">
            {sorted.map((po) => (
              <Link key={po.id} href={`/app/inventory/receiving/${po.id}`}>
                <Card className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-body-md font-semibold text-stone-900">{po.supplier.name}</p>
                      <p className="text-label-md text-stone-500">{po.poNumber}</p>
                    </div>
                    <PurchaseOrderStatusBadge status={po.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-label-md text-stone-500">
                    <span>{po.lines.length} line{po.lines.length > 1 ? 's' : ''}</span>
                    <span>{formatDate(po.sentAt ?? po.createdAt)}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
