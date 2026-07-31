'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, ClipboardCheck, Package, Truck } from 'lucide-react';
import { Badge, Card, HelpTip } from '@/components/ui';
import {
  getCentralStoreLocation,
  listPrepRecords,
  listPurchaseOrders,
  listStockCounts,
  listWasteLogs,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { formatKes } from '@/lib/inventory-format';
import type { PrepRecord, PurchaseOrder, StockCount, StockCountStatus, WasteLog } from '@/types/inventory';

const stockCountStatusBadge: Record<StockCountStatus, { label: string; tone: 'neutral' | 'warning' | 'success' }> = {
  IN_PROGRESS: { label: 'In Progress', tone: 'neutral' },
  SUBMITTED: { label: 'Submitted', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
};

// New landing tab for Store Attendant's mobile nav (UI_UX_DESIGN_AUDIT.md,
// §8.1 rows 10+11 session's deferred finding: the role had no Dashboard/Home
// destination at all — every existing tab was a task screen). Mirrors
// Store Manager mobile Dashboard's stat-grid + tap-through-panel shape, but
// the content is Attendant-specific: what's on their plate today (orders
// awaiting receipt, open counts, prep logged), not Manager's valuation/AP
// figures Attendant has no RBAC access to (§8.3).
export default function AttendantDashboardPage(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [posAwaitingReceipt, setPosAwaitingReceipt] = useState<PurchaseOrder[]>([]);
  const [openCounts, setOpenCounts] = useState<StockCount[]>([]);
  const [prepToday, setPrepToday] = useState<PrepRecord[]>([]);
  const [wasteToday, setWasteToday] = useState<WasteLog[]>([]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const location = await getCentralStoreLocation(accessToken);
      if (!location) {
        toast({ variant: 'error', title: 'Central Store not set up', message: 'No Central Store location was found for this organization.' });
        return;
      }

      const [sentPOs, partialPOs, stockCounts, prepRecords, wasteLogs] = await Promise.all([
        listPurchaseOrders(accessToken, 'SENT'),
        listPurchaseOrders(accessToken, 'PARTIALLY_RECEIVED'),
        listStockCounts(accessToken, { locationId: location.id }),
        listPrepRecords(accessToken, { locationId: location.id }),
        listWasteLogs(accessToken, { locationId: location.id }),
      ]);

      setPosAwaitingReceipt(
        [...sentPOs, ...partialPOs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      );
      setOpenCounts(
        stockCounts
          .filter((c) => c.status === 'IN_PROGRESS')
          .sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1)),
      );

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      setPrepToday(
        prepRecords
          .filter((p) => new Date(p.recordedAt).getTime() >= startOfToday.getTime())
          .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1)),
      );
      setWasteToday(wasteLogs.filter((w) => new Date(w.loggedAt).getTime() >= startOfToday.getTime()));
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load dashboard', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const wasteCostToday = useMemo(
    () => wasteToday.reduce((sum, w) => sum + parseFloat(w.quantity) * parseFloat(w.inventoryItem.currentCost), 0),
    [wasteToday],
  );

  const cards: { label: string; value: string; icon: React.ElementType; tone: 'default' | 'warning' }[] = [
    { label: 'Orders Awaiting Receipt', value: String(posAwaitingReceipt.length), icon: Truck, tone: posAwaitingReceipt.length > 0 ? 'warning' : 'default' },
    { label: 'Open Stock Counts', value: String(openCounts.length), icon: ClipboardCheck, tone: openCounts.length > 0 ? 'warning' : 'default' },
    { label: 'Prep Logged Today', value: String(prepToday.length), icon: ChefHat, tone: 'default' },
    { label: 'Waste Logged Today', value: formatKes(wasteCostToday), icon: Package, tone: 'default' },
  ];

  return (
    <div className="min-h-full bg-crema pb-8">
      <div className="flex items-start justify-between gap-3 bg-espresso px-4 pb-5 pt-6 text-crema">
        <div>
          <p className="font-display text-heading-lg font-medium">Dashboard</p>
          <p className="text-label-md text-crema/70">Central Store · What&rsquo;s on your plate today</p>
        </div>
        <HelpTip
          title="Dashboard"
          triggerClassName="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-crema/70 transition-colors hover:bg-white/10 hover:text-crema focus-visible:outline-none focus-visible:shadow-focus"
        >
          <p>A quick look at what needs your attention right now — deliveries to receive, counts still open, and what you&rsquo;ve logged today.</p>
          <p className="mt-2">Tap any card below to jump straight into that task.</p>
        </HelpTip>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-md bg-stone-100" />)
          : cards.map(({ label, value, icon: Icon, tone }) => (
              <div
                key={label}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-md border p-3.5',
                  tone === 'warning' ? 'border-warning-border bg-warning-bg' : 'border-stone-200 bg-white',
                )}
              >
                <Icon size={18} className={tone === 'warning' ? 'text-warning' : 'text-espresso'} />
                <p className="text-label-sm text-stone-500">{label}</p>
                <p className="text-heading-sm font-bold tabular-nums text-stone-900">{value}</p>
              </div>
            ))}
      </div>

      <div className="space-y-3 px-4 pb-4">
        <Link href="/app/inventory/receiving" className="block">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <h3 className="text-label-lg font-semibold text-stone-900">Orders Awaiting Receipt</h3>
              <span className="text-label-sm font-medium text-espresso">View all ›</span>
            </div>
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-md bg-stone-100" />
                ))}
              </div>
            ) : posAwaitingReceipt.length === 0 ? (
              <div className="px-4 py-5 text-center text-body-sm text-stone-500">Nothing waiting on receiving right now.</div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {posAwaitingReceipt.slice(0, 4).map((po) => (
                  <li key={po.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-body-sm text-stone-700">{po.poNumber}</p>
                      <p className="truncate text-label-sm text-stone-400">{po.supplier.name}</p>
                    </div>
                    <Badge tone={po.status === 'PARTIALLY_RECEIVED' ? 'warning' : 'neutral'}>
                      {po.status === 'PARTIALLY_RECEIVED' ? 'Partial' : 'Sent'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Link>

        <Link href="/app/inventory/stock-counts" className="block">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <h3 className="text-label-lg font-semibold text-stone-900">Open Stock Counts</h3>
              <span className="text-label-sm font-medium text-espresso">View all ›</span>
            </div>
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-md bg-stone-100" />
                ))}
              </div>
            ) : openCounts.length === 0 ? (
              <div className="px-4 py-5 text-center text-body-sm text-stone-500">No counts in progress.</div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {openCounts.slice(0, 4).map((count) => {
                  const status = stockCountStatusBadge[count.status];
                  return (
                    <li key={count.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <p className="min-w-0 truncate text-body-sm text-stone-700">{count.label}</p>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </Link>

        <Link href="/app/inventory/prep" className="block">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <h3 className="text-label-lg font-semibold text-stone-900">Today&rsquo;s Prep</h3>
              <span className="text-label-sm font-medium text-espresso">Log prep ›</span>
            </div>
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-md bg-stone-100" />
                ))}
              </div>
            ) : prepToday.length === 0 ? (
              <div className="px-4 py-5 text-center text-body-sm text-stone-500">No prep logged yet today.</div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {prepToday.slice(0, 4).map((prep) => (
                  <li key={prep.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <p className="min-w-0 truncate text-body-sm text-stone-700">{prep.outputItem.name}</p>
                    <span className="shrink-0 text-label-sm font-semibold tabular-nums text-stone-500">
                      {prep.actualYield} {prep.outputItem.usageUnit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Link>
      </div>
    </div>
  );
}
