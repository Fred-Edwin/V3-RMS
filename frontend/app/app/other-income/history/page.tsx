'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Banknote, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  PageHeader,
  PageLayout,
  SkeletonTable,
  Table,
  type TableColumn,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { otherIncomeService } from '@/services/otherIncomeService';
import { useAuthStore } from '@/store/authStore';
import { getTodayYmdInTimeZone } from '@/lib/date';
import { ApiError } from '@/types/api';
import type { OtherIncomeEntry } from '@/types/otherIncome';

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  CARD: 'Card',
};

const formatCurrency = (value: string): string => {
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) return 'KES 0.00';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (ymd: string): string => {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

type EntryRow = Record<string, unknown> & OtherIncomeEntry;

const CAN_SEE_ALL = new Set(['DIRECTOR', 'SYSTEM_ADMIN', 'MANAGER', 'ACCOUNTANT']);

export default function OtherIncomeHistoryPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const userId = useAuthStore((state) => state.user?.id);

  const todayYmd = getTodayYmdInTimeZone();
  const isFullViewer = role ? CAN_SEE_ALL.has(role) : false;

  const [entries, setEntries] = useState<OtherIncomeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(todayYmd);
  const [endDate, setEndDate] = useState(todayYmd);

  const [deleteTarget, setDeleteTarget] = useState<EntryRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadEntries = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const params = isFullViewer
        ? { startDate, endDate, perPage: 100 }
        : { startDate: todayYmd, endDate: todayYmd, perPage: 50 };
      const { entries: data } = await otherIncomeService.listEntries(params, accessToken);
      setEntries(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not load entries';
      toast({ variant: 'error', title: message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, isFullViewer, startDate, endDate, todayYmd, toast]);

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

  const canDelete = (entry: OtherIncomeEntry): boolean => {
    if (!role) return false;
    const entryYmd = entry.entryDate.slice(0, 10);
    const isToday = entryYmd === todayYmd;
    if (role === 'WAITER') return entry.recordedById === userId && isToday;
    if (role === 'MANAGER') return isToday;
    return role === 'DIRECTOR' || role === 'SYSTEM_ADMIN';
  };

  const totalValue = entries.reduce((sum, e) => sum + Number.parseFloat(e.amount), 0);

  const columns: TableColumn<EntryRow>[] = [
    {
      key: 'category',
      label: 'Category',
      render: (_v, row) => (
        <span className="font-medium text-stone-900">{row.category.name}</span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (_v, row) => (
        <span className="font-semibold tabular-nums text-[#2C1810]">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: 'paymentMethod',
      label: 'Payment',
      render: (_v, row) => (
        <span className="text-stone-600">{PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod}</span>
      ),
    },
    {
      key: 'entryDate',
      label: 'Date',
      render: (_v, row) => (
        <span className="text-stone-600">{formatDate(row.entryDate.slice(0, 10))}</span>
      ),
    },
    ...(isFullViewer
      ? [{
          key: 'recordedBy' as const,
          label: 'Recorded By',
          render: (_v: unknown, row: EntryRow) => (
            <span className="text-stone-600">{row.recordedBy.name}</span>
          ),
        }]
      : []),
    {
      key: 'description',
      label: 'Notes',
      render: (_v, row) => (
        <span className="italic text-stone-500">
          {row.description ?? '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_v, row) =>
        canDelete(row) ? (
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:shadow-focus"
            aria-label="Delete entry"
          >
            <Trash2 size={16} />
          </button>
        ) : null,
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

      {/* Date filter — managers and above only */}
      {isFullViewer && (
        <div className="mb-5 flex flex-wrap items-end gap-3">
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
              {formatCurrency(totalValue.toFixed(2))} total
            </span>
          </span>
        </div>
      )}

      {isLoading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : entries.length === 0 ? (
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
        <Table
          columns={columns}
          data={entries as EntryRow[]}
          keyField="id"
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
