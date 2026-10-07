'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { DataTable, type TableColumn } from '@/components/ui2/data-table/data-table';
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
import { PHONE_PRIMARY_BUTTON } from '../../../_shared/lib/phone-styles';
import { clockLabel, signedMoney, todayLabel } from '../../../counting/_shared/lib/count-format';
import { LogWasteDrawer } from '../../log/components/log-waste-drawer';
import { ReverseDesktopDialog, ReversePhoneSheet } from '../../reverse/components/reverse-dialogs';
import { WASTE_STATES_COPY } from '../../_shared/lib/states-copy';
import { wasteApi } from '../../_shared/services/waste-api';
import type { WasteEntry, WasteList } from '../../_shared/types/waste-contract';
import { useAuthStore } from '@/store/authStore';

const WASTE = '/app/inventory/stock/waste';
const FILTERS: TableFilter[] = [{ kind: 'chips', key: 'period', options: [{ value: '', label: 'Today' }, { value: '7d', label: 'Last 7 days' }, { value: 'reversed', label: 'Reversed' }] }];
const COPY = {
  emptyTitle: 'No waste',
  emptyDescription: WASTE_STATES_COPY.wasteDesktop.empty,
  filteredEmptyTitle: 'No waste in this period',
  filteredEmptyDescription: WASTE_STATES_COPY.wasteDesktop.empty,
  errorTitle: 'Could not load waste',
  errorDescription: 'Try again. Nothing was changed.',
  permissionDescription: WASTE_STATES_COPY.wasteDesktop.permission,
};

/**
 * `/stock/waste`. The response decides the screen, not a role: a list that carries no `kpis` (the person sees only their own
 * entries and no stock figures) is the phone column "My waste today" (Paper step 19, `1ZGW-0`); one that carries `kpis` is the
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
  return probe.data.kpis ? <DesktopWaste /> : <PhoneWaste first={probe.data} />;
}

function PhoneWaste({ first }: { first: WasteList }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [list, setList] = React.useState(first);
  const [reversing, setReversing] = React.useState<WasteEntry | null>(null);
  const [notice, setNotice] = React.useState('');
  const todays = list.rows;
  return (
    <PhoneColumn>
      <ScwPhoneHeader leading="back" onBack={() => router.push('/app/inventory/stock/counts')} title="My waste today" subtitle={`${todayLabel()} · ${user?.name ?? ''}`} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
        {list.bannerText ? (
          <div role="status" className="flex items-start gap-2.5 border border-wds-success-border bg-wds-success-bg px-3.5 py-3">
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 shrink-0 text-wds-success-fg"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <p className="font-wds-sans text-[13px] leading-[18px] text-wds-success-fg">{list.bannerText}</p>
          </div>
        ) : null}
        <h2 className="pb-2.5 pt-4 font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">Waste today · {todays.length} {todays.length === 1 ? 'entry' : 'entries'}</h2>
        {todays.length === 0 ? (
          <ScwStatePanel kind="empty" phone text={WASTE_STATES_COPY.myWasteToday.empty} />
        ) : (
          <ul className="border border-wds-border bg-wds-surface">
            {todays.map((e) => (
              <li key={e.id} className="flex min-h-16 items-center justify-between gap-3 border-b border-wds-neutral-100 px-3.5 py-2.5 last:border-b-0">
                <span className="flex min-w-0 flex-col">
                  <span className={cn('truncate font-wds-sans text-[16px] leading-5', e.status === 'REVERSED' ? 'text-wds-text-faint line-through' : 'text-wds-text-ink')}>{e.itemName}</span>
                  <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{e.quantity} {e.unit} · {e.reasonText} · {clockLabel(e.at)}</span>
                </span>
                {e.status === 'REVERSED' && e.reversal ? (
                  <span className="shrink-0 border border-wds-border-strong bg-wds-neutral-100 px-2.5 py-1.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Reversed {clockLabel(e.reversal.at)}</span>
                ) : e.can.reverse ? (
                  <button type="button" onClick={() => setReversing(e)} className="h-11 shrink-0 border border-wds-border-strong bg-wds-surface px-5 font-wds-sans text-[14px] text-wds-text-ink outline-none transition-[background-color,transform] hover:bg-wds-neutral-50 focus-visible:shadow-wds-ring motion-safe:active:scale-[0.97]">
                    Reverse<span className="sr-only"> {e.itemName}</span>
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p role="status" aria-live="polite" className="sr-only">{notice}</p>
      </div>
      <div className="shrink-0 px-4 pb-5 pt-3">
        <Link href={`${WASTE}/new`} className={cn(PHONE_PRIMARY_BUTTON, 'h-[52px] text-[16px] leading-5')}>Log more waste</Link>
      </div>
      <ReversePhoneSheet
        entry={reversing}
        onClose={() => setReversing(null)}
        onDone={(updated) => {
          setList((l) => ({ ...l, rows: l.rows.map((r) => (r.id === updated.id ? updated : r)) }));
          setReversing(null);
          setNotice(`${updated.itemName} reversed. The stock went back.`);
        }}
      />
    </PhoneColumn>
  );
}

function DesktopWaste() {
  const router = useRouter();
  const params = useSearchParams();
  const { can, ready } = usePermissions();
  const [kpis, setKpis] = React.useState<WasteList['kpis'] | null>(null);
  const [counts, setCounts] = React.useState<Record<string, Record<string, number>>>({});
  const [refresh, setRefresh] = React.useState(0);
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
          filters={FILTERS}
          copy={COPY}
          counts={counts}
          enabled={ready}
          refreshToken={refresh}
          searchPlaceholder="Search an item"
          onRowActivate={(e) => e.can.reverse && setReversing(e)}
          rowClassName={(e) => (e.status === 'REVERSED' ? 'bg-wds-neutral-50' : undefined)}
          fetchRows={async (q, { signal }) => {
            const res = await wasteApi.list({ period: (q.filters.period as '7d' | 'reversed' | undefined) ?? 'today', search: q.search || undefined, page: q.page, pageSize: q.perPage as 25 | 50 | 100 }, signal);
            setKpis(res.kpis ?? null);
            setCounts({ period: { '': res.chips.today, '7d': res.chips.last7, reversed: res.chips.reversed } });
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
