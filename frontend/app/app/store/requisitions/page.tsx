'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
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


export default function CKRequisitionsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await inventoryService.getRequisitions({}, token);
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

  const pending = requisitions.filter((r) => r.status === 'PENDING');
  const others = requisitions.filter((r) => r.status !== 'PENDING');

  return (
    <PageLayout>
      <PageHeader title="Branch Requisitions" subtitle="Review and dispatch ingredient requests from branches" />

      {isLoading ? (
        <SkeletonTable rows={8} />
      ) : error ? (
        <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="Error" body={error ?? undefined} action={<Button onClick={() => void load()}>Retry</Button>} />
      ) : requisitions.length === 0 ? (
        <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="No requisitions" body="No branches have submitted requisitions yet today." />
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <Card className="bg-parchment shadow-md">
              <CardHeader>
                <h2 className="font-display text-xl text-stone-900">
                  Awaiting Dispatch{' '}
                  <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800">
                    {pending.length}
                  </span>
                </h2>
              </CardHeader>
              <CardBody>
                <RequisitionTable rows={pending} />
              </CardBody>
            </Card>
          )}
          {others.length > 0 && (
            <Card className="bg-parchment shadow-md">
              <CardHeader>
                <h2 className="font-display text-xl text-stone-900">All Requisitions</h2>
              </CardHeader>
              <CardBody>
                <RequisitionTable rows={others} />
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </PageLayout>
  );
}

function RequisitionTable({ rows }: { rows: Requisition[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left">
            <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Branch</th>
            <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Submitted</th>
            <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Items</th>
            <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Type</th>
            <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Status</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((req) => (
            <tr key={req.id} className="border-b border-stone-100 last:border-0">
              <td className="py-2 pr-4 font-medium text-stone-900">{req.organization?.name ?? '—'}</td>
              <td className="py-2 pr-4 text-stone-600">
                {new Date(req.submittedAt).toLocaleString('en-KE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="py-2 pr-4 text-stone-600">{req.items.length}</td>
              <td className="py-2 pr-4 text-stone-500">{req.isMidDay ? 'Mid-day' : 'Morning'}</td>
              <td className="py-2 pr-4">
                <Badge variant={statusVariant[req.status] ?? 'pending'} />
              </td>
              <td className="py-2 text-right">
                <Link href={`/app/store/requisitions/${req.id}`}>
                  <Button variant="ghost" size="sm">
                    {req.status === 'PENDING' ? 'Dispatch' : 'View'}
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
