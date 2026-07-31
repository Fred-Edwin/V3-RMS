'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  Badge,
  Card,
  ExcelTable,
  HelpTip,
  IconButton,
  IconTile,
  Input,
  PageHeader,
  PageLayout,
  Select,
  StatCard,
  type ExcelColumn,
} from '@/components/ui';
import { itemTypeLabel, resolveItemIcon } from '@/components/inventory/item-type-icon';
import {
  getCentralStoreLocation,
  getInventoryItemTransactions,
  listInventoryItems,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { cn } from '@/lib/cn';
import { formatBuyUnitCost, formatBuyUnitQuantity } from '@/lib/inventory-format';
import type { DepartmentTag, InventoryItem, InventoryItemType, InventoryTransaction } from '@/types/inventory';

type TypeFilter = 'ALL' | InventoryItemType;
type DepartmentFilter = 'ALL' | DepartmentTag;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'ALL', label: 'All Items' },
  { value: 'RAW', label: 'Raw Ingredient' },
  { value: 'PREPPED', label: 'Prepped' },
  { value: 'PASS_THROUGH', label: 'Pass-Through' },
];

const DEPARTMENT_TAGS: DepartmentTag[] = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];

const departmentLabel: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

const TRANSACTION_LABELS: Record<InventoryTransaction['type'], string> = {
  RECEIVE: 'Received',
  PREP_CONSUME: 'Used in Prep',
  PREP_PRODUCE: 'Prep Output',
  WASTE: 'Waste',
  ADJUSTMENT: 'Count Adjustment',
  DISPATCH_OUT: 'Dispatched Out',
  DISPATCH_IN: 'Dispatched In',
  MARKET_RECEIVE: 'Market Receive',
  SALE: 'Sale',
};

const formatKes = (value: string | number): string => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return `Ksh ${Number.isFinite(n) ? n.toLocaleString('en-KE', { maximumFractionDigits: 2 }) : '0'}`;
};

const formatQty = (qty: string | undefined): string => {
  if (qty === undefined) return '—';
  const n = parseFloat(qty);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

interface ItemRow extends Record<string, unknown> {
  item: InventoryItem;
  onHandQty: string;
  value: number;
  lowStock: boolean;
}

// app/app/layout.tsx mounts {children} twice for STORE_MANAGER (dual desktop
// sidebar + CSS-hidden mobile shell) — no mobile variant of this screen
// exists yet (Session 8), so the mobile-shell copy renders nothing rather
// than duplicating data-fetching and DOM element ids.
export function StockOnHandDesktop(): JSX.Element | null {
  const isDesktop = useIsDesktopShell();
  if (!isDesktop) return null;
  return <StockOnHandDesktopInner />;
}

function StockOnHandDesktopInner(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [locationId, setLocationId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilter>('ALL');

  const [sortKey, setSortKey] = useState<'name' | 'onHandQty' | 'currentCost' | 'value'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const location = await getCentralStoreLocation(accessToken);
      if (!location) {
        toast({ variant: 'error', title: 'Central Store not set up', message: 'No Central Store location was found for this organization.' });
        return;
      }
      setLocationId(location.id);
      const result = await listInventoryItems(accessToken, { locationId: location.id, isActive: true });
      setItems(result);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load stock', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openMovementHistory = useCallback(
    async (item: InventoryItem) => {
      if (!accessToken || !locationId) return;
      setSelectedItem(item);
      setIsLoadingTransactions(true);
      try {
        const result = await getInventoryItemTransactions(item.id, locationId, accessToken);
        setTransactions(result);
      } catch (error) {
        toast({ variant: 'error', title: 'Failed to load movement history', message: error instanceof Error ? error.message : 'Please try again.' });
      } finally {
        setIsLoadingTransactions(false);
      }
    },
    [accessToken, locationId, toast],
  );

  const rows = useMemo<ItemRow[]>(() => {
    const q = search.trim().toLowerCase();
    const filtered = items
      .filter((item) => typeFilter === 'ALL' || item.type === typeFilter)
      .filter((item) => departmentFilter === 'ALL' || item.departmentTags.includes(departmentFilter))
      .filter((item) => !q || item.name.toLowerCase().includes(q))
      .map((item) => {
        const onHandQty = item.onHandQty ?? '0';
        return {
          item,
          onHandQty,
          value: parseFloat(onHandQty) * parseFloat(item.currentCost),
          lowStock: parseFloat(onHandQty) <= parseFloat(item.reorderLevel),
        };
      });

    const dir = sortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      if (sortKey === 'name') return a.item.name.localeCompare(b.item.name) * dir;
      if (sortKey === 'onHandQty') return (parseFloat(a.onHandQty) - parseFloat(b.onHandQty)) * dir;
      if (sortKey === 'currentCost') return (parseFloat(a.item.currentCost) - parseFloat(b.item.currentCost)) * dir;
      return (a.value - b.value) * dir;
    });
    return filtered;
  }, [items, search, typeFilter, departmentFilter, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const totalValue = rows.reduce((sum, r) => sum + r.value, 0);
  const lowStockCount = rows.filter((r) => r.lowStock).length;

  const columns: ExcelColumn<ItemRow>[] = [
    {
      key: '__row',
      label: '#',
      align: 'right',
      render: (row, index) => <span className="text-stone-400">{index + 1}</span>,
    },
    {
      key: 'name',
      label: 'Item',
      sort: { direction: sortKey === 'name' ? sortDir : null, onToggle: () => toggleSort('name') },
      render: (row) => (
        <button
          type="button"
          onClick={() => openMovementHistory(row.item)}
          className="text-left font-medium text-office-ink hover:underline"
        >
          {row.item.name}
        </button>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => <Badge tone="neutral">{itemTypeLabel[row.item.type]}</Badge>,
    },
    {
      key: 'onHandQty',
      label: 'On Hand',
      numeric: true,
      sort: { direction: sortKey === 'onHandQty' ? sortDir : null, onToggle: () => toggleSort('onHandQty') },
      render: (row) => formatBuyUnitQuantity(row.onHandQty, row.item),
    },
    {
      key: 'lastReceivedUnitCost',
      label: 'Last Received',
      numeric: true,
      render: (row) =>
        row.item.lastReceivedUnitCost === undefined ? (
          <span className="text-stone-400">—</span>
        ) : (
          formatBuyUnitCost({ ...row.item, currentCost: row.item.lastReceivedUnitCost })
        ),
    },
    {
      key: 'currentCost',
      label: 'Avg. Unit Cost',
      numeric: true,
      sort: { direction: sortKey === 'currentCost' ? sortDir : null, onToggle: () => toggleSort('currentCost') },
      render: (row) => formatBuyUnitCost(row.item),
    },
    {
      key: 'value',
      label: 'Value',
      numeric: true,
      sort: { direction: sortKey === 'value' ? sortDir : null, onToggle: () => toggleSort('value') },
      render: (row) => <span className="font-semibold">{formatKes(row.value)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (row.lowStock ? <Badge tone="warning">Low Stock</Badge> : <Badge tone="success">Healthy</Badge>),
    },
  ];

  return (
    <PageLayout className="animate-fade-up">
      <PageHeader
        title="Stock on Hand"
        subtitle={`${rows.length} items · ${formatKes(totalValue)} total value${lowStockCount > 0 ? ` · ${lowStockCount} low stock` : ''}`}
        action={
          <HelpTip title="Stock on Hand">
            <p>The Central Store&rsquo;s live inventory — what you have, what it&rsquo;s worth, and whether it&rsquo;s running low.</p>
            <p className="mt-2">
              Quantities show in buy units (e.g. pouches, kg) for readability. Click an item name to see its full
              movement history — every receive, prep use, waste, and adjustment that changed its balance.
            </p>
          </HelpTip>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Items" value={rows.length} />
        <StatCard label="Total Value" value={formatKes(totalValue)} />
        <StatCard label="Low Stock" value={lowStockCount} valueClassName={lowStockCount > 0 ? 'text-warning' : undefined} />
        <StatCard
          label="Avg. Value / Item"
          value={rows.length > 0 ? formatKes(totalValue / rows.length) : formatKes(0)}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
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
            <span className="mx-1 h-5 w-px bg-stone-200" />
            <div className="w-44">
              <Select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value as DepartmentFilter)}
                options={[{ value: 'ALL', label: 'All Departments' }, ...DEPARTMENT_TAGS.map((t) => ({ value: t, label: departmentLabel[t] }))]}
              />
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className="pl-9" />
          </div>
        </div>

        <ExcelTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.item.id}
          isLoading={isLoading}
          headerTone="navy"
          totalsRow={{ name: 'Total', value: formatKes(totalValue) }}
          emptyState={
            <div className="px-4 py-10 text-center text-body-sm text-stone-500">
              {items.length === 0 ? 'No items in the catalog yet.' : 'No items match your search or filter.'}
            </div>
          }
        />
      </Card>

      {selectedItem && (
        <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(28,25,23,0.4)]" onClick={() => setSelectedItem(null)}>
          <div
            className="flex h-full w-full max-w-md flex-col bg-white shadow-xl animate-fade-up motion-reduce:animate-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <IconTile icon={resolveItemIcon(selectedItem.name, selectedItem.type)} />
                <div>
                  <p className="text-heading-sm font-semibold text-stone-900">{selectedItem.name}</p>
                  <p className="text-label-sm text-stone-500">{itemTypeLabel[selectedItem.type]} · Movement History</p>
                </div>
              </div>
              <IconButton icon={<X size={18} />} label="Close" variant="ghost" size="sm" onClick={() => setSelectedItem(null)} />
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {isLoadingTransactions ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-md bg-stone-100" />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <p className="py-10 text-center text-body-sm text-stone-500">No ledger activity for this item yet.</p>
              ) : (
                <ul className="space-y-2">
                  {transactions.map((tx) => {
                    const qty = parseFloat(tx.quantity);
                    const isPositive = qty > 0;
                    return (
                      <li key={tx.id} className="flex items-center justify-between gap-3 rounded-md border border-stone-100 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-body-sm font-medium text-stone-800">{TRANSACTION_LABELS[tx.type]}</p>
                          <p className="text-label-sm text-stone-400">
                            {new Date(tx.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={cn('text-label-lg font-semibold tabular-nums', isPositive ? 'text-success' : 'text-danger')}>
                            {isPositive ? '+' : ''}{formatQty(tx.quantity)} {selectedItem.usageUnit}
                          </p>
                          <p className="text-label-sm text-stone-400">{formatKes(tx.unitCost)}/{selectedItem.usageUnit}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
