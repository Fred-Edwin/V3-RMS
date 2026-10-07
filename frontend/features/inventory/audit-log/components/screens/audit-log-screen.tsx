'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { PurchasingAuditPanel } from '../../../purchasing/components/purchasing-audit-panel';
import { Skeleton } from '@/components/ui2/skeleton';
import { TablePager } from '@/components/ui2/data-table/table-pager';
import { useTableUrlState } from '@/components/ui2/data-table/use-table-url-state';
import { Topbar } from '@/components/app/shell/topbar';
import { LoadingState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { StockEmptyCard, StockErrorCard } from '../../../_shared/components/stock-states';
import { FilterMenu, PageHeading } from '../../../suppliers/components/supplier-ui';
import { useAuditLog } from '../../hooks/use-audit-log';
import { AREA_LABEL, AREA_ORDER, PERIOD_LABEL, PERIOD_ORDER, periodSentence, whenLabel, type AuditPeriod } from '../../lib/audit-log-logic';
import type { AuditArea } from '../../types/audit-log';


/** The URL parameters this screen owns, next to `page` and `perPage`. */
const AUDIT_FILTER_KEYS = ['area', 'who', 'when'] as const;

const head = 'font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em] text-wds-text-ink';
const cols = {
  when: 'w-[110px] shrink-0',
  who: 'w-[140px] shrink-0 pr-3',
  area: 'w-[120px] shrink-0 pr-3',
  what: 'min-w-0 grow basis-0 pr-4',
  reason: 'w-[230px] shrink-0',
};

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex h-[30px] shrink-0 items-center whitespace-nowrap px-3 font-wds-sans text-[13px] leading-4 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:shadow-wds-ring',
        on ? 'bg-wds-text-ink font-medium text-white' : 'border border-wds-border-strong bg-white text-wds-text-ink hover:bg-wds-neutral-50'
      )}
    >
      {children}
    </button>
  );
}

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

/**
 * Audit log — Paper chapter 8, step 35. Every change in the Catalog, Suppliers and Restock levels, with who, when and why.
 * Read-only; the Store Manager, Accountant and Director read it.
 */
export function AuditLogScreen() {
  const { can, ready } = usePermissions();
  const canRead = can('audit.read');
  // Area, who, when, page and rows per page live in the URL (§4a), so refresh, Back and a pasted link keep the view.
  // "Today" is the default period, so it is the address with no `when`.
  const { query: view, patch, setPage } = useTableUrlState({ filterKeys: AUDIT_FILTER_KEYS });
  const area = (view.filters.area as AuditArea | undefined) ?? null;
  const actorId = view.filters.who ?? null;
  const period: AuditPeriod = PERIOD_ORDER.find((p) => p === view.filters.when) ?? 'TODAY';
  // "Purchasing and payments" is the purchase file's own log (Paper `23`), read from the same `GET /inventory/audit-log`. A link with ?q= (the closed purchase file's
  // "Everything") opens it already searching for that document.
  const query = useSearchParams().get('q');
  const [purchasing, setPurchasing] = React.useState(Boolean(query));

  const log = useAuditLog({ area, actorId, period, page: view.page, perPage: view.perPage }, canRead);
  const now = React.useMemo(() => new Date(), [period, log.data]); // eslint-disable-line react-hooks/exhaustive-deps -- "now" follows the data it labels
  const data = log.data;
  const actorName = data?.actors.find((a) => a.id === actorId)?.name ?? 'Everyone';

  const setArea = (v: AuditArea | null) => patch({ filters: { area: v ?? '' } });
  const setActorId = (v: string | null) => patch({ filters: { who: v ?? '' } });
  const setPeriod = (v: AuditPeriod) => patch({ filters: { when: v === 'TODAY' ? '' : v } });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: 'Central Store', screen: 'Audit log' }} hideSearch className="shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-8 py-7">
        <PageHeading title="Audit log">Every change and every fix, with who, when and why. Nothing here can be edited or removed.</PageHeading>
        {!ready ? (
          <div className="flex justify-center py-10">
            <LoadingState />
          </div>
        ) : !canRead ? (
          <PermissionDeniedState description="This page is not available for your role." />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip on={area === null && !purchasing} onClick={() => { setPurchasing(false); setArea(null); }}>
                Catalog, Suppliers, Restock levels
              </Chip>
              {AREA_ORDER.map((a) => (
                <Chip key={a} on={area === a && !purchasing} onClick={() => { setPurchasing(false); setArea(area === a ? null : a); }}>
                  {AREA_LABEL[a]}
                </Chip>
              ))}
              <Chip on={purchasing} onClick={() => setPurchasing(true)}>
                Purchasing and payments
              </Chip>
              {purchasing ? null : (
                <>
                  <FilterMenu<string>
                    name="Who"
                    valueLabel={actorName}
                    options={[{ value: null, label: 'Everyone' }, ...(data?.actors ?? []).map((a) => ({ value: a.id, label: a.name }))]}
                    onSelect={(v) => setActorId(v)}
                  />
                  <FilterMenu<AuditPeriod>
                    name="When"
                    valueLabel={PERIOD_LABEL[period]}
                    options={PERIOD_ORDER.map((p) => ({ value: p === 'TODAY' ? null : p, label: PERIOD_LABEL[p] }))}
                    onSelect={(v) => setPeriod(v ?? 'TODAY')}
                  />
                </>
              )}
            </div>

            {purchasing ? <PurchasingAuditPanel initialQuery={query ?? ''} /> : null}

            {purchasing ? null : log.status === 'error' ? (
              <StockErrorCard title="Couldn’t load the audit log" description={log.error ?? 'Could not load the audit log. Try again.'} onRetry={() => void log.reload()} />
            ) : (
              <div className="flex flex-col border border-wds-border bg-wds-surface" aria-busy={log.status === 'loading'}>
                <div className="flex h-[34px] shrink-0 items-center border-b border-wds-text-ink px-4" role="row">
                  <span className={cn(head, cols.when)}>When</span>
                  <span className={cn(head, cols.who)}>Who</span>
                  <span className={cn(head, cols.area)}>Area</span>
                  <span className={cn(head, cols.what)}>What</span>
                  <span className={cn(head, cols.reason)}>Reason</span>
                </div>
                {log.status === 'loading' || log.status === 'idle' ? (
                  <div role="status" aria-live="polite">
                    <span className="sr-only">Loading the audit log</span>
                    {Array.from({ length: 6 }, (_, i) => (
                      <RowSkeleton key={i} />
                    ))}
                  </div>
                ) : data && data.entries.length === 0 ? (
                  <StockEmptyCard
                    className="py-10"
                    title="Nothing was changed in this period"
                    description="Changes to the catalog, suppliers and restock levels show here as they happen."
                    actionLabel={period === 'ANY' ? undefined : 'Show any time'}
                    onAction={period === 'ANY' ? undefined : () => setPeriod('ANY')}
                  />
                ) : (
                  data?.entries.map((entry) => (
                    <div key={entry.id} className="flex min-h-11 items-center border-b border-wds-neutral-100 px-4 py-2 last:border-b-0" role="row">
                      <span className={cn('font-wds-mono text-[12px] leading-4 text-wds-text-secondary', cols.when)}>{whenLabel(entry.at, now)}</span>
                      <span className={cn('font-wds-sans text-[13px] leading-4 text-wds-text-ink', cols.who)}>{entry.actor.name}</span>
                      <span className={cn('font-wds-sans text-[13px] leading-4 text-wds-text-ink', cols.area)}>{AREA_LABEL[entry.area]}</span>
                      <span className={cn('font-wds-sans text-[13px] leading-[18px] text-wds-text-ink', cols.what)}>
                        {entry.what}
                        {entry.purchasing ? (
                          <>
                            {' '}
                            <Link href={`/app/inventory/purchasing/${entry.purchasing.orderId}`} className="font-medium text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring">
                              {entry.purchasing.orderReference ?? 'Open the order'}
                            </Link>
                          </>
                        ) : null}
                      </span>
                      <span className={cn('font-wds-sans text-[13px] leading-[18px]', cols.reason, entry.reason ? 'text-wds-text-secondary' : 'text-wds-text-faint')}>{entry.reason ?? '—'}</span>
                    </div>
                  ))
                )}
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
              Newest first. {periodSentence(period, now)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
