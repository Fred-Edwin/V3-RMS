'use client';

import { useCallback, useEffect } from 'react';
import { AlertTriangle, Package } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, PageLayout, SkeletonTable } from '@/components/ui';
import { useInventorySocket } from '@/hooks/useInventorySocket';
import { useAuthStore } from '@/store/authStore';
import { useInventoryStore } from '@/store/inventoryStore';

function stockVariant(current: number, threshold: number): 'closed' | 'pending' | 'ready' {
  if (current <= 0) return 'closed';
  if (current <= threshold) return 'pending';
  return 'ready';
}

const stockLabel: Record<'ready' | 'pending' | 'closed', string> = {
  ready: 'In Stock',
  pending: 'Low Stock',
  closed: 'Out of Stock',
};


export default function BranchInventoryPage() {
  const token = useAuthStore((s) => s.accessToken);
  const branchStock = useInventoryStore((s) => s.branchStock);
  const isLoading = useInventoryStore((s) => s.isLoadingStock);
  const fetchBranchStock = useInventoryStore((s) => s.fetchBranchStock);

  useInventorySocket();

  const load = useCallback(() => {
    if (token) void fetchBranchStock(token);
  }, [token, fetchBranchStock]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageLayout>
      <PageHeader
        title="Live Stock"
        subtitle="Branch menu item stock levels — updates in real time"
        action={<Button variant="secondary" size="sm" onClick={load}>Refresh</Button>}
      />

      {isLoading ? (
        <SkeletonTable rows={10} />
      ) : branchStock.length === 0 ? (
        <EmptyState icon={<Package size={40} className="text-stone-400" />} heading="No stock data" body="No branch stock has been set up yet." />
      ) : (
        <Card className="bg-parchment shadow-md">
          <CardHeader>
            <h2 className="font-display text-xl text-stone-900">Menu Item Stock</h2>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left">
                    <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Item</th>
                    <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Current Qty</th>
                    <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Low at</th>
                    <th className="pb-2 text-label-sm font-medium text-stone-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {branchStock.map((item) => {
                    const variant = stockVariant(item.currentQty, item.lowStockThreshold);
                    return (
                      <tr key={item.id} className="border-b border-stone-100 last:border-0">
                        <td className="py-2 pr-4 font-medium text-stone-900">
                          {item.menuItem?.name ?? item.menuItemId}
                        </td>
                        <td className={`py-2 pr-4 font-semibold ${variant === 'closed' ? 'text-red-600' : variant === 'pending' ? 'text-amber-700' : 'text-stone-900'}`}>
                          {item.currentQty}
                          {variant !== 'ready' && <AlertTriangle size={13} className="ml-1 inline" />}
                        </td>
                        <td className="py-2 pr-4 text-stone-500">{item.lowStockThreshold}</td>
                        <td className="py-2">
                          <Badge variant={variant} label={stockLabel[variant]} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </PageLayout>
  );
}
