'use client';

import { useEffect, useState } from 'react';
import { Card, ExcelTable, type ExcelColumn } from '@/components/ui';
import { listPrepRecords } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { cn } from '@/lib/cn';
import type { PrepRecord } from '@/types/inventory';

const formatKes = (value: string): string =>
  `Ksh ${parseFloat(value).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function usePrepHistory() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();
  const [records, setRecords] = useState<PrepRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      setIsLoading(true);
      try {
        const list = await listPrepRecords(accessToken);
        setRecords(list);
      } catch (error) {
        toast({ variant: 'error', title: 'Failed to load prep history', message: error instanceof Error ? error.message : 'Please try again.' });
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return { records, isLoading };
}

/**
 * Prep History — Manager-only, third tab alongside Log Prep / Prep Recipes
 * (D-12 "Left open" #4, see UI_UX_DESIGN_AUDIT.md Flow 3). The Manager's own
 * detailed per-run log — every ingredient + quantity actually used, actual
 * yield, the scaled-expected yield for that run's batch size, and the
 * variance between them. Distinct in purpose from the aggregate Reports
 * section's Prep Yield report (which rolls up across runs/output items).
 *
 * Desktop gets the `ExcelTable` office idiom (matches Reports' Prep Yield
 * table); mobile gets a chronological card feed instead of squeezing the
 * same 7-column grid into a phone width — same split Stock On Hand's
 * movement-history view already uses ("full-screen movement history,
 * chronological feed, not a table").
 */
export function PrepHistoryTab(): JSX.Element {
  const isDesktop = useIsDesktopShell();
  const { records, isLoading } = usePrepHistory();

  if (!isDesktop) {
    return <PrepHistoryMobile records={records} isLoading={isLoading} />;
  }

  const columns: ExcelColumn<PrepRecord>[] = [
    {
      key: 'recordedAt',
      label: 'Date & Time',
      render: (row) => new Date(row.recordedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }),
    },
    { key: 'outputItem', label: 'Output Item', render: (row) => row.outputItem.name },
    {
      key: 'ingredients',
      label: 'Ingredients Used',
      width: 280,
      render: (row) => (
        <ul className="space-y-0.5 py-0.5">
          {row.lines.map((line) => (
            <li key={line.id} className="flex items-baseline gap-1.5 text-body-sm text-stone-600">
              <span className="shrink-0 tabular-nums text-stone-800">{line.quantity} {line.inputItem.usageUnit}</span>
              <span className="min-w-0 truncate">{line.inputItem.name}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: 'actualYield',
      label: 'Actual Yield',
      numeric: true,
      render: (row) => `${row.actualYield} ${row.outputItem.usageUnit}`,
    },
    {
      key: 'scaledExpectedYield',
      label: 'Expected (This Batch)',
      numeric: true,
      render: (row) => (row.scaledExpectedYield ? `${row.scaledExpectedYield} ${row.outputItem.usageUnit}` : '—'),
    },
    {
      key: 'variance',
      label: 'Variance',
      numeric: true,
      render: (row) => {
        const expected = row.scaledExpectedYield ? parseFloat(row.scaledExpectedYield) : 0;
        if (!row.scaledExpectedYield || expected === 0) return '—';
        const variancePct = ((parseFloat(row.actualYield) - expected) / expected) * 100;
        const tone = variancePct < 0 ? 'text-danger' : variancePct > 0 ? 'text-success' : 'text-stone-500';
        return (
          <span className={`font-semibold ${tone}`}>
            {variancePct > 0 ? '+' : ''}
            {variancePct.toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: 'unitCost',
      label: 'Unit Cost',
      numeric: true,
      render: (row) => formatKes(row.unitCost),
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-body-sm text-stone-500">
        Every prep run logged, with what was actually used and produced versus this batch&apos;s expected yield.
      </p>
      <Card className="p-0">
        <ExcelTable
          columns={columns}
          rows={records}
          rowKey={(row) => row.id}
          numbered
          isLoading={isLoading}
          emptyState={<p className="p-10 text-center text-body-sm text-stone-500">No prep runs logged yet.</p>}
        />
      </Card>
    </div>
  );
}

function PrepHistoryMobile({ records, isLoading }: { records: PrepRecord[]; isLoading: boolean }): JSX.Element {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-md bg-stone-100" />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return <p className="py-10 text-center text-body-sm text-stone-500">No prep runs logged yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {records.map((record) => {
        const scaled = record.scaledExpectedYield;
        const expected = scaled ? parseFloat(scaled) : 0;
        const variancePct = scaled && expected !== 0 ? ((parseFloat(record.actualYield) - expected) / expected) * 100 : null;
        const varianceTone = variancePct === null ? 'text-stone-500' : variancePct < 0 ? 'text-danger' : variancePct > 0 ? 'text-success' : 'text-stone-500';

        return (
          <li key={record.id} className="rounded-md border border-stone-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-body-sm font-semibold text-stone-900">{record.outputItem.name}</p>
                <p className="text-label-sm text-stone-400">
                  {new Date(record.recordedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <p className="shrink-0 text-label-lg font-semibold tabular-nums text-stone-900">
                {record.actualYield} {record.outputItem.usageUnit}
              </p>
            </div>

            <ul className="mt-2 space-y-0.5">
              {record.lines.map((line) => (
                <li key={line.id} className="flex items-baseline gap-1.5 text-label-sm text-stone-600">
                  <span className="shrink-0 tabular-nums text-stone-800">{line.quantity} {line.inputItem.usageUnit}</span>
                  <span className="min-w-0 truncate">{line.inputItem.name}</span>
                </li>
              ))}
            </ul>

            <div className="mt-2.5 flex items-center justify-between border-t border-stone-100 pt-2.5">
              <p className="text-label-sm text-stone-500">
                Expected: {scaled ? `${scaled} ${record.outputItem.usageUnit}` : '—'}
              </p>
              <p className={cn('text-label-md font-semibold tabular-nums', varianceTone)}>
                {variancePct === null ? '—' : `${variancePct > 0 ? '+' : ''}${variancePct.toFixed(1)}%`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
