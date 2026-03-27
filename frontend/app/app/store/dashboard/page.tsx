'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Package, Truck } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, PageLayout, SkeletonTable } from '@/components/ui';
import { inventoryService } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import type { InventoryOverview, RawIngredient, Requisition } from '@/types/inventory';
import { RequisitionStatus } from '@/types/inventory';

const statusVariant: Record<string, 'pending' | 'inprogress' | 'ready' | 'closed' | 'cancelled'> = {
  PENDING: 'pending',
  APPROVED: 'inprogress',
  DISPATCHED: 'inprogress',
  RECEIVED: 'ready',
  PARTIAL: 'pending',
};


export default function StoreDashboardPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const [ovr, reqs] = await Promise.all([
        inventoryService.getInventoryOverview(token),
        inventoryService.getRequisitions({}, token),
      ]);
      setOverview(ovr);
      setRequisitions(reqs);
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const belowThreshold = overview?.belowThreshold ?? [];
  const ingredients = overview?.ingredients ?? [];

  return (
    <PageLayout>
      <PageHeader title="Store Dashboard" subtitle="Central Kitchen inventory at a glance" />

      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : error ? (
        <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="Error" body={error ?? undefined} action={<Button onClick={() => void load()}>Retry</Button>} />
      ) : (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="bg-parchment shadow-md">
              <CardBody className="flex items-center gap-3 p-4">
                <Package size={24} className="text-amber-700" />
                <div>
                  <p className="text-label-sm text-stone-500">Ingredients</p>
                  <p className="text-display-sm font-semibold text-stone-900">{ingredients.length}</p>
                </div>
              </CardBody>
            </Card>
            <Card className="bg-parchment shadow-md">
              <CardBody className="flex items-center gap-3 p-4">
                <AlertTriangle size={24} className="text-amber-600" />
                <div>
                  <p className="text-label-sm text-stone-500">Below Threshold</p>
                  <p className="text-display-sm font-semibold text-amber-700">{belowThreshold.length}</p>
                </div>
              </CardBody>
            </Card>
            <Card className="bg-parchment shadow-md">
              <CardBody className="flex items-center gap-3 p-4">
                <Truck size={24} className="text-stone-600" />
                <div>
                  <p className="text-label-sm text-stone-500">Today&apos;s Requisitions</p>
                  <p className="text-display-sm font-semibold text-stone-900">{requisitions.length}</p>
                </div>
              </CardBody>
            </Card>
            <Card className="bg-parchment shadow-md">
              <CardBody className="flex items-center gap-3 p-4">
                <CheckCircle2 size={24} className="text-green-600" />
                <div>
                  <p className="text-label-sm text-stone-500">Dispatched Today</p>
                  <p className="text-display-sm font-semibold text-stone-900">
                    {requisitions.filter((r) => r.status === RequisitionStatus.DISPATCHED || r.status === RequisitionStatus.RECEIVED).length}
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Branch Requisitions */}
          <Card className="bg-parchment shadow-md">
            <CardHeader>
              <h2 className="font-display text-xl text-stone-900">Today&apos;s Branch Requisitions</h2>
            </CardHeader>
            <CardBody>
              {requisitions.length === 0 ? (
                <p className="text-body-sm text-stone-500">No requisitions today.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-left">
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Branch</th>
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Submitted</th>
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Items</th>
                        <th className="pb-2 text-label-sm font-medium text-stone-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requisitions.map((req) => (
                        <tr key={req.id} className="border-b border-stone-100 last:border-0">
                          <td className="py-2 pr-4 text-stone-900">{req.organization?.name ?? '—'}</td>
                          <td className="py-2 pr-4 text-stone-600">
                            {new Date(req.submittedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2 pr-4 text-stone-600">{req.items.length}</td>
                          <td className="py-2">
                            <Badge variant={statusVariant[req.status] ?? 'pending'} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          {/* CK Raw Ingredient Stock */}
          <Card className="bg-parchment shadow-md">
            <CardHeader>
              <h2 className="font-display text-xl text-stone-900">CK Ingredient Stock</h2>
            </CardHeader>
            <CardBody>
              {ingredients.length === 0 ? (
                <p className="text-body-sm text-stone-500">No ingredients found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-left">
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Ingredient</th>
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Unit</th>
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">In Stock</th>
                        <th className="pb-2 text-label-sm font-medium text-stone-500">Threshold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredients.map((ing: RawIngredient) => {
                        const isLow = belowThreshold.some((b) => b.id === ing.id);
                        return (
                          <tr key={ing.id} className="border-b border-stone-100 last:border-0">
                            <td className="py-2 pr-4 font-medium text-stone-900">{ing.name}</td>
                            <td className="py-2 pr-4 text-stone-600">{ing.unit}</td>
                            <td className={`py-2 pr-4 font-semibold ${isLow ? 'text-amber-700' : 'text-stone-900'}`}>
                              {ing.currentStockCk}
                              {isLow && <AlertTriangle size={14} className="ml-1 inline text-amber-600" />}
                            </td>
                            <td className="py-2 text-stone-500">{ing.reorderThreshold}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}
