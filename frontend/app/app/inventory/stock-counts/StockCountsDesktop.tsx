'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Pencil, Search, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  ExcelTable,
  HelpTip,
  IconButton,
  Input,
  PageHeader,
  PageLayout,
  Select,
  StatCard,
  type ExcelColumn,
  type SelectOption,
} from '@/components/ui';
import { QuantityInput } from '@/components/inventory/QuantityInput';
import {
  approveStockCount,
  correctStockCountLines,
  createStockCount,
  getCentralStoreLocation,
  getStockCount,
  listInventoryItems,
  listStockCounts,
  submitStockCount,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { cn } from '@/lib/cn';
import { buyUnitLabel, formatBuyUnitQuantity, formatKes, toUsageUnitQuantity } from '@/lib/inventory-format';
import type { DepartmentTag, InventoryItem, StockCount, StockCountStatus } from '@/types/inventory';

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

const STATUS_FILTERS: SelectOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
];

const DEPARTMENT_TAGS: DepartmentTag[] = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];

const departmentLabel: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

const SCOPE_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'Full catalog' },
  ...DEPARTMENT_TAGS.map((tag) => ({ value: tag, label: `${departmentLabel[tag]} department` })),
];

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });

const MINI_STAT_TONE = {
  default: 'text-stone-900',
  danger: 'text-danger',
  success: 'text-success',
} as const;

// Compact stat tile for the variance slide-over panel — StatCard (used on
// the page-level stat row above) is deliberately large for a full-width
// summary strip; this panel is a narrower, denser context where four
// full-size StatCards read as oversized. Kept local rather than added as a
// StatCard prop/variant since nothing else in the app needs this size yet.
function MiniStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: keyof typeof MINI_STAT_TONE;
}): JSX.Element {
  return (
    <div className="rounded-md border border-stone-200 bg-white px-2.5 py-2">
      <p className="truncate text-caption font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <p className={cn('mt-0.5 truncate text-body-md font-semibold tabular-nums', MINI_STAT_TONE[tone])}>{value}</p>
    </div>
  );
}

interface SessionRow extends Record<string, unknown> {
  count: StockCount;
}

interface VarianceRow extends Record<string, unknown> {
  lineId: string;
  itemName: string;
  usageUnit: string;
  conversionFactor: string;
  buyUnit: string;
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
  const [statusFilter, setStatusFilter] = useState<StockCountStatus | ''>('');
  const [search, setSearch] = useState('');

  const [isCounting, setIsCounting] = useState(false);

  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  const filteredCounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return counts.filter((count) => {
      if (statusFilter && count.status !== statusFilter) return false;
      if (term && !count.label.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [counts, statusFilter, search]);

  const rows = useMemo<SessionRow[]>(
    () => [...filteredCounts].sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()).map((count) => ({ count })),
    [filteredCounts],
  );

  const inProgressCount = counts.filter((c) => c.status === 'IN_PROGRESS').length;
  const awaitingApprovalCount = counts.filter((c) => c.status === 'SUBMITTED').length;
  const lastApproved = counts
    .filter((c) => c.status === 'APPROVED' && c.approvedAt)
    .sort((a, b) => new Date(b.approvedAt!).getTime() - new Date(a.approvedAt!).getTime())[0];

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

  const startEditLine = (lineId: string, currentValue: number | null, item: { conversionFactor: string; buyUnit: string; usageUnit: string }) => {
    setEditingLineId(lineId);
    if (currentValue === null) {
      setEditValue('');
      return;
    }
    const factor = parseFloat(item.conversionFactor);
    const buyQty = !Number.isFinite(factor) || factor <= 0 || item.buyUnit === item.usageUnit ? currentValue : currentValue / factor;
    setEditValue(buyQty.toFixed(2));
  };

  const cancelEditLine = () => {
    setEditingLineId(null);
    setEditValue('');
  };

  const saveEditLine = async (lineId: string) => {
    if (!accessToken || !selected) return;
    if (editValue.trim() === '') {
      toast({ variant: 'error', title: 'Enter a quantity', message: 'The counted quantity cannot be blank.' });
      return;
    }
    const line = selected.lines.find((l) => l.id === lineId);
    if (!line) return;
    const usageQty = toUsageUnitQuantity(editValue, line.inventoryItem);
    setIsSavingEdit(true);
    try {
      const updated = await correctStockCountLines(selected.id, { lines: [{ lineId, countedQty: String(usageQty) }] }, accessToken);
      setSelected(updated);
      setEditingLineId(null);
      setEditValue('');
      void load();
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to update count', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSavingEdit(false);
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
        conversionFactor: line.inventoryItem.conversionFactor,
        buyUnit: line.inventoryItem.buyUnit,
        expected,
        counted,
        gap,
        gapValue: gap,
      };
    });
  }, [selected]);

  const countedLineCount = varianceRows.filter((r) => r.counted !== null).length;
  const shortLineCount = varianceRows.filter((r) => r.gap < 0).length;
  const overLineCount = varianceRows.filter((r) => r.gap > 0).length;

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
    {
      key: 'counted',
      label: 'Counted',
      numeric: true,
      render: (row) => {
        const counted = row.count.lines.filter((l) => l.countedQty !== null).length;
        return `${counted} / ${row.count.lines.length}`;
      },
    },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={STATUS_TONE[row.count.status]}>{STATUS_LABEL[row.count.status]}</Badge> },
  ];

  const canEditCounts = selected?.status === 'SUBMITTED';

  const totalGapValue = varianceRows.reduce((sum, r) => sum + r.gapValue, 0);

  return (
    <PageLayout className="animate-fade-up">
      <PageHeader
        title="Stock Count"
        subtitle={`${counts.length} sessions`}
        action={
          <div className="flex items-center gap-2">
            <HelpTip title="Stock Count">
              <p>Physically count what&rsquo;s on the shelf and compare it to what the system expects, to catch loss or errors.</p>
              <p className="mt-2">
                Start a new session, pick which items to count, then count on your phone or here. Once submitted,
                review the variance and approve to post stock adjustments — Attendants never see the expected
                quantity while counting, so the count stays honest.
              </p>
            </HelpTip>
            <Button onClick={() => setIsCounting(true)}>New Count Session</Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="In Progress" value={inProgressCount} />
        <StatCard label="Awaiting Approval" value={awaitingApprovalCount} />
        <StatCard label="Last Approved" value={lastApproved ? formatDate(lastApproved.approvedAt!) : '—'} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-56">
            <Select
              options={STATUS_FILTERS}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StockCountStatus | '')}
            />
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by session label…" className="pl-9" />
          </div>
        </div>

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

            {selected.status === 'IN_PROGRESS' ? (
              <div className="flex-1 overflow-y-auto p-6">
                <p className="py-10 text-center text-body-sm text-stone-500">This session hasn&apos;t been submitted yet — waiting on the count to be completed.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 border-b border-stone-100 px-6 py-3">
                  <MiniStat label="Counted" value={`${countedLineCount}/${varianceRows.length}`} />
                  <MiniStat
                    label="Net Variance"
                    value={formatKes(totalGapValue)}
                    tone={totalGapValue < 0 ? 'danger' : totalGapValue > 0 ? 'success' : 'default'}
                  />
                  <MiniStat label="Short" value={shortLineCount} tone={shortLineCount > 0 ? 'danger' : 'default'} />
                  <MiniStat label="Over" value={overLineCount} tone={overLineCount > 0 ? 'success' : 'default'} />
                </div>

                {selected.status === 'SUBMITTED' && (
                  <div className="flex items-center justify-end border-b border-stone-100 px-6 py-3">
                    <Button leftIcon={<CheckCircle2 size={16} />} onClick={() => setIsApproveOpen(true)}>Approve & Post Adjustments</Button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-2">
                    {varianceRows.map((row) => {
                      const isEditing = editingLineId === row.lineId;
                      return (
                        <div key={row.lineId} className="rounded-md border border-stone-200 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 truncate text-body-sm font-semibold text-stone-900">{row.itemName}</p>
                            {!isEditing && row.counted !== null && (
                              <span className={cn('shrink-0 text-label-lg font-semibold tabular-nums', row.gap === 0 ? 'text-stone-500' : row.gap < 0 ? 'text-danger' : 'text-success')}>
                                {row.gap > 0 ? '+' : ''}{row.gap.toFixed(2)} {row.usageUnit}
                              </span>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="mt-2 flex items-center gap-2">
                              <QuantityInput value={editValue} onValueChange={setEditValue} unit={buyUnitLabel(row)} autoFocus className="flex-1" />
                              <button type="button" onClick={() => void saveEditLine(row.lineId)} disabled={isSavingEdit} className="shrink-0 text-label-sm font-semibold text-espresso disabled:opacity-50">
                                Save
                              </button>
                              <button type="button" onClick={cancelEditLine} disabled={isSavingEdit} className="shrink-0 text-label-sm text-stone-400">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="mt-1 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 text-label-sm text-stone-500">
                                <span>Expected: {formatBuyUnitQuantity(row.expected, row)}</span>
                                <span>Counted: {row.counted !== null ? formatBuyUnitQuantity(row.counted, row) : '—'}</span>
                              </div>
                              {canEditCounts && (
                                <button
                                  type="button"
                                  onClick={() => startEditLine(row.lineId, row.counted, row)}
                                  className="shrink-0 text-stone-400 hover:text-espresso"
                                  aria-label={`Correct counted quantity for ${row.itemName}`}
                                >
                                  <Pencil size={13} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Merged create+count+review flow — replaces a separate create-panel
          form + navigate-to-find-it-in-the-list + open-to-start-counting
          chain (revised 2026-07-30). */}
      {isCounting && (
        <NewCountFlowPanel
          onClose={() => setIsCounting(false)}
          onDone={() => {
            setIsCounting(false);
            void load();
          }}
        />
      )}

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

const defaultLabel = (): string =>
  `Count — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' })}, ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' })}`;

type FlowStep = 'scope' | 'entry' | 'review';

// Merged create+count+review flow (revised 2026-07-30) — same interaction
// model as the mobile version in page.tsx: picking a scope immediately
// includes every item in it as a countable row, no separate per-item
// checklist. Desktop gets the identical flow (not just create-then-handoff)
// since a Manager may want to verify a handful of items without switching to
// a phone. Laid out as a stacked list rather than mobile's card list, closer
// to the ExcelTable idiom used elsewhere on this page.
function NewCountFlowPanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const { toast } = useToast();

  const [step, setStep] = useState<FlowStep>('scope');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);

  const [label, setLabel] = useState(defaultLabel());
  const [isEditingLabel, setIsEditingLabel] = useState(false);

  const [count, setCount] = useState<StockCount | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [itemSearch, setItemSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showExpectedQty = role === 'STORE_MANAGER';
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      setIsLoadingCatalog(true);
      try {
        const [location, itemList] = await Promise.all([
          getCentralStoreLocation(accessToken),
          listInventoryItems(accessToken, { isActive: true }),
        ]);
        if (cancelled) return;
        setLocationId(location?.id ?? null);
        setItems(itemList);
      } catch (error) {
        if (!cancelled) {
          toast({ variant: 'error', title: 'Failed to load catalog', message: error instanceof Error ? error.message : 'Please try again.' });
        }
      } finally {
        if (!cancelled) setIsLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, toast]);

  const startCount = async (scope: 'ALL' | DepartmentTag) => {
    if (!accessToken || !locationId) return;
    const scopedItems = scope === 'ALL' ? items : items.filter((item) => item.departmentTags.includes(scope));
    if (scopedItems.length === 0) {
      toast({ variant: 'error', title: 'No items in scope', message: 'That department has no active items to count.' });
      return;
    }
    setIsStarting(true);
    try {
      const created = await createStockCount(
        {
          locationId,
          label: label.trim() || defaultLabel(),
          scheduledDate: new Date().toISOString(),
          inventoryItemIds: scopedItems.map((i) => i.id),
        },
        accessToken,
      );
      setCount(created);
      setStep('entry');
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to start count', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsStarting(false);
    }
  };

  const sortedLines = useMemo(() => (count ? [...count.lines].sort((a, b) => a.sequence - b.sequence) : []), [count]);

  const filteredLines = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    if (!term) return sortedLines;
    return sortedLines.filter((line) => line.inventoryItem.name.toLowerCase().includes(term));
  }, [sortedLines, itemSearch]);

  const countedCount = useMemo(
    () => sortedLines.filter((l) => counted[l.id] !== undefined && counted[l.id] !== '').length,
    [sortedLines, counted],
  );

  const updateCounted = (lineId: string, value: string) => {
    setCounted((prev) => ({ ...prev, [lineId]: value }));
  };

  const handleSubmit = async () => {
    if (!accessToken || !count) return;
    const lines = sortedLines
      .filter((l) => counted[l.id] !== undefined && counted[l.id] !== '')
      .map((l) => ({ lineId: l.id, countedQty: String(toUsageUnitQuantity(counted[l.id], l.inventoryItem)) }));
    if (lines.length === 0) {
      toast({ variant: 'error', title: 'Nothing counted', message: 'Enter at least one quantity before submitting.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await submitStockCount(count.id, { lines }, accessToken);
      toast({
        variant: 'success',
        title: 'Count submitted',
        message: showExpectedQty ? 'Review the variance and approve when ready.' : 'Your manager will review and approve it.',
      });
      onDone();
    } catch (error) {
      toast({ variant: 'error', title: 'Could not submit count', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const closePanel = () => {
    if (isStarting || isSubmitting) return;
    onClose();
  };

  const countedLines = sortedLines.filter((l) => counted[l.id] !== undefined && counted[l.id] !== '');
  const skippedLines = sortedLines.filter((l) => counted[l.id] === undefined || counted[l.id] === '');

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(28,25,23,0.4)]" onClick={closePanel}>
      <div
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl animate-fade-up motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-4">
          <div className="min-w-0">
            {step === 'scope' ? (
              <>
                <h2 className="text-heading-md font-semibold text-stone-900">New Count</h2>
                {isEditingLabel ? (
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onBlur={() => setIsEditingLabel(false)}
                    autoFocus
                    className="mt-1 h-8 text-body-sm"
                  />
                ) : (
                  <button type="button" onClick={() => setIsEditingLabel(true)} className="mt-1 flex items-center gap-1.5 text-label-md text-stone-500">
                    {label} <Pencil size={12} />
                  </button>
                )}
              </>
            ) : (
              <>
                <h2 className="truncate text-heading-md font-semibold text-stone-900">{label}</h2>
                <p className="text-label-md text-stone-500">
                  {step === 'entry' ? `${countedCount} of ${sortedLines.length} counted` : `${countedLines.length} counted${skippedLines.length > 0 ? ` · ${skippedLines.length} skipped` : ''}`}
                </p>
              </>
            )}
          </div>
          <IconButton icon={<X size={18} />} label="Close" variant="ghost" size="sm" onClick={closePanel} />
        </div>

        {step === 'scope' && (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <p className="mb-3 text-label-sm font-semibold uppercase tracking-wide text-stone-400">What are you counting?</p>
            {isLoadingCatalog ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-md bg-stone-100" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {SCOPE_OPTIONS.map((option) => {
                  const scopeValue = option.value as 'ALL' | DepartmentTag;
                  const itemCount = scopeValue === 'ALL' ? items.length : items.filter((i) => i.departmentTags.includes(scopeValue)).length;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isStarting}
                      onClick={() => void startCount(scopeValue)}
                      className="flex w-full items-center justify-between rounded-md border border-stone-200 bg-white px-4 py-3.5 text-left hover:bg-stone-50 disabled:opacity-50"
                    >
                      <span className="text-body-md font-semibold text-stone-900">{option.label}</span>
                      <span className="text-label-sm text-stone-400">{itemCount} items</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 'entry' && (
          <>
            <div className="border-b border-stone-100 px-6 py-3">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <Input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Jump to an item…" className="h-9 pl-8 text-body-sm" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-2">
                {filteredLines.map((line) => {
                  const value = counted[line.id] ?? '';
                  const isDone = value !== '';
                  return (
                    <div
                      key={line.id}
                      className={cn(
                        'flex items-center gap-3 rounded-md border p-2.5',
                        isDone ? 'border-success-border bg-success-bg' : 'border-stone-200 bg-white',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-label-sm font-bold',
                          isDone ? 'bg-success text-white' : 'bg-stone-100 text-stone-500',
                        )}
                      >
                        {isDone ? <Check size={14} /> : line.sequence}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-semibold text-stone-900">{line.inventoryItem.name}</p>
                        <p className="text-label-sm text-stone-500">
                          {showExpectedQty && line.expectedQty !== undefined
                            ? `Expected ${formatBuyUnitQuantity(line.expectedQty, line.inventoryItem)}`
                            : buyUnitLabel(line.inventoryItem)}
                        </p>
                      </div>
                      <QuantityInput
                        ref={(el) => {
                          inputRefs.current[line.id] = el;
                        }}
                        value={value}
                        onValueChange={(v) => updateCounted(line.id, v)}
                        unit={buyUnitLabel(line.inventoryItem)}
                        placeholder="Enter amount"
                        className="w-32"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-stone-100 px-6 py-4">
              <Button variant="secondary" onClick={closePanel}>Cancel</Button>
              <Button onClick={() => setStep('review')} disabled={countedCount === 0}>Review & Submit</Button>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-2">
                {countedLines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-white p-3">
                    <p className="min-w-0 truncate text-body-sm font-semibold text-stone-900">{line.inventoryItem.name}</p>
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 text-body-md font-semibold tabular-nums text-stone-900">
                        {counted[line.id]} {buyUnitLabel(line.inventoryItem)}
                      </span>
                      <button type="button" onClick={() => setStep('entry')} className="shrink-0 text-label-sm font-medium text-espresso hover:underline">
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {skippedLines.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-stone-400">Skipped</p>
                  <div className="space-y-2">
                    {skippedLines.map((line) => (
                      <button
                        key={line.id}
                        type="button"
                        onClick={() => setStep('entry')}
                        className="flex w-full items-center justify-between rounded-md border border-dashed border-stone-300 bg-white p-3 text-left"
                      >
                        <p className="min-w-0 truncate text-body-sm text-stone-500">{line.inventoryItem.name}</p>
                        <span className="shrink-0 text-label-sm font-medium text-espresso">Count it</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-stone-100 px-6 py-4">
              <Button variant="secondary" onClick={() => setStep('entry')}>Back to counting</Button>
              <Button onClick={() => void handleSubmit()} isLoading={isSubmitting}>Submit Count</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
