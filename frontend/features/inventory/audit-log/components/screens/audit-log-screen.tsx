'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { DemoBanner } from '../../../purchasing/components/demo-banner';
import { PurchasingAuditPanel } from '../../../purchasing/components/purchasing-audit-panel';
import { Button } from '@/components/ui2/button';
import { Skeleton } from '@/components/ui2/skeleton';
import { Topbar } from '@/components/app/shell/topbar';
import { LoadingState, PermissionDeniedState } from '@/components/app/shell/shell-states';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { StockEmptyCard, StockErrorCard } from '../../../_shared/components/stock-states';
import { FilterMenu, PageHeading } from '../../../suppliers/components/supplier-ui';
import { useAuditLog } from '../../hooks/use-audit-log';
import { AREA_LABEL, AREA_ORDER, PERIOD_LABEL, PERIOD_ORDER, periodSentence, whenLabel, type AuditPeriod } from '../../lib/audit-log-logic';
import type { AuditArea } from '../../types/audit-log';


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
  const [area, setArea] = React.useState<AuditArea | null>(null);
  const [actorId, setActorId] = React.useState<string | null>(null);
  const [period, setPeriod] = React.useState<AuditPeriod>('TODAY');
  const [page, setPage] = React.useState(1);
  // "Purchasing and payments" is the Purchasing mock's own log (Paper `23`). A link with ?q= (the closed purchase file's
  // "Everything") opens it already searching for that document.
  const query = useSearchParams().get('q');
  const [purchasing, setPurchasing] = React.useState(Boolean(query));

  const log = useAuditLog({ area, actorId, period, page }, canRead);
  const now = React.useMemo(() => new Date(), [period, log.data]); // eslint-disable-line react-hooks/exhaustive-deps -- "now" follows the data it labels
  const data = log.data;
  const actorName = data?.actors.find((a) => a.id === actorId)?.name ?? 'Everyone';

  const reset = <T,>(set: (v: T) => void) => (value: T) => {
    set(value);
    setPage(1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Topbar breadcrumb={{ section: 'Central Store', screen: 'Audit log' }} hideSearch className="shrink-0" />
      {purchasing ? <DemoBanner /> : null}
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
              <Chip on={area === null && !purchasing} onClick={() => { setPurchasing(false); reset(setArea)(null); }}>
                Catalog, Suppliers, Restock levels
              </Chip>
              {AREA_ORDER.map((a) => (
                <Chip key={a} on={area === a && !purchasing} onClick={() => { setPurchasing(false); reset(setArea)(area === a ? null : a); }}>
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
                    onSelect={(v) => reset(setActorId)(v)}
                  />
                  <FilterMenu<AuditPeriod>
                    name="When"
                    valueLabel={PERIOD_LABEL[period]}
                    options={PERIOD_ORDER.map((p) => ({ value: p === 'TODAY' ? null : p, label: PERIOD_LABEL[p] }))}
                    onSelect={(v) => reset(setPeriod)(v ?? 'TODAY')}
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
                    onAction={period === 'ANY' ? undefined : () => reset(setPeriod)('ANY')}
                  />
                ) : (
                  data?.entries.map((entry) => (
                    <div key={entry.id} className="flex min-h-11 items-center border-b border-wds-neutral-100 px-4 py-2 last:border-b-0" role="row">
                      <span className={cn('font-wds-mono text-[12px] leading-4 text-wds-text-secondary', cols.when)}>{whenLabel(entry.at, now)}</span>
                      <span className={cn('font-wds-sans text-[13px] leading-4 text-wds-text-ink', cols.who)}>{entry.actor.name}</span>
                      <span className={cn('font-wds-sans text-[13px] leading-4 text-wds-text-ink', cols.area)}>{AREA_LABEL[entry.area]}</span>
                      <span className={cn('font-wds-sans text-[13px] leading-[18px] text-wds-text-ink', cols.what)}>{entry.what}</span>
                      <span className={cn('font-wds-sans text-[13px] leading-[18px]', cols.reason, entry.reason ? 'text-wds-text-secondary' : 'text-wds-text-faint')}>{entry.reason ?? '—'}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className={cn('flex items-center justify-between gap-4', purchasing && 'hidden')}>
              <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                {data && data.entries.length > 0 ? `${data.pagination.total} ${data.pagination.total === 1 ? 'entry' : 'entries'}. ` : ''}
                {periodSentence(period, now)}
              </p>
              {data && data.pagination.totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Newer
                  </Button>
                  <span className="font-wds-mono text-[12px] text-wds-text-secondary">
                    {page} of {data.pagination.totalPages}
                  </span>
                  <Button variant="secondary" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                    Older
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
