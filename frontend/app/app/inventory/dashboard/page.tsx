'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  ClipboardCheck,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, IconTile, Input, PageHeader, PageLayout, StatCard, Table, type TableColumn } from '@/components/ui';
import { itemTypeLabel, resolveItemIcon } from '@/components/inventory/item-type-icon';
import { cn } from '@/lib/cn';
import {
  getCentralStoreLocation,
  getLowStockAlertsReport,
  getStockValuationReport,
  getSupplierApAgingReport,
  listInventoryItems,
  listPurchaseOrders,
  listStockCounts,
  listWasteLogs,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import type {
  InventoryItem,
  LowStockAlertLine,
  PurchaseOrder,
  StockCount,
  StockCountStatus,
  SupplierApAgingReport,
} from '@/types/inventory';

const formatKes = (value: string | number): string => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `Ksh ${Number.isFinite(n) ? n.toLocaleString('en-KE', { maximumFractionDigits: 0 }) : '0'}`;
};

const formatQty = (qty: string): string => {
  const n = parseFloat(qty);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

const stockCountStatusBadge: Record<StockCountStatus, { label: string; tone: 'neutral' | 'warning' | 'success' }> = {
  IN_PROGRESS: { label: 'In Progress', tone: 'neutral' },
  SUBMITTED: { label: 'Submitted', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
};

type TypeFilter = 'ALL' | InventoryItem['type'];

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'ALL', label: 'All Items' },
  { value: 'RAW', label: 'Raw Ingredient' },
  { value: 'PREPPED', label: 'Prepped' },
  { value: 'PASS_THROUGH', label: 'Pass-Through' },
];

interface ItemRow extends Record<string, unknown> {
  id: string;
  name: string;
  type: InventoryItem['type'];
  usageUnit: string;
  onHandQty: string;
  currentCost: string;
  value: number;
  lowStock: boolean;
}

// app/app/layout.tsx mounts {children} twice for STORE_MANAGER (dual desktop
// sidebar + CSS-hidden mobile shell). This page pre-dates Session 7's
// shell-context fix and had no mobile variant at all until requested
// explicitly — each branch below checks its own shell context so only the
// visible copy ever fetches/renders.
export default function InventoryDashboardPage(): JSX.Element {
  const isDesktop = useIsDesktopShell();
  if (isDesktop) return <InventoryDashboardPageInner />;
  return <InventoryDashboardMobile />;
}

function InventoryDashboardPageInner(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [totalStockValue, setTotalStockValue] = useState(0);
  const [lowStockLines, setLowStockLines] = useState<LowStockAlertLine[]>([]);
  const [posInFlight, setPosInFlight] = useState<PurchaseOrder[]>([]);
  const [recentCounts, setRecentCounts] = useState<StockCount[]>([]);
  const [apAging, setApAging] = useState<SupplierApAgingReport | null>(null);
  const [wasteCost30d, setWasteCost30d] = useState(0);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const location = await getCentralStoreLocation(accessToken);
      if (!location) {
        toast({ variant: 'error', title: 'Central Store not set up', message: 'No Central Store location was found for this organization.' });
        return;
      }

      const [
        catalogItems,
        valuation,
        lowStock,
        sentPOs,
        partialPOs,
        stockCounts,
        aging,
        wasteLogs,
      ] = await Promise.all([
        listInventoryItems(accessToken, { locationId: location.id, isActive: true }),
        getStockValuationReport(location.id, accessToken),
        getLowStockAlertsReport(location.id, accessToken),
        listPurchaseOrders(accessToken, 'SENT'),
        listPurchaseOrders(accessToken, 'PARTIALLY_RECEIVED'),
        listStockCounts(accessToken, { locationId: location.id }),
        getSupplierApAgingReport(accessToken),
        listWasteLogs(accessToken, { locationId: location.id }),
      ]);

      setItems(catalogItems);
      setTotalStockValue(parseFloat(valuation.totalValue));
      setLowStockLines(lowStock);
      setPosInFlight(
        [...sentPOs, ...partialPOs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      );
      setRecentCounts(
        [...stockCounts].sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1)).slice(0, 5),
      );
      setApAging(aging);

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentWasteCost = wasteLogs
        .filter((log) => new Date(log.loggedAt).getTime() >= thirtyDaysAgo)
        .reduce((sum, log) => sum + parseFloat(log.quantity) * parseFloat(log.inventoryItem.currentCost), 0);
      setWasteCost30d(recentWasteCost);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load dashboard', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const itemRows = useMemo<ItemRow[]>(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => typeFilter === 'ALL' || item.type === typeFilter)
      .filter((item) => !q || item.name.toLowerCase().includes(q))
      .map((item) => {
        const onHandQty = item.onHandQty ?? '0';
        return {
          id: item.id,
          name: item.name,
          type: item.type,
          usageUnit: item.usageUnit,
          onHandQty,
          currentCost: item.currentCost,
          value: parseFloat(onHandQty) * parseFloat(item.currentCost),
          lowStock: parseFloat(onHandQty) <= parseFloat(item.reorderLevel),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search, typeFilter]);

  const apOutstanding = apAging?.bySupplier.reduce((sum, s) => sum + parseFloat(s.totalOutstanding), 0) ?? 0;
  const apOverdueCount = apAging?.lines.filter((l) => l.bucket === '31+').length ?? 0;

  const columns: TableColumn<ItemRow>[] = [
    {
      key: 'name',
      label: 'Item',
      sortable: true,
      render: (_v, row) => (
        <div className="flex items-center gap-2.5">
          <IconTile icon={resolveItemIcon(row.name, row.type)} size="sm" />
          <span className="font-medium text-stone-900">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (_v, row) => <Badge tone="neutral">{itemTypeLabel[row.type]}</Badge>,
    },
    {
      key: 'onHandQty',
      label: 'On Hand',
      className: 'text-right tabular-nums',
      render: (_v, row) => `${formatQty(row.onHandQty)} ${row.usageUnit}`,
    },
    {
      key: 'currentCost',
      label: 'Unit Cost',
      className: 'text-right tabular-nums',
      render: (_v, row) => formatKes(row.currentCost),
    },
    {
      key: 'value',
      label: 'Value',
      className: 'text-right tabular-nums font-semibold',
      render: (_v, row) => formatKes(row.value),
    },
    {
      key: 'lowStock',
      label: 'Status',
      render: (_v, row) =>
        row.lowStock ? <Badge tone="warning">Low Stock</Badge> : <Badge tone="success">Healthy</Badge>,
    },
  ];

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="Inventory Dashboard"
        subtitle="Here's what needs your attention at the Central Store today."
        action={
          <Link href="/app/inventory/purchase-orders/new">
            <Button leftIcon={<Plus size={18} />}>New Purchase Order</Button>
          </Link>
        }
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCardSkeletonAware
          isLoading={isLoading}
          icon={<Package size={16} />}
          label="Total Stock Value"
          value={formatKes(totalStockValue)}
        />
        <StatCardSkeletonAware
          isLoading={isLoading}
          icon={<AlertTriangle size={16} />}
          label="Items Needing Reorder"
          value={lowStockLines.length}
          valueClassName={lowStockLines.length > 0 ? 'text-warning' : undefined}
        />
        <StatCardSkeletonAware
          isLoading={isLoading}
          icon={<Truck size={16} />}
          label="Purchase Orders in Flight"
          value={posInFlight.length}
        />
        <StatCardSkeletonAware
          isLoading={isLoading}
          icon={<ClipboardCheck size={16} />}
          label="Recent Stock Counts"
          value={recentCounts.length}
        />
        <StatCardSkeletonAware
          isLoading={isLoading}
          icon={<Banknote size={16} />}
          label="Accounts Payable"
          value={formatKes(apOutstanding)}
          caption={apOverdueCount > 0 ? `${apOverdueCount} overdue 31+ days` : undefined}
          valueClassName={apOverdueCount > 0 ? 'text-danger' : undefined}
        />
        <StatCardSkeletonAware
          isLoading={isLoading}
          icon={<Trash2 size={16} />}
          label="Waste Cost (30 Days)"
          value={formatKes(wasteCost30d)}
        />
      </div>

      {/* Needs-attention panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <h3 className="text-label-lg font-semibold text-stone-900">Low Stock Alerts</h3>
            <Link href="/app/inventory/stock" className="text-label-sm font-medium text-espresso hover:underline">
              View all
            </Link>
          </div>
          {lowStockLines.length === 0 ? (
            <div className="px-4 py-6 text-center text-body-sm text-stone-500">Nothing running low right now.</div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {lowStockLines.slice(0, 5).map((line) => (
                <li key={line.inventoryItemId} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="min-w-0 truncate text-body-sm text-stone-700">{line.name}</span>
                  <span className="shrink-0 text-label-sm font-semibold tabular-nums text-warning">
                    {formatQty(line.onHandQty)} {line.usageUnit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <h3 className="text-label-lg font-semibold text-stone-900">Purchase Orders Awaiting Delivery</h3>
            <Link href="/app/inventory/purchase-orders" className="text-label-sm font-medium text-espresso hover:underline">
              View all
            </Link>
          </div>
          {posInFlight.length === 0 ? (
            <div className="px-4 py-6 text-center text-body-sm text-stone-500">No orders in flight.</div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {posInFlight.slice(0, 5).map((po) => (
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

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <h3 className="text-label-lg font-semibold text-stone-900">Recent Stock Counts</h3>
            <Link href="/app/inventory/stock-counts" className="text-label-sm font-medium text-espresso hover:underline">
              View all
            </Link>
          </div>
          {recentCounts.length === 0 ? (
            <div className="px-4 py-6 text-center text-body-sm text-stone-500">No count sessions yet.</div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {recentCounts.map((count) => {
                const status = stockCountStatusBadge[count.status];
                return (
                  <li key={count.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-body-sm text-stone-700">{count.label}</p>
                      <p className="truncate text-label-sm text-stone-400">{count.scheduledDate}</p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Inventory items table */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-label-lg font-semibold text-stone-900">Inventory Items</h3>
          <div className="relative w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items…"
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-stone-100 px-4 py-3">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTypeFilter(f.value)}
              className={cn(
                'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-label-md font-medium transition-colors',
                typeFilter === f.value
                  ? 'border-espresso bg-espresso text-crema'
                  : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-stone-100" />
            ))}
          </div>
        ) : itemRows.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart size={40} />}
            heading={items.length === 0 ? 'No items yet' : 'No items match your filters'}
            body={items.length === 0 ? 'Add items to the catalog to see them here.' : 'Try a different search term or filter.'}
          />
        ) : (
          <Table columns={columns} data={itemRows} keyField="id" />
        )}
      </Card>
    </PageLayout>
  );
}

function StatCardSkeletonAware({
  isLoading,
  icon,
  label,
  value,
  caption,
  valueClassName,
}: {
  isLoading: boolean;
  icon: React.ReactNode;
  label: string;
  value: string | number;
  caption?: string;
  valueClassName?: string;
}): JSX.Element {
  if (isLoading) {
    return <div className="h-[104px] animate-pulse rounded-xl bg-stone-100" />;
  }
  return <StatCard icon={icon} label={label} value={value} caption={caption} valueClassName={valueClassName} />;
}

// ─── Manager mobile ─────────────────────────────────────────────────────────
// Genuinely separate mobile design, not the desktop table/stat-row reflowed
// (per §8.0's rule for every other Manager screen): a 2-column grid of the
// same 6 headline numbers as the desktop stat row, then three compact
// tap-through panels (Low Stock, POs Awaiting Delivery, Recent Stock
// Counts) each linking into its real screen instead of duplicating it — the
// searchable/filterable items table itself is Stock on Hand's job, not
// repeated here.
function InventoryDashboardMobile(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [totalStockValue, setTotalStockValue] = useState(0);
  const [lowStockLines, setLowStockLines] = useState<LowStockAlertLine[]>([]);
  const [posInFlight, setPosInFlight] = useState<PurchaseOrder[]>([]);
  const [recentCounts, setRecentCounts] = useState<StockCount[]>([]);
  const [apAging, setApAging] = useState<SupplierApAgingReport | null>(null);
  const [wasteCost30d, setWasteCost30d] = useState(0);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const location = await getCentralStoreLocation(accessToken);
      if (!location) {
        toast({ variant: 'error', title: 'Central Store not set up', message: 'No Central Store location was found for this organization.' });
        return;
      }

      const [valuation, lowStock, sentPOs, partialPOs, stockCounts, aging, wasteLogs] = await Promise.all([
        getStockValuationReport(location.id, accessToken),
        getLowStockAlertsReport(location.id, accessToken),
        listPurchaseOrders(accessToken, 'SENT'),
        listPurchaseOrders(accessToken, 'PARTIALLY_RECEIVED'),
        listStockCounts(accessToken, { locationId: location.id }),
        getSupplierApAgingReport(accessToken),
        listWasteLogs(accessToken, { locationId: location.id }),
      ]);

      setTotalStockValue(parseFloat(valuation.totalValue));
      setLowStockLines(lowStock);
      setPosInFlight([...sentPOs, ...partialPOs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
      setRecentCounts([...stockCounts].sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1)).slice(0, 5));
      setApAging(aging);

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentWasteCost = wasteLogs
        .filter((log) => new Date(log.loggedAt).getTime() >= thirtyDaysAgo)
        .reduce((sum, log) => sum + parseFloat(log.quantity) * parseFloat(log.inventoryItem.currentCost), 0);
      setWasteCost30d(recentWasteCost);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load dashboard', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const apOutstanding = apAging?.bySupplier.reduce((sum, s) => sum + parseFloat(s.totalOutstanding), 0) ?? 0;
  const apOverdueCount = apAging?.lines.filter((l) => l.bucket === '31+').length ?? 0;

  const cards: { label: string; value: string; icon: React.ElementType; tone: 'default' | 'warning' | 'danger' }[] = [
    { label: 'Total Stock Value', value: formatKes(totalStockValue), icon: Package, tone: 'default' },
    { label: 'Items Needing Reorder', value: String(lowStockLines.length), icon: AlertTriangle, tone: lowStockLines.length > 0 ? 'warning' : 'default' },
    { label: 'POs in Flight', value: String(posInFlight.length), icon: Truck, tone: 'default' },
    { label: 'Recent Stock Counts', value: String(recentCounts.length), icon: ClipboardCheck, tone: 'default' },
    { label: 'Accounts Payable', value: formatKes(apOutstanding), icon: Banknote, tone: apOverdueCount > 0 ? 'danger' : 'default' },
    { label: 'Waste Cost (30d)', value: formatKes(wasteCost30d), icon: Trash2, tone: 'default' },
  ];

  return (
    <div className="min-h-full bg-crema pb-8">
      <div className="bg-espresso px-4 pb-5 pt-6 text-crema">
        <p className="font-display text-heading-lg font-medium">Dashboard</p>
        <p className="text-label-md text-crema/70">What needs your attention today</p>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-md bg-stone-100" />)
          : cards.map(({ label, value, icon: Icon, tone }) => (
              <div
                key={label}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-md border p-3.5',
                  tone === 'warning' ? 'border-warning-border bg-warning-bg' : tone === 'danger' ? 'border-danger-border bg-danger-bg' : 'border-stone-200 bg-white',
                )}
              >
                <Icon size={18} className={tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : 'text-espresso'} />
                <p className="text-label-sm text-stone-500">{label}</p>
                <p className="text-heading-sm font-bold tabular-nums text-stone-900">{value}</p>
                {label === 'Accounts Payable' && apOverdueCount > 0 && (
                  <p className="text-label-sm text-danger">{apOverdueCount} overdue 31+ days</p>
                )}
              </div>
            ))}
      </div>

      <div className="space-y-3 px-4 pb-4">
        <Link href="/app/inventory/stock" className="block">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <h3 className="text-label-lg font-semibold text-stone-900">Low Stock Alerts</h3>
              <span className="text-label-sm font-medium text-espresso">View all ›</span>
            </div>
            {lowStockLines.length === 0 ? (
              <div className="px-4 py-5 text-center text-body-sm text-stone-500">Nothing running low right now.</div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {lowStockLines.slice(0, 4).map((line) => (
                  <li key={line.inventoryItemId} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <span className="min-w-0 truncate text-body-sm text-stone-700">{line.name}</span>
                    <span className="shrink-0 text-label-sm font-semibold tabular-nums text-warning">
                      {parseFloat(line.onHandQty).toFixed(1)} {line.usageUnit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Link>

        <Link href="/app/inventory/purchase-orders" className="block">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <h3 className="text-label-lg font-semibold text-stone-900">POs Awaiting Delivery</h3>
              <span className="text-label-sm font-medium text-espresso">View all ›</span>
            </div>
            {posInFlight.length === 0 ? (
              <div className="px-4 py-5 text-center text-body-sm text-stone-500">No orders in flight.</div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {posInFlight.slice(0, 4).map((po) => (
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
              <h3 className="text-label-lg font-semibold text-stone-900">Recent Stock Counts</h3>
              <span className="text-label-sm font-medium text-espresso">View all ›</span>
            </div>
            {recentCounts.length === 0 ? (
              <div className="px-4 py-5 text-center text-body-sm text-stone-500">No count sessions yet.</div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {recentCounts.slice(0, 4).map((count) => {
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
      </div>

      {/* Thumb-reachable new-PO action, matching the desktop header's primary action */}
      <Link
        href="/app/inventory/purchase-orders/new"
        className="fixed bottom-24 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-amber px-5 text-label-lg font-semibold text-espresso shadow-lg"
      >
        <Plus size={20} />
        New Purchase Order
      </Link>
    </div>
  );
}
