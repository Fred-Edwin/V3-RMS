'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ExcelTable,
  FormField,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  type ExcelColumn,
} from '@/components/ui';
import {
  approveStockCount,
  createStockCount,
  getCentralStoreLocation,
  getStockCount,
  listInventoryItems,
  listStockCounts,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { cn } from '@/lib/cn';
import type { InventoryItem, StockCount, StockCountStatus } from '@/types/inventory';

const STATUS_TONE: Record<StockCountStatus, 'warning' | 'neutral' | 'success'> = {
  IN_PROGRESS: 'warning',
  SUBMITTED: 'neutral',
  APPROVED: 'success',
};

const STATUS_LABEL: Record<StockCountStatus, string> = {
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });

const formatKes = (value: number): string =>
  `Ksh ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;

interface SessionRow extends Record<string, unknown> {
  count: StockCount;
}

interface VarianceRow extends Record<string, unknown> {
  lineId: string;
  itemName: string;
  usageUnit: string;
  expected: number;
  counted: number | null;
  gap: number;
  gapValue: number;
}

// app/app/layout.tsx mounts {children} twice for STORE_MANAGER (dual desktop
// sidebar + CSS-hidden mobile shell) — no mobile variant of this screen
// exists yet (Session 8), so the mobile-shell copy renders nothing rather
// than duplicating data-fetching and DOM element ids.
export function StockCountsDesktop(): JSX.Element | null {
  const isDesktop = useIsDesktopShell();
  if (!isDesktop) return null;
  return <StockCountsDesktopInner />;
}

function StockCountsDesktopInner(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [counts, setCounts] = useState<StockCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<StockCount | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

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

  const rows = useMemo<SessionRow[]>(
    () => [...counts].sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()).map((count) => ({ count })),
    [counts],
  );

  const openCreateModal = async () => {
    setLabel('');
    setScheduledDate(new Date().toISOString().slice(0, 10));
    setSelectedItemIds(new Set());
    setIsCreateOpen(true);
    if (!accessToken) return;
    try {
      const [location, itemList] = await Promise.all([
        getCentralStoreLocation(accessToken),
        listInventoryItems(accessToken, { isActive: true }),
      ]);
      setLocationId(location?.id ?? null);
      setItems(itemList);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load catalog', message: error instanceof Error ? error.message : 'Please try again.' });
    }
  };

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedItemIds((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  };

  const handleCreate = async () => {
    if (!accessToken || !locationId) return;
    if (!label.trim()) {
      toast({ variant: 'error', title: 'Label required', message: 'Give this count session a name.' });
      return;
    }
    if (selectedItemIds.size === 0) {
      toast({ variant: 'error', title: 'Select items', message: 'Choose at least one item to count.' });
      return;
    }
    setIsCreating(true);
    try {
      await createStockCount(
        {
          locationId,
          label: label.trim(),
          scheduledDate: new Date(scheduledDate).toISOString(),
          inventoryItemIds: Array.from(selectedItemIds),
        },
        accessToken,
      );
      toast({ variant: 'success', title: 'Count session created', message: `${label.trim()} was created with ${selectedItemIds.size} items.` });
      setIsCreateOpen(false);
      void load();
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to create session', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsCreating(false);
    }
  };

  const openDetail = async (count: StockCount) => {
    if (!accessToken) return;
    try {
      const fresh = await getStockCount(count.id, accessToken);
      setSelected(fresh);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load session', message: error instanceof Error ? error.message : 'Please try again.' });
    }
  };

  const handleApprove = async () => {
    if (!accessToken || !selected) return;
    setIsApproving(true);
    try {
      const updated = await approveStockCount(selected.id, accessToken);
      setSelected(updated);
      toast({ variant: 'success', title: 'Count approved', message: `${updated.label} was approved and adjustments were posted.` });
      void load();
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to approve', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsApproving(false);
      setIsApproveOpen(false);
    }
  };

  const varianceRows = useMemo<VarianceRow[]>(() => {
    if (!selected) return [];
    return selected.lines.map((line) => {
      const expected = parseFloat(line.expectedQty ?? '0');
      const counted = line.countedQty !== null ? parseFloat(line.countedQty) : null;
      const gap = counted !== null ? counted - expected : 0;
      return {
        lineId: line.id,
        itemName: line.inventoryItem.name,
        usageUnit: line.inventoryItem.usageUnit,
        expected,
        counted,
        gap,
        gapValue: gap,
      };
    });
  }, [selected]);

  const columns: ExcelColumn<SessionRow>[] = [
    {
      key: 'label',
      label: 'Session',
      render: (row) => (
        <button type="button" onClick={() => openDetail(row.count)} className="font-medium text-office-ink hover:underline">
          {row.count.label}
        </button>
      ),
    },
    { key: 'scheduledDate', label: 'Scheduled', render: (row) => formatDate(row.count.scheduledDate) },
    { key: 'lines', label: 'Items', numeric: true, render: (row) => row.count.lines.length },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={STATUS_TONE[row.count.status]}>{STATUS_LABEL[row.count.status]}</Badge> },
  ];

  const varianceColumns: ExcelColumn<VarianceRow>[] = [
    { key: 'itemName', label: 'Item' },
    { key: 'expected', label: 'Expected', numeric: true, render: (row) => `${row.expected.toFixed(2)} ${row.usageUnit}` },
    { key: 'counted', label: 'Counted', numeric: true, render: (row) => (row.counted !== null ? `${row.counted.toFixed(2)} ${row.usageUnit}` : '—') },
    {
      key: 'gap',
      label: 'Gap',
      numeric: true,
      render: (row) =>
        row.counted === null ? (
          '—'
        ) : (
          <span className={cn('font-semibold', row.gap === 0 ? 'text-stone-500' : row.gap < 0 ? 'text-danger' : 'text-success')}>
            {row.gap > 0 ? '+' : ''}{row.gap.toFixed(2)} {row.usageUnit}
          </span>
        ),
    },
  ];

  const totalGapValue = varianceRows.reduce((sum, r) => sum + r.gapValue, 0);

  return (
    <PageLayout className="animate-fade-up">
      <PageHeader
        title="Stock Count"
        subtitle={`${counts.length} sessions`}
        action={<Button leftIcon={<Plus size={18} />} onClick={openCreateModal}>New Count Session</Button>}
      />

      <Card className="overflow-hidden">
        <ExcelTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.count.id}
          isLoading={isLoading}
          headerTone="navy"
          emptyState={<div className="px-4 py-10 text-center text-body-sm text-stone-500">No count sessions yet — create one to get started.</div>}
        />
      </Card>

      {/* Detail / approval panel */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(28,25,23,0.4)]" onClick={() => setSelected(null)}>
          <div
            className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl animate-fade-up motion-reduce:animate-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-4">
              <div>
                <h2 className="text-heading-md font-semibold text-stone-900">{selected.label}</h2>
                <p className="text-label-md text-stone-500">{formatDate(selected.scheduledDate)} · {selected.lines.length} items</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={STATUS_TONE[selected.status]}>{STATUS_LABEL[selected.status]}</Badge>
                <IconButton icon={<X size={18} />} label="Close" variant="ghost" size="sm" onClick={() => setSelected(null)} />
              </div>
            </div>

            {selected.status === 'SUBMITTED' && (
              <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-6 py-3">
                <p className="text-body-sm text-stone-600">
                  Net variance value: <span className={cn('font-semibold', totalGapValue < 0 ? 'text-danger' : 'text-success')}>{formatKes(totalGapValue)}</span>
                </p>
                <Button leftIcon={<CheckCircle2 size={16} />} onClick={() => setIsApproveOpen(true)}>Approve & Post Adjustments</Button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6">
              {selected.status === 'IN_PROGRESS' ? (
                <p className="py-10 text-center text-body-sm text-stone-500">This session hasn&apos;t been submitted yet — waiting on the count to be completed.</p>
              ) : (
                <ExcelTable columns={varianceColumns} rows={varianceRows} rowKey={(row) => row.lineId} headerTone="navy" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create session modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New Count Session"
        maxWidth="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} isLoading={isCreating}>Create Session</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Label" htmlFor="count-label" required>
              <Input id="count-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Weekly Count — Week 31" />
            </FormField>
            <FormField label="Scheduled Date" htmlFor="count-date" required>
              <Input id="count-date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </FormField>
          </div>

          <FormField label={`Items (${selectedItemIds.size} selected)`} htmlFor="count-items">
            <div className="rounded-md border border-stone-200">
              <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
                <span className="text-label-sm text-stone-500">{items.length} items in catalog</span>
                <button type="button" onClick={toggleAll} className="text-label-sm font-medium text-espresso hover:underline">
                  {selectedItemIds.size === items.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-stone-100">
                {items.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="size-4 rounded border-stone-300 text-espresso focus:ring-amber"
                    />
                    <span className="text-body-sm text-stone-800">{item.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        onConfirm={handleApprove}
        title="Approve this count?"
        description="Approving posts adjustment transactions to the ledger for every line's gap. This cannot be undone."
        confirmLabel="Approve & Post"
        isLoading={isApproving}
      />
    </PageLayout>
  );
}
