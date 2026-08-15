'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Banknote, Plus, Printer, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ExcelTable,
  Input,
  PageHeader,
  PageLayout,
  Select,
  type ExcelColumn,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { otherIncomeService } from '@/services/otherIncomeService';
import { printService } from '@/services/printService';
import { useAuthStore } from '@/store/authStore';
import { getTodayYmdInTimeZone } from '@/lib/date';
import { ApiError } from '@/types/api';
import type { OtherIncomeCategoryDropdownItem, OtherIncomeEntry } from '@/types/otherIncome';

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  CARD: 'Card',
  SPLIT: 'Split',
};

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return 'KES 0.00';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (ymd: string): string => {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** For SPLIT entries, render the cash/mpesa/card breakdown instead of the bare enum. */
const formatPaymentCell = (entry: OtherIncomeEntry): string => {
  if (entry.paymentMethod !== 'SPLIT') {
    return PAYMENT_LABELS[entry.paymentMethod] ?? entry.paymentMethod;
  }
  const parts: string[] = [];
  if (entry.mpesaAmount) parts.push(`M-Pesa ${formatCurrency(entry.mpesaAmount)}`);
  if (entry.cashAmount) parts.push(`Cash ${formatCurrency(entry.cashAmount)}`);
  if (entry.cardAmount) parts.push(`Card ${formatCurrency(entry.cardAmount)}`);
  return parts.length > 0 ? parts.join(' + ') : 'Split';
};

type EntryRow = Record<string, unknown> & OtherIncomeEntry;

const CAN_SEE_ALL = new Set(['DIRECTOR', 'SYSTEM_ADMIN', 'MANAGER', 'ACCOUNTANT']);
const CAN_FILTER_BY_BRANCH = new Set(['DIRECTOR', 'SYSTEM_ADMIN', 'ACCOUNTANT']);

export default function OtherIncomeHistoryPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const userId = useAuthStore((state) => state.user?.id);

  const todayYmd = getTodayYmdInTimeZone();
  const isFullViewer = role ? CAN_SEE_ALL.has(role) : false;
  const canFilterByBranch = role ? CAN_FILTER_BY_BRANCH.has(role) : false;

  const [entries, setEntries] = useState<OtherIncomeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(todayYmd);
  const [endDate, setEndDate] = useState(todayYmd);

  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  const [categories, setCategories] = useState<OtherIncomeCategoryDropdownItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const [deleteTarget, setDeleteTarget] = useState<EntryRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPrinting, setIsPrinting] = useState<string | null>(null); // entryId being printed

  useEffect(() => {
    if (!accessToken || !canFilterByBranch) return;
    branchService
      .listBranches(accessToken)
      .then((data) => setBranches(data.filter((b) => b.isActive && !b.isHub)))
      .catch(() => {
        toast({ variant: 'error', title: 'Failed to load branches', message: 'Could not fetch branch list.' });
      });
  // accessToken is stable; toast is stable via useCallback in hook
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, canFilterByBranch]);

  useEffect(() => {
    if (!accessToken || !isFullViewer) return;
    otherIncomeService
      .listActiveCategories(accessToken, canFilterByBranch ? selectedBranchId || undefined : undefined)
      .then(setCategories)
      .catch(() => {
        toast({ variant: 'error', title: 'Failed to load categories' });
      });
  // accessToken/toast stable; re-fetch only when the branch scope changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, isFullViewer, canFilterByBranch, selectedBranchId]);

  const loadEntries = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const params = isFullViewer
        ? {
            startDate,
            endDate,
            perPage: 100,
            ...(canFilterByBranch && selectedBranchId ? { branchId: selectedBranchId } : {}),
            ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}),
          }
        : { startDate: todayYmd, endDate: todayYmd, perPage: 50 };
      const { entries: data } = await otherIncomeService.listEntries(params, accessToken);
      setEntries(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not load entries';
      toast({ variant: 'error', title: message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isFullViewer, startDate, endDate, todayYmd, canFilterByBranch, selectedBranchId, selectedCategoryId, toast]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleDelete = async (): Promise<void> => {
    if (!accessToken || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await otherIncomeService.deleteEntry(deleteTarget.id, accessToken);
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      toast({ variant: 'success', title: 'Entry deleted' });
      setDeleteTarget(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not delete entry';
      toast({ variant: 'error', title: message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrintReceipt = async (entryId: string): Promise<void> => {
    if (!accessToken || isPrinting) return;
    setIsPrinting(entryId);
    try {
      await printService.createOtherIncomePrintJob(entryId, accessToken);
      toast({ variant: 'success', title: 'Receipt sent to printer' });
    } catch (error) {
      const message =
        error instanceof ApiError && error.statusCode === 404
          ? 'No printer configured for this branch'
          : error instanceof ApiError
            ? error.message
            : 'Unable to send to printer';
      toast({ variant: 'error', title: 'Print failed', message });
    } finally {
      setIsPrinting(null);
    }
  };

  const canDelete = (entry: OtherIncomeEntry): boolean => {
    if (!role) return false;
    const entryYmd = entry.entryDate.slice(0, 10);
    const isToday = entryYmd === todayYmd;
    if (role === 'WAITER') return entry.recordedById === userId && isToday;
    if (role === 'MANAGER') return isToday;
    return role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
  };

  const totalValue = entries.reduce((sum, e) => sum + Number.parseFloat(e.amount), 0);

  // Category and payment-method breakdown for the currently-loaded range — helps
  // accountants reconcile against category ledgers and M-Pesa/bank statements.
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      map.set(e.category.name, (map.get(e.category.name) ?? 0) + Number.parseFloat(e.amount));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const paymentBreakdown = useMemo(() => {
    const totals = { CASH: 0, MPESA: 0, CARD: 0 };
    for (const e of entries) {
      if (e.paymentMethod === 'SPLIT') {
        totals.MPESA += Number.parseFloat(e.mpesaAmount ?? '0');
        totals.CASH += Number.parseFloat(e.cashAmount ?? '0');
        totals.CARD += Number.parseFloat(e.cardAmount ?? '0');
      } else if (e.paymentMethod in totals) {
        totals[e.paymentMethod as 'CASH' | 'MPESA' | 'CARD'] += Number.parseFloat(e.amount);
      }
    }
    return totals;
  }, [entries]);

  const columns: ExcelColumn<EntryRow>[] = [
    {
      key: 'category',
      label: 'Category',
      render: (row) => <span className="font-medium text-office-ink">{row.category.name}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      numeric: true,
      render: (row) => <span className="font-semibold">{formatCurrency(row.amount)}</span>,
    },
    {
      key: 'paymentMethod',
      label: 'Payment',
      render: (row) => formatPaymentCell(row),
    },
    {
      key: 'entryDate',
      label: 'Date',
      render: (row) => formatDate(row.entryDate.slice(0, 10)),
    },
    ...(canFilterByBranch && !selectedBranchId
      ? [{
          key: 'branch',
          label: 'Branch',
          render: (row: EntryRow) => row.branch.name,
        } satisfies ExcelColumn<EntryRow>]
      : []),
    ...(isFullViewer
      ? [{
          key: 'recordedBy',
          label: 'Recorded By',
          render: (row: EntryRow) => row.recordedBy.name,
        } satisfies ExcelColumn<EntryRow>]
      : []),
    {
      key: 'description',
      label: 'Notes',
      render: (row) => <span className="italic text-stone-500">{row.description ?? '—'}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void handlePrintReceipt(row.id)}
            disabled={isPrinting === row.id}
            className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-40"
            aria-label="Print receipt"
          >
            <Printer size={16} />
          </button>
          {canDelete(row) && (
            <button
              type="button"
              onClick={() => setDeleteTarget(row)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:shadow-focus"
              aria-label="Delete entry"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageLayout>
      <PageHeader
        title="Other Income"
        subtitle={isFullViewer ? 'All non-food revenue entries' : "Today's entries you recorded"}
        action={
          <Link href="/app/other-income/new">
            <Button size="sm">
              <Plus size={16} className="mr-1.5" />
              Record Income
            </Button>
          </Link>
        }
      />

      {/* Date + branch filter — managers and above only */}
      {isFullViewer && (
        <div className="mb-5 flex flex-wrap items-end gap-3">
          {canFilterByBranch && (
            <div className="flex flex-col gap-1">
              <label className="text-label-sm font-medium uppercase tracking-wide text-stone-500">
                Branch
              </label>
              <Select
                options={[{ value: '', label: 'All Branches' }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-44"
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-label-sm font-medium uppercase tracking-wide text-stone-500">
              Category
            </label>
            <Select
              options={[{ value: '', label: 'All Categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-label-sm font-medium uppercase tracking-wide text-stone-500">
              From
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-label-sm font-medium uppercase tracking-wide text-stone-500">
              To
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={() => void loadEntries()}>
            Apply
          </Button>
        </div>
      )}

      {/* Summary strip */}
      {entries.length > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-sm">
          <Banknote size={18} className="shrink-0 text-stone-400" />
          <span className="text-body-sm text-stone-600">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} ·{' '}
            <span className="font-semibold text-[#2C1810]">
              {formatCurrency(totalValue)} total
            </span>
          </span>
        </div>
      )}

      {/* Category + payment-method breakdown — reconciliation aid, full viewers only */}
      {isFullViewer && entries.length > 0 && (
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
            <p className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-stone-500">
              By Category
            </p>
            <div className="space-y-1.5">
              {categoryBreakdown.map(([name, amount]) => (
                <div key={name} className="flex items-center justify-between text-body-sm">
                  <span className="text-stone-600">{name}</span>
                  <span className="font-mono font-medium text-stone-900">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
            <p className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-stone-500">
              By Payment Method
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-stone-600">M-Pesa</span>
                <span className="font-mono font-medium text-success">{formatCurrency(paymentBreakdown.MPESA)}</span>
              </div>
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-stone-600">Cash</span>
                <span className="font-mono font-medium text-stone-900">{formatCurrency(paymentBreakdown.CASH)}</span>
              </div>
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-stone-600">Card</span>
                <span className="font-mono font-medium text-blue-700">{formatCurrency(paymentBreakdown.CARD)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {entries.length === 0 && !isLoading ? (
        <EmptyState
          icon={<Banknote size={48} className="text-stone-300" />}
          heading="No income recorded yet"
          body={
            isFullViewer
              ? 'No other income entries for the selected date range'
              : "You haven't recorded any other income today"
          }
          action={
            <Link href="/app/other-income/new">
              <Button size="sm">
                <Plus size={16} className="mr-1.5" />
                Record Income
              </Button>
            </Link>
          }
        />
      ) : (
        <ExcelTable
          columns={columns}
          rows={entries as EntryRow[]}
          rowKey={(row) => row.id}
          headerTone="navy"
          isLoading={isLoading}
          skeletonRows={5}
          totalsRow={{
            category: <span className="text-label-sm uppercase tracking-wide">Total</span>,
            amount: <span className="font-bold text-espresso">{formatCurrency(totalValue)}</span>,
          }}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Delete income entry?"
        description={
          deleteTarget
            ? `This will permanently remove the ${formatCurrency(deleteTarget.amount)} entry for "${deleteTarget.category.name}".`
            : ''
        }
        confirmLabel="Delete"
        isLoading={isDeleting}
      />
    </PageLayout>
  );
}
