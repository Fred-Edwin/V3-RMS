'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui';
import { Badge } from '@/components/ui';
import { listStockCounts } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import type { StockCount, StockCountStatus } from '@/types/inventory';

const STATUS_LABEL: Record<StockCountStatus, string> = {
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });

// Session creation is Manager-only (§8.3) — Attendant only ever opens a
// session already created for them and executes/submits it.
export default function StockCountsListPage(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [counts, setCounts] = useState<StockCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await listStockCounts(accessToken);
      setCounts(result);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load stock counts', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-full bg-crema">
      <div className="bg-espresso px-4 pb-5 pt-6 text-crema">
        <p className="font-display text-heading-lg font-medium">Stock Counts</p>
        <p className="text-label-md text-crema/70">Central Store</p>
      </div>

      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-stone-100" />
            ))}
          </div>
        ) : counts.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck size={40} />}
            heading="No count sessions yet"
            body="Your manager creates a count session — it will appear here for you to execute."
          />
        ) : (
          <div className="space-y-3">
            {counts.map((count) => (
              <Link key={count.id} href={`/app/inventory/stock-counts/${count.id}`}>
                <Card className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-body-md font-semibold text-stone-900">{count.label}</p>
                      <p className="text-label-md text-stone-500">{formatDate(count.scheduledDate)}</p>
                    </div>
                    <Badge tone={count.status === 'IN_PROGRESS' ? 'warning' : count.status === 'SUBMITTED' ? 'neutral' : 'success'}>
                      {STATUS_LABEL[count.status]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-label-md text-stone-500">{count.lines.length} items</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
