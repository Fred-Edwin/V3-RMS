'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { DataTable, type TableColumn } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { cn } from '@/lib/cn';
import { ScwStatePanel } from '../../../_shared/components/scw-states';
import { ScwKpiStrip, ScwKpiStripSkeleton } from '../../../_shared/components/scw-kpi-strip';
import { ScwTopbar } from '../../../_shared/components/scw-topbar';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { plainQty, signedMoney } from '../../../counting/_shared/lib/count-format';
import { STOCK_ERROR_COPY, STOCK_STATES_COPY } from '../../_shared/lib/states-copy';
import { stockApi } from '../../_shared/services/stock-api';
import type { LedgerList, LedgerRow } from '../../_shared/types/stock-contract';
import { DateRangePicker, type DateRange } from '@/components/ui2/date-range-picker';

const LEDGER_RANGE_NOTE = 'Later dates can’t be picked. Opening and closing figures use the first and last day you choose.';

const COPY = {
  emptyTitle: 'No movements',
  emptyDescription: STOCK_STATES_COPY.stockLedger.empty,
  filteredEmptyTitle: 'No movements match',
  filteredEmptyDescription: STOCK_STATES_COPY.stockLedger.empty,
  errorTitle: 'Could not load the ledger',
  errorDescription: 'Try again. Nothing was changed.',
  permissionDescription: STOCK_STATES_COPY.stockLedger.permission,
};

const FILTERS: TableFilter[] = [
  { kind: 'dropdown', key: 'sectionId', label: 'Section', options: [{ value: 's-samrat', label: 'Samrat' }, { value: 's-summer', label: 'Summer' }, { value: 's-others', label: 'Others' }, { value: 's-packaging', label: 'Packaging' }] },
  { kind: 'chips', key: 'chip', options: [{ value: '', label: 'All' }, { value: 'adjustments', label: 'Had adjustments' }, { value: 'waste', label: 'Had waste' }, { value: 'negative', label: 'Negative stock only' }] },
];

const num = (v: string, cls = ''): React.ReactNode => {
  const n = Number(v);
  return <span className={cn('font-wds-mono', n === 0 ? 'text-wds-text-faint' : cls || 'text-wds-text-ink')}>{n === 0 ? '0' : (n > 0 && cls === 'in' ? '+' : '') + plainQty(v).replace('-', '−')}</span>;
};

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
}

/**
 * Stock ledger (Paper step 28, `22BR-0`; `/stock/ledger`), read only: one row per item for a period (opening, in, sent out, prep
 * use, waste, adjusted, closing, value), a date control with quick picks and a two-month calendar, search by item or reference
 * (ADJ-3402, CNT-2026-1013), Section filter, chips, a numbered pager, and Export (a CSV of every row). A row opens the stock card for
 * the same period. Dates live in the URL (`?from=&to=`).
 */
export function StockLedgerScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { can, ready } = usePermissions();
  const t = React.useMemo(today, []);
  const range: DateRange = { from: params.get('from') ?? new Date(Date.parse(`${t}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10), to: params.get('to') ?? t };
  const [meta, setMeta] = React.useState<LedgerList | null>(null);
  const [counts, setCounts] = React.useState<Record<string, Record<string, number>>>({});
  const [exporting, setExporting] = React.useState(false);
  const qs = `?from=${range.from}&to=${range.to}`;

  const setRange = (r: DateRange): void => {
    const q = new URLSearchParams(params.toString());
    q.set('from', r.from);
    q.set('to', r.to);
    q.delete('page');
    router.replace(`/app/inventory/stock/ledger?${q}`, { scroll: false });
  };

  const columns = React.useMemo<TableColumn<LedgerRow>[]>(
    () => [
      { id: 'item', header: 'Item', cell: (r, { term }) => <span className="text-wds-text-ink"><HighlightMatch text={r.name} term={term} /> <span className="text-wds-text-secondary">· {r.unit}{r.note ? ` · ${r.note}` : ''}</span></span> },
      { id: 'opening', header: 'Opening', width: '86px', align: 'right', cell: (r) => num(r.opening) },
      { id: 'in', header: 'In', width: '80px', align: 'right', cell: (r) => num(r.in, 'in') },
      { id: 'out', header: 'Sent out', width: '86px', align: 'right', cell: (r) => num(r.sentOut) },
      { id: 'prep', header: 'Prep use', width: '86px', align: 'right', cell: (r) => num(r.prepUse) },
      { id: 'waste', header: 'Waste', width: '76px', align: 'right', cell: (r) => num(r.waste) },
      { id: 'adj', header: 'Adjusted', width: '86px', align: 'right', cell: (r) => num(r.adjusted, Number(r.adjusted) < 0 ? 'text-wds-error-fg' : 'text-wds-success-fg') },
      { id: 'closing', header: 'Closing', width: '86px', align: 'right', cell: (r) => <span className="font-wds-mono font-semibold text-wds-text-ink">{plainQty(r.closing)}</span> },
      { id: 'value', header: 'Value (KES)', width: '110px', align: 'right', cell: (r) => <span className="font-wds-mono text-wds-text-ink">{signedMoney(r.closingValueKes)}</span> },
    ],
    [],
  );

  const exportCsv = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    try {
      const { blob, fileName } = await stockApi.exportLedger({ from: range.from, to: range.to });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      useWdsToastStore.getState().addToast({ variant: 'success', title: 'Ledger exported', description: fileName });
    } catch (err) {
      useWdsToastStore.getState().addToast({ variant: 'error', title: scwErrorMessage(err, STOCK_ERROR_COPY, 'Could not export the ledger. Try again.') });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScwTopbar
        breadcrumb={{ section: 'Central Store', screen: 'Stock ledger' }}
        actions={
          <>
            {can('waste.log') ? <Button variant="secondary" asChild><Link href="/app/inventory/stock/waste?drawer=log">Log waste</Link></Button> : null}
            {can('counts.record') ? <Button asChild><Link href="/app/inventory/stock/counts/new">Start count</Link></Button> : null}
          </>
        }
      />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">Stock ledger</h1>
            <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">One row per item: opening, what came in, where it went, closing. Open an item for its full history. {meta ? meta.periodText : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker value={range} today={t} note={LEDGER_RANGE_NOTE} onChange={(r) => r && setRange(r)} />
            <Button variant="secondary" onClick={() => void exportCsv()} disabled={exporting} className="h-8">{exporting ? 'Exporting…' : 'Export'}</Button>
          </div>
        </div>
        {ready && !can('stock.read') ? (
          <ScwStatePanel kind="permission" text={STOCK_STATES_COPY.stockLedger.permission} />
        ) : (
          <>
            {meta ? <ScwKpiStrip cells={meta.kpis} /> : <ScwKpiStripSkeleton />}
            <DataTable<LedgerRow>
              label="Stock ledger"
              columns={columns}
              getRowId={(r) => r.itemId}
              filters={FILTERS}
              copy={COPY}
              counts={counts}
              enabled={ready}
              searchPlaceholder="Find an item or reference (ADJ-3402)"
              refreshToken={range.from.length + range.to.length + Number(range.from.slice(-2)) + Number(range.to.slice(-2))}
              onRowActivate={(r) => router.push(`/app/inventory/stock/ledger/${r.itemId}${qs}`)}
              fetchRows={async (q, { signal }) => {
                const res = await stockApi.ledger({ from: range.from, to: range.to, search: q.search || undefined, sectionId: q.filters.sectionId, chip: (q.filters.chip as 'adjustments' | 'waste' | 'negative' | undefined) ?? 'all', page: q.page, pageSize: q.perPage as 25 | 50 | 100 }, signal);
                setMeta(res);
                setCounts({ chip: { '': res.chips.all, adjustments: res.chips.adjustments, waste: res.chips.waste, negative: res.chips.negative } });
                return { rows: res.rows, total: res.page.total };
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
