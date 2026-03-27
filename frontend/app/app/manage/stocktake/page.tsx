'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronDown, ChevronRight, History, Search } from 'lucide-react';
import {
  Button,
  Input,
  PageHeader,
  PageLayout,
} from '@/components/ui';
import { inventoryService } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { StocktakeStation } from '@/types/inventory';
import type { MenuItemStocktakeRow } from '@/types/inventory';

type Station = 'KITCHEN' | 'BARISTA' | 'WAITER';

interface EntryRow extends MenuItemStocktakeRow {
  actualQty: string;
  station: Station;
  categoryName: string;
}

const toYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function BranchStocktakePage() {
  const token = useAuthStore((s) => s.accessToken);
  const router = useRouter();
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [activeStation, setActiveStation] = useState<Station>('KITCHEN');
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const items = await inventoryService.getMenuItemsWithBranchStock(token);
    setRows(
      items.map((item) => {
        const station: Station = item.category.prepStation === 'BARISTA' ? 'BARISTA' : 'KITCHEN';
        return {
          ...item,
          actualQty: String(item.currentQty),
          station,
          categoryName: item.category.name,
        };
      }),
    );
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const stations: Station[] = [StocktakeStation.KITCHEN, StocktakeStation.BARISTA, StocktakeStation.WAITER];

  // All rows for the active station
  const stationRows = useMemo(
    () => rows.filter((r) => r.station === activeStation),
    [rows, activeStation],
  );

  // Filter by search, then group by category
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? stationRows.filter((r) => r.name.toLowerCase().includes(q)) : stationRows;
  }, [stationRows, search]);

  const categories = useMemo(() => {
    const map = new Map<string, EntryRow[]>();
    for (const row of filteredRows) {
      const existing = map.get(row.categoryName) ?? [];
      existing.push(row);
      map.set(row.categoryName, existing);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRows]);

  const toggleCategory = (name: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const updateRow = (menuItemId: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.menuItemId === menuItemId ? { ...r, actualQty: value } : r)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    try {
      await inventoryService.submitStocktake(
        {
          date: toYmd(new Date()),
          entries: rows.map((r) => ({
            station: r.station,
            menuItemId: r.menuItemId,
            expectedQty: r.currentQty,
            actualQty: Number(r.actualQty) || 0,
          })),
        },
        token,
      );
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CheckCircle2 size={48} className="text-green-600" />
          <h2 className="font-display text-2xl text-stone-900">Stocktake Complete</h2>
          <p className="text-body-sm text-stone-500">Variance report saved for today.</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => router.push('/app/manage/stocktake/history')}>
              <History size={16} className="mr-1" />
              View History
            </Button>
            <Button onClick={() => { setSubmitted(false); void load(); }}>Take Another</Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Stocktake"
        subtitle={`Date: ${toYmd(new Date())}`}
        action={
          <Button variant="secondary" size="sm" onClick={() => router.push('/app/manage/stocktake/history')}>
            <History size={16} className="mr-1" />
            History
          </Button>
        }
      />

      {/* Station tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-stone-100 p-1">
        {stations.map((s) => {
          const count = rows.filter((r) => r.station === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => { setActiveStation(s); setSearch(''); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-label-sm font-medium transition-colors ${
                activeStation === s
                  ? 'bg-espresso text-white shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
              {count > 0 && (
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                  activeStation === s ? 'bg-white/20 text-white' : 'bg-stone-300 text-stone-700'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="text-body-sm text-stone-500">Loading menu items…</p>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Category sections */}
          {stationRows.length === 0 ? (
            <p className="rounded-lg border border-stone-200 bg-parchment px-4 py-8 text-center text-body-sm text-stone-500">
              No items assigned to this station.
            </p>
          ) : categories.length === 0 ? (
            <p className="rounded-lg border border-stone-200 bg-parchment px-4 py-8 text-center text-body-sm text-stone-500">
              No items match your search.
            </p>
          ) : (
            categories.map(([categoryName, catRows]) => {
              const isCollapsed = collapsedCategories.has(categoryName);
              const changedCount = catRows.filter(
                (r) => Number(r.actualQty) !== r.currentQty,
              ).length;
              return (
                <div key={categoryName} className="overflow-hidden rounded-xl border border-stone-200 bg-parchment shadow-sm">
                  {/* Category header — click to collapse */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(categoryName)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-stone-50"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight size={16} className="text-stone-400" />
                      ) : (
                        <ChevronDown size={16} className="text-stone-400" />
                      )}
                      <span className="font-display font-semibold text-stone-900">{categoryName}</span>
                      <span className="text-label-sm text-stone-400">{catRows.length} items</span>
                    </div>
                    {changedCount > 0 && !isCollapsed && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-label-sm font-medium text-amber-800">
                        {changedCount} edited
                      </span>
                    )}
                    {changedCount > 0 && isCollapsed && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-label-sm font-medium text-amber-800">
                        {changedCount} edited
      </span>
                    )}
                  </button>

                  {/* Items */}
                  {!isCollapsed && (
                    <div className="border-t border-stone-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-stone-100 bg-stone-50 text-left">
                            <th className="px-4 py-2 text-label-sm font-medium text-stone-500">Item</th>
                            <th className="px-4 py-2 text-label-sm font-medium text-stone-500">Expected</th>
                            <th className="px-4 py-2 text-label-sm font-medium text-stone-500">Actual Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catRows.map((row) => {
                            const actual = Number(row.actualQty);
                            const variance = Number.isNaN(actual) ? null : actual - row.currentQty;
                            return (
                              <tr key={row.menuItemId} className="border-b border-stone-100 last:border-0">
                                <td className="px-4 py-2.5 font-medium text-stone-900">{row.name}</td>
                                <td className="px-4 py-2.5 text-stone-500">{row.currentQty}</td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-3">
                                    <Input
                                      type="number"
                                      min="0"
                                      className="w-24"
                                      value={row.actualQty}
                                      onChange={(e) => updateRow(row.menuItemId, e.target.value)}
                                    />
                                    {variance !== null && variance !== 0 && (
                                      <span className={`text-xs font-semibold ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {variance > 0 ? '+' : ''}{variance}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Submit */}
          {stationRows.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-body-sm text-stone-500">
                Count all stations before submitting.
              </p>
              <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting}>
                Submit All Counts
              </Button>
            </div>
          )}
        </form>
      )}
    </PageLayout>
  );
}
