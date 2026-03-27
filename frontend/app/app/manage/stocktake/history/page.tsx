'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, PageLayout, SkeletonTable } from '@/components/ui';
import { inventoryService } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import type { StocktakeSession } from '@/types/inventory';

export default function StocktakeHistoryPage() {
  const token = useAuthStore((s) => s.accessToken);
  const router = useRouter();
  const [sessions, setSessions] = useState<StocktakeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await inventoryService.getStocktakes({}, token);
      setSessions(data);
    } catch {
      setError('Failed to load stocktake history.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageLayout>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/app/manage/stocktake')}>
          <ArrowLeft size={16} className="mr-1" />
          Back to Stocktake
        </Button>
      </div>
      <PageHeader title="Stocktake History" subtitle="Past stocktake sessions and variance summaries" />

      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : error ? (
        <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="Error" body={error ?? undefined} action={<Button onClick={() => void load()}>Retry</Button>} />
      ) : sessions.length === 0 ? (
        <EmptyState icon={<AlertTriangle size={40} className="text-stone-400" />} heading="No sessions yet" body="Complete your first stocktake to see history here." />
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const hasNegative = session.entries.some((e) => e.variance < 0);
            const isOpen = expanded === session.id;
            return (
              <Card key={session.id} className="bg-parchment shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-xl text-stone-900">
                        {new Date(`${session.date}T00:00:00`).toLocaleDateString('en-KE', {
                          weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </h2>
                      <p className="text-body-sm text-stone-500">
                        By {session.conductedBy?.name ?? '—'} &middot; {session.entries.length} items
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={hasNegative ? 'pending' : 'ready'} />
                      <Button variant="ghost" size="sm" onClick={() => setExpanded(isOpen ? null : session.id)}>
                        {isOpen ? 'Collapse' : 'Details'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardBody>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-stone-200 text-left">
                            <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Item</th>
                            <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Station</th>
                            <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Expected</th>
                            <th className="pb-2 pr-4 text-label-sm font-medium text-stone-500">Actual</th>
                            <th className="pb-2 text-label-sm font-medium text-stone-500">Variance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {session.entries.map((entry) => (
                            <tr key={entry.id} className="border-b border-stone-100 last:border-0">
                              <td className="py-2 pr-4 text-stone-900">{entry.menuItem?.name ?? '—'}</td>
                              <td className="py-2 pr-4 text-stone-500">{entry.station}</td>
                              <td className="py-2 pr-4 text-stone-600">{entry.expectedQty}</td>
                              <td className="py-2 pr-4 text-stone-600">{entry.actualQty}</td>
                              <td className={`py-2 font-semibold ${entry.variance < 0 ? 'text-red-600' : entry.variance > 0 ? 'text-green-600' : 'text-stone-500'}`}>
                                {entry.variance > 0 ? '+' : ''}{entry.variance}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardBody>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
