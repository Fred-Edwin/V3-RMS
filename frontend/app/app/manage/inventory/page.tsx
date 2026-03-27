'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Package, Search, Utensils, Coffee } from 'lucide-react';
import { Badge, Button, Card, CardBody, EmptyState, PageHeader, PageLayout, SkeletonTable, StatCard } from '@/components/ui';
import { useInventorySocket } from '@/hooks/useInventorySocket';
import { useAuthStore } from '@/store/authStore';
import { useInventoryStore } from '@/store/inventoryStore';
import type { BranchStockItem } from '@/types/inventory';

type StockStatus = 'all' | 'out' | 'low' | 'ok';

function getStatus(current: number, threshold: number): 'out' | 'low' | 'ok' {
  if (current <= 0) return 'out';
  if (current <= threshold) return 'low';
  return 'ok';
}

function getStation(item: BranchStockItem): 'KITCHEN' | 'BARISTA' | 'BOTH' {
  return item.menuItem?.category?.prepStation ?? 'KITCHEN';
}

export default function BranchInventoryPage() {
  const token = useAuthStore((s) => s.accessToken);
  const branchStock = useInventoryStore((s) => s.branchStock);
  const isLoading = useInventoryStore((s) => s.isLoadingStock);
  const fetchBranchStock = useInventoryStore((s) => s.fetchBranchStock);

  const [filter, setFilter] = useState<StockStatus>('all');
  const [search, setSearch] = useState('');

  useInventorySocket();

  const load = useCallback(() => {
    if (token) void fetchBranchStock(token);
  }, [token, fetchBranchStock]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    let out = 0, low = 0, ok = 0;
    for (const item of branchStock) {
      const s = getStatus(item.currentQty, item.lowStockThreshold);
      if (s === 'out') out++;
      else if (s === 'low') low++;
      else ok++;
    }
    return { out, low, ok };
  }, [branchStock]);

  const filtered = useMemo(() => {
    return branchStock.filter((item) => {
      const status = getStatus(item.currentQty, item.lowStockThreshold);
      if (filter === 'out' && status !== 'out') return false;
      if (filter === 'low' && status !== 'low') return false;
      if (filter === 'ok' && status !== 'ok') return false;
      if (search) {
        const name = item.menuItem?.name ?? '';
        if (!name.toLowerCase().includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [branchStock, filter, search]);

  // Group by station, Kitchen first
  const grouped = useMemo(() => {
    const kitchen: BranchStockItem[] = [];
    const barista: BranchStockItem[] = [];
    for (const item of filtered) {
      const station = getStation(item);
      if (station === 'BARISTA') barista.push(item);
      else kitchen.push(item); // KITCHEN and BOTH go to kitchen
    }
    return { kitchen, barista };
  }, [filtered]);

  const tabs: { key: StockStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'out', label: 'Out of Stock' },
    { key: 'low', label: 'Low Stock' },
    { key: 'ok', label: 'In Stock' },
  ];

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
        <EmptyState
          icon={<Package size={40} className="text-stone-400" />}
          heading="No stock data"
          body="Submit your first stocktake to seed branch stock levels."
        />
      ) : (
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              value={counts.out}
              label="Out of Stock"
              icon={<AlertTriangle size={16} />}
              valueClassName="text-red-600"
              className="cursor-pointer"
              onClick={() => setFilter(filter === 'out' ? 'all' : 'out')}
            />
            <StatCard
              value={counts.low}
              label="Low Stock"
              icon={<AlertTriangle size={16} />}
              valueClassName="text-amber-600"
              className="cursor-pointer"
              onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}
            />
            <StatCard
              value={counts.ok}
              label="In Stock"
              icon={<Package size={16} />}
              valueClassName="text-green-700"
              className="cursor-pointer"
              onClick={() => setFilter(filter === 'ok' ? 'all' : 'ok')}
            />
          </div>

          {/* Filter tabs + search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 rounded-lg bg-stone-100 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === tab.key
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'out' && counts.out > 0 && (
                    <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-600">
                      {counts.out}
                    </span>
                  )}
                  {tab.key === 'low' && counts.low > 0 && (
                    <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-600">
                      {counts.low}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 sm:w-56"
              />
            </div>
          </div>

          {/* Stock table grouped by station */}
          {filtered.length === 0 ? (
            <Card className="bg-parchment shadow-sm">
              <CardBody>
                <p className="py-6 text-center text-sm text-stone-400">No items match this filter.</p>
              </CardBody>
            </Card>
          ) : (
            <Card className="bg-parchment shadow-md">
              <CardBody className="p-0">
                {[
                  { label: 'Kitchen', items: grouped.kitchen, icon: <Utensils size={14} /> },
                  { label: 'Barista', items: grouped.barista, icon: <Coffee size={14} /> },
                ].map(({ label, items, icon }) =>
                  items.length === 0 ? null : (
                    <div key={label}>
                      {/* Station header */}
                      <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2">
                        <span className="text-stone-400">{icon}</span>
                        <span className="text-label-sm font-semibold uppercase tracking-wider text-stone-500">
                          {label}
                        </span>
                        <span className="ml-auto text-xs text-stone-400">{items.length} items</span>
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          {items.map((item) => {
                            const status = getStatus(item.currentQty, item.lowStockThreshold);
                            return (
                              <tr
                                key={item.id}
                                className={`border-b border-stone-100 last:border-0 ${
                                  status === 'out' ? 'bg-red-50/40' : status === 'low' ? 'bg-amber-50/40' : ''
                                }`}
                              >
                                <td className="py-2.5 pl-4 pr-2 font-medium text-stone-900">
                                  {item.menuItem?.name ?? item.menuItemId}
                                </td>
                                <td className="py-2.5 pr-2 text-right">
                                  <span
                                    className={`font-semibold ${
                                      status === 'out'
                                        ? 'text-red-600'
                                        : status === 'low'
                                          ? 'text-amber-700'
                                          : 'text-stone-900'
                                    }`}
                                  >
                                    {item.currentQty}
                                  </span>
                                  {item.lowStockThreshold > 0 && (
                                    <span className="ml-1 text-xs text-stone-400">
                                      (low≤{item.lowStockThreshold})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 pr-4 text-right">
                                  <Badge
                                    variant={
                                      status === 'out' ? 'closed' : status === 'low' ? 'pending' : 'ready'
                                    }
                                    label={
                                      status === 'out'
                                        ? 'Out of Stock'
                                        : status === 'low'
                                          ? 'Low Stock'
                                          : 'In Stock'
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ),
                )}
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </PageLayout>
  );
}
