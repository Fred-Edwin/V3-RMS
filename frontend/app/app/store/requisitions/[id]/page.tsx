'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  PageLayout,
  SkeletonTable,
} from '@/components/ui';
import { inventoryService } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import type { RequisitionWithCapacity } from '@/types/inventory';

const statusVariant: Record<string, 'pending' | 'inprogress' | 'ready' | 'closed' | 'cancelled'> = {
  PENDING: 'pending',
  APPROVED: 'inprogress',
  DISPATCHED: 'inprogress',
  RECEIVED: 'ready',
  PARTIAL: 'pending',
};

export default function DispatchRequisitionPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore((s) => s.accessToken);
  const router = useRouter();
  const [requisition, setRequisition] = useState<RequisitionWithCapacity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // map of requisitionItemId → dispatchedQty (string for controlled input)
  const [qtys, setQtys] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token || !id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await inventoryService.getRequisitionById(id, token);
      setRequisition(data);
      const initial: Record<string, string> = {};
      for (const item of data.items) {
        initial[item.id] = String(Math.min(item.requestedQty, item.canFulfilQty));
      }
      setQtys(initial);
    } catch {
      setError('Failed to load requisition.');
    } finally {
      setIsLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDispatch = async () => {
    if (!token || !requisition) return;
    setIsDispatching(true);
    try {
      const items = requisition.items.map((item) => ({
        requisitionItemId: item.id,
        dispatchedQty: Number(qtys[item.id] ?? 0),
      }));
      await inventoryService.dispatchRequisition(requisition.id, { items }, token);
      setDispatched(true);
    } catch {
      setError('Dispatch failed. Please try again.');
    } finally {
      setIsDispatching(false);
    }
  };

  const canDispatch = requisition?.status === 'PENDING';

  if (dispatched) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CheckCircle2 size={48} className="text-green-600" />
          <h2 className="font-display text-2xl text-stone-900">Requisition Dispatched</h2>
          <p className="text-body-sm text-stone-500">Ingredient stock has been deducted from the Central Kitchen.</p>
          <Button onClick={() => router.push('/app/store/requisitions')}>Back to Requisitions</Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/app/store/requisitions')}>
          <ArrowLeft size={16} className="mr-1" />
          Back
        </Button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : error && !requisition ? (
        <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="Error" body={error ?? undefined} action={<Button onClick={() => void load()}>Retry</Button>} />
      ) : requisition ? (
        <>
          <PageHeader
            title={`Requisition — ${requisition.organization?.name ?? 'Branch'}`}
            subtitle={`Submitted ${new Date(requisition.submittedAt).toLocaleString('en-KE')}`}
            action={<Badge variant={statusVariant[requisition.status] ?? 'pending'} />}
          />

          <Card className="bg-parchment shadow-md">
            <CardHeader>
              <h2 className="font-display text-xl text-stone-900">Items</h2>
            </CardHeader>
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left">
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Item</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Requested</th>
                      <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Can Fulfil</th>
                      <th className="pb-2 text-label-sm font-medium text-stone-500">Dispatch Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requisition.items.map((item) => {
                      const canFulfil = item.canFulfilQty;
                      const isShort = canFulfil < item.requestedQty;
                      return (
                        <tr key={item.id} className="border-b border-stone-100 last:border-0">
                          <td className="py-2 pr-4 font-medium text-stone-900">{item.menuItem?.name ?? item.menuItemId}</td>
                          <td className="py-2 pr-4 text-stone-600">{item.requestedQty}</td>
                          <td className={`py-2 pr-4 font-semibold ${isShort ? 'text-amber-700' : 'text-stone-900'}`}>
                            {canFulfil}
                            {isShort && <AlertTriangle size={13} className="ml-1 inline text-amber-600" />}
                          </td>
                          <td className="py-2">
                            {canDispatch ? (
                              <Input
                                type="number"
                                min="0"
                                max={item.requestedQty}
                                className="w-24"
                                value={qtys[item.id] ?? '0'}
                                onChange={(e) => setQtys((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              />
                            ) : (
                              <span className="text-stone-600">{item.dispatchedQty ?? '—'}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {requisition.notes && (
                <p className="mt-4 rounded-md bg-stone-100 p-3 text-body-sm text-stone-600">
                  <span className="font-medium">Notes:</span> {requisition.notes}
                </p>
              )}

              {error && <p className="mt-3 text-body-sm text-red-600">{error}</p>}

              {canDispatch && (
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => void handleDispatch()} disabled={isDispatching} isLoading={isDispatching}>
                    Dispatch Requisition
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </PageLayout>
  );
}
