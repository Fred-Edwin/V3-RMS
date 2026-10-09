'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { DataTable, type TableColumn } from '@/components/ui2/data-table/data-table';
import { effectiveRange, nairobiToday } from '@/components/ui2/data-table/table-dates';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { Skeleton } from '@/components/ui2/skeleton';
import { useWdsToastStore } from '@/store/wdsToastStore';
import { cn } from '@/lib/cn';
import { PhoneColumn, ScwPhoneHeader } from '../../../_shared/components/phone-column';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { ScwKpiStrip, ScwKpiStripSkeleton } from '../../../_shared/components/scw-kpi-strip';
import { ScwTopbar } from '../../../_shared/components/scw-topbar';
import { useLoader } from '../../../_shared/hooks/use-async';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { clockLabel, signedMoney } from '../../../counting/_shared/lib/count-format';
import { LogWasteDrawer } from '../../log/components/log-waste-drawer';
import { ReverseDesktopDialog } from '../../reverse/components/reverse-dialogs';
import { MyWasteScreen } from './my-waste-screen';
import { WASTE_STATES_COPY } from '../../_shared/lib/states-copy';
import { wasteApi } from '../../_shared/services/waste-api';
import { WASTE_REASONS, WASTE_REASON_TEXT, type WasteEntry, type WasteList, type WasteReason } from '../../_shared/types/waste-contract';

const WASTE = '/app/inventory/stock/waste';
/** Paper step 57: "Date: Today" is the starting range; the date is the day the entry was logged. */
const DATE_FILTER = {
  kind: 'dateRange',
  fromKey: 'from',
  toKey: 'to',
  label: 'Date',
  defaultPreset: 'today',
  note: 'Later dates can’t be picked. Entries are listed by the day they were logged.',
} as const satisfies TableFilter;
const REASON_FILTER: TableFilter = { kind: 'dropdown', key: 'reason', label: 'Reason', options: WASTE_REASONS.map((value) => ({ value, label: WASTE_REASON_TEXT[value] })) };
const STATUS_FILTER: TableFilter = { kind: 'dropdown', key: 'status', label: 'Status', options: [{ value: 'logged', label: 'Logged' }, { value: 'reversed', label: 'Reversed' }] };
const COPY = {
  emptyTitle: 'No waste',
  emptyDescription: WASTE_STATES_COPY.wasteDesktop.empty,
  filteredEmptyTitle: 'No waste matches',
  filteredEmptyDescription: WASTE_STATES_COPY.wasteDesktop.empty,
  errorTitle: 'Could not load waste',
  errorDescription: 'Try again. Nothing was changed.',
  permissionDescription: WASTE_STATES_COPY.wasteDesktop.permission,
};

/**
 * `/stock/waste`. The response decides the screen, not a role: a list that carries no `kpis` (the person sees only their own
 * entries and no stock figures) is the phone column "My waste, today and earlier" (Paper step 54, `my-waste-screen.tsx`); one that carries `kpis` is the
 * desktop Waste (step 21, `1ZLU-0`). Both read every entry the server sends and show Reverse only where the entry says
 * `can.reverse`. `?drawer=log` opens the desktop Log waste drawer (step 22).
 */
export function WasteScreen() {
  const { can, ready, failed } = usePermissions();
  const probe = useLoader(ready ? 'waste-probe' : null, () => wasteApi.list({ period: 'today', pageSize: 25 }), WASTE_STATES_COPY.myWasteToday.error);
  if (ready && !can('waste.read')) {
    return (
      <PhoneColumn>
        <ScwPhoneHeader leading="menu" title="Waste" subtitle="Central Store" />
        <ScwStatePanel kind="permission" phone text={WASTE_STATES_COPY.myWasteToday.permission} />
      </PhoneColumn>
    );
  }
  if (failed || probe.status === 'error') return <ScwStatePanel kind="error" text={WASTE_STATES_COPY.wasteDesktop.error} onRetry={() => void probe.reload()} className="m-8" />;
  if (!probe.data) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-8" aria-hidden>
        <LoadingAnnouncer text={WASTE_STATES_COPY.wasteDesktop.loading} />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  return probe.data.kpis ? <DesktopWaste /> : <MyWasteScreen />;
}

function DesktopWaste() {
  const router = useRouter();
  const params = useSearchParams();
  const { can, ready } = usePermissions();
  const [kpis, setKpis] = React.useState<WasteList['kpis'] | null>(null);
  const [people, setPeople] = React.useState<{ id: string; name: string }[]>([]);
  const [refresh, setRefresh] = React.useState(0);
  // "Logged by" lists whoever has logged waste here; it arrives with the first page of rows.
  const filters = React.useMemo<TableFilter[]>(
    () => [DATE_FILTER, REASON_FILTER, { kind: 'dropdown', key: 'loggedBy', label: 'Logged by', options: people.map((p) => ({ value: p.id, label: p.name })) }, STATUS_FILTER],
    [people],
  );
  const [reversing, setReversing] = React.useState<WasteEntry | null>(null);
  const drawer = params.get('drawer') === 'log';

  const setDrawer = (open: boolean): void => {
    const q = new URLSearchParams(params.toString());
    if (open) q.set('drawer', 'log');
    else q.delete('drawer');
    router.replace(`${WASTE}${q.toString() ? `?${q}` : ''}`, { scroll: false });
  };

  const columns = React.useMemo<TableColumn<WasteEntry>[]>(
    () => {
      const gone = (e: WasteEntry) => e.status === 'REVERSED';
      return [
        { id: 'time', header: 'Time', width: '90px', cell: (e) => <span className={cn('font-wds-mono text-[12px]', gone(e) ? 'text-wds-text-faint' : 'text-wds-text-ink')}>{clockLabel(e.at)}</span> },
        { id: 'item', header: 'Item', cell: (e) => <span className={cn(gone(e) ? 'text-wds-text-faint line-through' : 'font-medium text-wds-text-ink')}>{e.itemName}</span> },
        { id: 'qty', header: 'Qty', width: '110px', align: 'right', cell: (e) => <span className={cn('font-wds-mono', gone(e) ? 'text-wds-text-faint' : 'text-wds-text-ink')}>{e.quantity} {e.unit}</span> },
        { id: 'reason', header: 'Reason', width: '170px', className: 'pl-6', cell: (e) => <span className={gone(e) ? 'text-wds-text-faint' : 'text-wds-text-ink'}>{e.reasonText}</span> },
        { id: 'by', header: 'Logged by', width: '170px', cell: (e) => <span className={gone(e) ? 'text-wds-text-faint' : 'text-wds-text-ink'}>{e.loggedBy.name}</span> },
        { id: 'value', header: 'Value', width: '110px', align: 'right', cell: (e) => <span className={cn('font-wds-mono', gone(e) ? 'text-wds-text-faint' : 'text-wds-text-ink')}>{e.valueKes === undefined ? '' : gone(e) ? '0' : signedMoney(e.valueKes)}</span> },
        {
          id: 'status', header: 'Status', align: 'right',
          cell: (e) => e.status === 'REVERSED' && e.reversal ? (
            <span className="inline-block border border-wds-border-strong bg-wds-neutral-100 px-2.5 py-1 font-wds-sans text-[12px] text-wds-text-secondary">Reversed {clockLabel(e.reversal.at)} · {e.reversal.reasonText.toLowerCase().replace('logged the ', '')}</span>
          ) : e.can.reverse ? (
            <button type="button" onClick={(ev) => { ev.stopPropagation(); setReversing(e); }} className="h-[30px] border border-wds-border-strong bg-wds-surface px-3.5 font-wds-sans text-[13px] font-medium text-wds-text-ink outline-none transition-[background-color,transform] hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.98]">Reverse<span className="sr-only"> {e.itemName}</span></button>
          ) : null,
        },
      ];
    },
    [],
  );

  if (ready && !can('waste.read')) return <ScwStatePanel kind="permission" text={WASTE_STATES_COPY.wasteDesktop.permission} className="m-8" />;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScwTopbar
        search={false}
        breadcrumb={{ section: 'Central Store', screen: 'Waste' }}
        actions={can('waste.log') ? <Button onClick={() => setDrawer(true)}>Log waste</Button> : undefined}
      />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">Waste</h1>
          <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">Everything thrown away at the Central Store. Entries are never deleted; a wrong one is reversed.</p>
        </div>
        {kpis ? <ScwKpiStrip cells={kpis} /> : <ScwKpiStripSkeleton />}
        <DataTable<WasteEntry>
          label="Waste"
          columns={columns}
          getRowId={(e) => e.id}
          filters={filters}
          copy={COPY}
          enabled={ready}
          refreshToken={refresh}
          searchPlaceholder="Search an item or a person"
          onRowActivate={(e) => e.can.reverse && setReversing(e)}
          rowClassName={(e) => (e.status === 'REVERSED' ? 'bg-wds-neutral-50' : undefined)}
          fetchRows={async (q, { signal }) => {
            const range = effectiveRange(q.filters, DATE_FILTER, DATE_FILTER.defaultPreset, nairobiToday());
            const res = await wasteApi.list(
              {
                search: q.search || undefined,
                from: range?.from,
                to: range?.to,
                reason: q.filters.reason as WasteReason | undefined,
                loggedBy: q.filters.loggedBy,
                status: q.filters.status as 'logged' | 'reversed' | undefined,
                page: q.page,
                pageSize: q.perPage as 25 | 50 | 100,
              },
              signal,
            );
            setKpis(res.kpis ?? null);
            if (res.people) setPeople(res.people);
            return { rows: res.rows, total: res.page.total };
          }}
        />
      </main>
      <ReverseDesktopDialog
        entry={reversing}
        onClose={() => setReversing(null)}
        onDone={(e) => {
          setReversing(null);
          setRefresh((n) => n + 1);
          useWdsToastStore.getState().addToast({ variant: 'success', title: 'Entry reversed', description: `${e.itemName} · the stock went back.` });
        }}
      />
      <LogWasteDrawer
        open={drawer && can('waste.log')}
        onOpenChange={setDrawer}
        onLogged={() => setRefresh((n) => n + 1)}
      />
    </div>
  );
}
