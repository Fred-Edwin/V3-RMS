'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart2, Package } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, PageLayout, SkeletonTable } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui/Badge';
import { inventoryService } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import type { InventoryOverview, AllStocktakeSession } from '@/types/inventory';

const statusVariant: Record<string, BadgeVariant> = {
  PENDING: 'pending',
  APPROVED: 'inprogress',
  DISPATCHED: 'inprogress',
  RECEIVED: 'ready',
  PARTIAL: 'cancelled',
};

const requisitionLabel: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  DISPATCHED: 'Dispatched',
  RECEIVED: 'Received',
  PARTIAL: 'Partial',
};

export default function DirectorInventoryPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [allSessions, setAllSessions] = useState<AllStocktakeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0]!;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
      const [data, sessions] = await Promise.all([
        inventoryService.getInventoryOverview(token),
        inventoryService.getAllStocktakeSessions({ from: sevenDaysAgo, to: today }, token),
      ]);
      setOverview(data);
      setAllSessions(sessions);
    } catch {
      setError('Failed to load inventory overview.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const belowThreshold = overview?.belowThreshold ?? [];
  const branches = overview?.branches ?? [];
  const ingredients = overview?.ingredients ?? [];

  return (
    <PageLayout>
      <PageHeader
        title="Inventory Overview"
        subtitle="Cross-branch stock and CK ingredient levels"
        action={
          <Link href="/app/admin/inventory/reports">
            <Button variant="secondary" size="sm">
              <BarChart2 size={16} className="mr-1" />
              Reports
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <SkeletonTable rows={8} />
      ) : error ? (
        <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="Error" body={error ?? undefined} action={<Button onClick={() => void load()}>Retry</Button>} />
      ) : (
        <div className="space-y-6">
          {/* CK Stock Alerts */}
          {belowThreshold.length > 0 && (
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle size={20} className="mt-0.5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Reorder Required</p>
                <p className="text-body-sm text-amber-800">
                  {belowThreshold.map((i) => i.name).join(', ')} {belowThreshold.length === 1 ? 'is' : 'are'} below reorder threshold.
                </p>
              </div>
            </div>
          )}

          {/* Branch Requisition Summary */}
          <Card className="bg-parchment shadow-md">
            <CardHeader>
              <h2 className="font-display text-xl text-stone-900">Branch Requisition Status</h2>
            </CardHeader>
            <CardBody>
              {branches.length === 0 ? (
                <p className="text-body-sm text-stone-500">No branch activity today.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-left">
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Branch</th>
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Requisitions</th>
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Discrepancies</th>
                        <th className="pb-2 text-label-sm font-medium text-stone-500">Statuses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branches.map((branch) => (
                        <tr key={branch.branch.id} className="border-b border-stone-100 last:border-0">
                          <td className="py-2 pr-4 font-medium text-stone-900">{branch.branch.name}</td>
                          <td className="py-2 pr-4 text-stone-600">{branch.requisitionCount}</td>
                          <td className={`py-2 pr-4 font-semibold ${branch.discrepancyCount > 0 ? 'text-amber-700' : 'text-stone-500'}`}>
                            {branch.discrepancyCount}
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              {branch.statuses.map((status, idx) => (
                                <Badge
                                  key={idx}
                                  variant={statusVariant[status] ?? 'pending'}
                                  label={requisitionLabel[status] ?? status}
                                  className="text-xs"
                                />
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          {/* CK Raw Stock */}
          <Card className="bg-parchment shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package size={20} className="text-amber-700" />
                <h2 className="font-display text-xl text-stone-900">CK Raw Ingredient Stock</h2>
              </div>
            </CardHeader>
            <CardBody>
              {ingredients.length === 0 ? (
                <p className="text-body-sm text-stone-500">No ingredients configured.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-left">
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Ingredient</th>
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Unit</th>
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">In Stock</th>
                        <th className="pb-2 text-label-sm font-medium text-stone-500">Reorder At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredients.map((ing) => {
                        const isLow = belowThreshold.some((b) => b.id === ing.id);
                        return (
                          <tr key={ing.id} className="border-b border-stone-100 last:border-0">
                            <td className="py-2 pr-4 font-medium text-stone-900">{ing.name}</td>
                            <td className="py-2 pr-4 text-stone-600">{ing.unit}</td>
                            <td className={`py-2 pr-4 font-semibold ${isLow ? 'text-amber-700' : 'text-stone-900'}`}>
                              {ing.currentStockCk}
                              {isLow && <AlertTriangle size={13} className="ml-1 inline text-amber-600" />}
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

          {/* Recent Branch Stocktakes */}
          <Card className="bg-parchment shadow-md">
            <CardHeader>
              <h2 className="font-display text-xl text-stone-900">Recent Branch Stocktakes</h2>
              <p className="text-body-sm text-stone-500">Last 7 days across all branches</p>
            </CardHeader>
            <CardBody>
              {allSessions.length === 0 ? (
                <p className="text-body-sm text-stone-500">No stocktakes recorded in the last 7 days.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-left">
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Date</th>
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Branch</th>
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Conducted By</th>
                        <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Items</th>
                        <th className="pb-2 text-label-sm font-medium text-stone-500">High Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSessions.map((session) => {
                        const highVarianceCount = session.entries.filter(
                          (e) => Number(e.expectedQty) > 0 && Math.abs(Number(e.variance)) / Number(e.expectedQty) > 0.1,
                        ).length;
                        return (
                          <tr
                            key={session.id}
                            className={`border-b border-stone-100 last:border-0 ${highVarianceCount > 0 ? 'bg-amber-50' : ''}`}
                          >
                            <td className="py-2 pr-4 text-stone-600">
                              {new Date(session.date).toLocaleDateString('en-GB')}
                            </td>
                            <td className="py-2 pr-4 font-medium text-stone-900">{session.organization.name}</td>
                            <td className="py-2 pr-4 text-stone-600">{session.conductedBy?.name ?? '—'}</td>
                            <td className="py-2 pr-4 text-stone-600">{session.entries.length}</td>
                            <td className={`py-2 font-semibold ${highVarianceCount > 0 ? 'text-amber-700' : 'text-stone-500'}`}>
                              {highVarianceCount > 0 ? (
                                <span className="flex items-center gap-1">
                                  <AlertTriangle size={13} />
                                  {highVarianceCount}
                                </span>
                              ) : '—'}
                            </td>
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
