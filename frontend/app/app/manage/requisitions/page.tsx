'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Plus } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, PageLayout, SkeletonTable } from '@/components/ui';
import { inventoryService } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import type { Requisition } from '@/types/inventory';

const statusVariant: Record<string, 'pending' | 'inprogress' | 'ready' | 'closed' | 'cancelled'> = {
  PENDING: 'pending',
  APPROVED: 'inprogress',
  DISPATCHED: 'inprogress',
  RECEIVED: 'ready',
  PARTIAL: 'pending',
};


export default function BranchRequisitionsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await inventoryService.getRequisitionsForBranch({}, token);
      setRequisitions(data);
    } catch {
      setError('Failed to load requisitions.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageLayout>
      <PageHeader
        title="Requisitions"
        subtitle="Track ingredient requests to the Central Kitchen"
        action={
          <Link href="/app/manage/requisitions/new">
            <Button>
              <Plus size={16} className="mr-1" />
              New Requisition
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : error ? (
        <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="Error" body={error ?? undefined} action={<Button onClick={() => void load()}>Retry</Button>} />
      ) : requisitions.length === 0 ? (
        <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="No requisitions" body="Submit your first requisition to get started." />
      ) : (
        <Card className="bg-parchment shadow-md">
          <CardHeader>
            <h2 className="font-display text-xl text-stone-900">All Requisitions</h2>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left">
                    <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Submitted</th>
                    <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Type</th>
                    <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Items</th>
                    <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map((req) => (
                    <tr key={req.id} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 pr-4 text-stone-600">
                        {new Date(req.submittedAt).toLocaleString('en-KE', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2 pr-4 text-stone-500">{req.isMidDay ? 'Mid-day' : 'Morning'}</td>
                      <td className="py-2 pr-4 text-stone-600">{req.items.length}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={statusVariant[req.status] ?? 'pending'} />
                      </td>
                      <td className="py-2 text-right">
                        <Link href={`/app/manage/requisitions/${req.id}`}>
                          <Button variant="ghost" size="sm">
                            {req.status === 'DISPATCHED' ? 'Confirm Receipt' : 'View'}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </PageLayout>
  );
}
