'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { PurchasingAuditPanel } from '../../../purchasing/components/purchasing-audit-panel';
import { DateRangePicker } from '@/components/ui2/date-range-picker';
import { Skeleton } from '@/components/ui2/skeleton';
import { TablePager } from '@/components/ui2/data-table/table-pager';
import { effectiveRange, nairobiToday, presetRange, rangeToFilters } from '@/components/ui2/data-table/table-dates';
import { useTableUrlState } from '@/components/ui2/data-table/use-table-url-state';
import { Topbar } from '@/components/app/shell/topbar';
import { LoadingState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { StockEmptyCard, StockErrorCard } from '../../../_shared/components/stock-states';
import { FilterMenu, PageHeading } from '../../../suppliers/components/supplier-ui';
import { useAuditLog } from '../../hooks/use-audit-log';
import { AREA_LABEL, AREA_MENU, PURCHASING_VIEW, parseArea, rangeSentence, recordHref, whenLabel } from '../../lib/audit-log-logic';
import type { AuditArea, AuditEntry } from '../../types/audit-log';
import { AreaMenu } from '../area-menu';

/** The URL parameters this screen owns, next to `page` and `perPage`. */
const AUDIT_FILTER_KEYS = ['area', 'branch', 'who', 'from', 'to'] as const;
const DATE_KEYS = { fromKey: 'from', toKey: 'to' } as const;
/** Paper step 59: the date range starts on today. */
const START_PRESET = 'today';
const RANGE_NOTE = 'Later dates can’t be picked. The list shows every entry in the range, newest first.';

const BRANCH_AREAS: ReadonlySet<AuditArea> = new Set(AREA_MENU[1]?.items.map((i) => i.value as AuditArea));

const head = 'font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-ink';
const cols = {
  when: 'w-[110px] shrink-0',
  who: 'w-[150px] shrink-0 pr-3',
  area: 'w-[130px] shrink-0 pr-3',
  what: 'min-w-0 grow basis-0 pr-4',
  record: 'w-[170px] shrink-0',
};
const recordLink = 'font-wds-mono text-[12px] leading-4 text-wds-info-fg underline underline-offset-2 outline-none hover:no-underline focus-visible:shadow-wds-ring';

function RowSkeleton() {
  return (
    <div className="flex h-11 items-center border-b border-wds-neutral-100 px-4">
      <Skeleton className="h-3 w-[60px]" />
      <div className={cn('ml-[50px]', cols.who)}>
        <Skeleton className="h-3 w-[88px]" />
      </div>
      <div className={cols.area}>
        <Skeleton className="h-3 w-[72px]" />
      </div>
      <div className={cols.what}>
        <Skeleton className="h-3 w-[60%]" />
      </div>
    </div>
  );
}

/** The record column: the purchase file an order row belongs to, or the count, stock card or ADJ number a derived row points at. */
function RecordCell({ entry }: { entry: AuditEntry }) {
  if (entry.purchasing) {
    return (
      <Link href={`/app/inventory/purchasing/${entry.purchasing.orderId}`} className={recordLink}>
        {entry.purchasing.orderReference ?? 'Open the order'}
      </Link>
    );
  }
  if (entry.record) {
    return (
      <Link href={recordHref(entry.record)} className={recordLink}>
        {entry.record.label}
      </Link>
    );
  }
  return <span className="text-wds-text-faint">—</span>;
}

/**
 * Audit log — Paper chapter 8 step 35, with the Area menu and the date range picker of steps 58 and 59 (Lane 0). Every change in
 * the Catalog, Suppliers, Restock levels, Prep, Purchasing, Stock counts, Waste and Stock adjustments, with who, when and why. The
 * five Branches areas are in the Area menu and answer nothing until each block adds its source. Read-only; the Store Manager,
 * Accountant and Director read it.
 */
export function AuditLogScreen() {
  const { can, ready } = usePermissions();
  const canRead = can('audit.read');
  // Area, branch, who, dates, page and rows per page live in the URL (§4a), so refresh, Back and a pasted link keep the view.
  // Today is where the date range starts, so it is the address with no `from` and `to`.
  const { query: view, patch, setPage } = useTableUrlState({ filterKeys: AUDIT_FILTER_KEYS });
  const today = React.useMemo(() => nairobiToday(), []);
  const urlArea = parseArea(view.filters.area);
  const area: AuditArea | null = urlArea === null || urlArea === PURCHASING_VIEW ? null : urlArea;
  const actorId = view.filters.who ?? null;
  const branchId = view.filters.branch ?? null;
  const range = effectiveRange(view.filters, DATE_KEYS, START_PRESET, today) ?? presetRange(START_PRESET, today) ?? { from: today, to: today };
  // "Purchasing and payments" is the purchase file's own log (Paper `23`), read from the same `GET /inventory/audit-log`. A link with ?q= (the closed purchase file's
  // "Everything") opens it already searching for that document.
  const query = useSearchParams().get('q');
  const purchasing = urlArea === PURCHASING_VIEW;
  const openedFromLink = React.useRef(false);
  React.useEffect(() => {
    if (query && view.filters.area === undefined && !openedFromLink.current) {
      openedFromLink.current = true;
      patch({ filters: { area: PURCHASING_VIEW } });
    }
  }, [query, view.filters.area, patch]);

  const log = useAuditLog({ area, actorId, branchId, range, page: view.page, perPage: view.perPage }, canRead && !purchasing);
  const now = React.useMemo(() => new Date(), [range.from, range.to, log.data]); // eslint-disable-line react-hooks/exhaustive-deps -- "now" follows the data it labels
  const data = log.data;
  const actorName = data?.actors.find((a) => a.id === actorId)?.name ?? 'Everyone';
  const branchName = data?.branches.find((b) => b.id === branchId)?.name ?? 'All';
  const inBranchesArea = area !== null && BRANCH_AREAS.has(area);

  const setArea = (v: ReturnType<typeof parseArea>) => patch({ filters: { area: v ?? '' } });
  const setActorId = (v: string | null) => patch({ filters: { who: v ?? '' } });
  const setBranchId = (v: string | null) => patch({ filters: { branch: v ?? '' } });
  const setRange = (r: { from: string; to: string } | null) => patch({ filters: rangeToFilters(r, DATE_KEYS, START_PRESET, today) });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: 'Central Store', screen: 'Audit log' }} hideSearch className="shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-4 py-7 sm:px-8">
        <PageHeading title="Audit log">Who did what, when and why across the Central Store and every branch. Nobody can edit or remove an entry.</PageHeading>
        {!ready ? (
          <div className="flex justify-center py-10">
            <LoadingState />
          </div>
        ) : !canRead ? (
          <PermissionDeniedState description="This page is not available for your role." />
        ) : (
          <>
            <div role="group" aria-label="Filter the audit log" className="flex flex-wrap items-center gap-2">
              <AreaMenu value={urlArea} onSelect={setArea} />
              {purchasing ? null : (
                <>
                  <FilterMenu<string>
                    name="Branch"
                    valueLabel={branchName}
                    options={[{ value: null, label: 'All' }, ...(data?.branches ?? []).map((b) => ({ value: b.id, label: b.name }))]}
                    onSelect={(v) => setBranchId(v)}
                  />
                  <FilterMenu<string>
                    name="Who"
                    valueLabel={actorName}
                    options={[{ value: null, label: 'Everyone' }, ...(data?.actors ?? []).map((a) => ({ value: a.id, label: a.name }))]}
                    onSelect={(v) => setActorId(v)}
                  />
                  <DateRangePicker label="Date" today={today} value={range} note={RANGE_NOTE} onChange={setRange} buttonClassName="h-[30px] rounded-wds-sm max-sm:h-11" />
                </>
              )}
            </div>

            {purchasing ? <PurchasingAuditPanel initialQuery={query ?? ''} /> : null}

            {purchasing ? null : log.status === 'error' ? (
              <StockErrorCard title="Couldn’t load the audit log" description={log.error ?? 'Could not load the audit log. Try again.'} onRetry={() => void log.reload()} />
            ) : (
              <div className="flex flex-col overflow-x-auto border border-wds-border bg-wds-surface" aria-busy={log.status === 'loading'}>
                <div role="table" aria-label="Audit log entries" className="min-w-[860px]">
                <div className="flex h-[34px] shrink-0 items-center border-b border-wds-text-ink px-4" role="row">
                  <span role="columnheader" className={cn(head, cols.when)}>When</span>
                  <span role="columnheader" className={cn(head, cols.who)}>Who</span>
                  <span role="columnheader" className={cn(head, cols.area)}>Area</span>
                  <span role="columnheader" className={cn(head, cols.what)}>What</span>
                  <span role="columnheader" className={cn(head, cols.record)}>Record</span>
                </div>
                {data && data.entries.length > 0 && log.status !== 'loading' && log.status !== 'idle' ? (
                  <div role="rowgroup">
                    {data.entries.map((entry) => (
                      <div key={entry.id} className="flex min-h-11 items-center border-b border-wds-neutral-100 px-4 py-2 last:border-b-0" role="row">
                        <span role="cell" className={cn('font-wds-mono text-[12px] leading-4 text-wds-text-secondary', cols.when)}>{whenLabel(entry.at, now)}</span>
                        <span role="cell" className={cn('font-wds-sans text-[13px] leading-4 text-wds-text-ink', cols.who)}>{entry.actor.name}</span>
                        <span role="cell" className={cn('font-wds-sans text-[13px] leading-4 text-wds-text-ink', cols.area)}>{AREA_LABEL[entry.area]}</span>
                        <span role="cell" className={cn('font-wds-sans text-[13px] leading-[18px] text-wds-text-ink', cols.what)}>
                          {entry.what}
                          {entry.reason ? <span className="block text-wds-text-secondary">{entry.reason}</span> : null}
                        </span>
                        <span role="cell" className={cols.record}>
                          <RecordCell entry={entry} />
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                </div>
                {log.status === 'loading' || log.status === 'idle' ? (
                  <div role="status" aria-live="polite">
                    <span className="sr-only">Loading the audit log</span>
                    {Array.from({ length: 6 }, (_, i) => (
                      <RowSkeleton key={i} />
                    ))}
                  </div>
                ) : data && data.entries.length === 0 ? (
                  inBranchesArea ? (
                    <StockEmptyCard className="py-10" title="Nothing here yet" description="The Branches areas fill in as each part of the branch day goes live. Nothing has been recorded for this one." />
                  ) : (
                    <StockEmptyCard
                      className="py-10"
                      title="Nothing was recorded in this range"
                      description="Changes, counts, waste and adjustments show here as they happen. Try a wider range of dates."
                      actionLabel="Show the last 30 days"
                      onAction={() => setRange(presetRange('last30', today))}
                    />
                  )
                ) : null}
                {data && data.entries.length > 0 ? (
                  <TablePager
                    className="border-t border-wds-border"
                    page={view.page}
                    perPage={view.perPage}
                    shown={data.entries.length}
                    total={data.pagination.total}
                    onPageChange={setPage}
                    onPerPageChange={(perPage) => patch({ perPage })}
                  />
                ) : null}
              </div>
            )}

            <p className={cn('font-wds-sans text-[12px] leading-4 text-wds-text-secondary', purchasing && 'hidden')}>
              Newest first. {rangeSentence(range, today)} Documents printed are not recorded here.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
