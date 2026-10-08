'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { DataTable } from '@/components/ui2/data-table/data-table';
import { ScwKpiStrip, ScwKpiStripSkeleton } from '../../../_shared/components/scw-kpi-strip';
import { ScwStatePanel } from '../../../_shared/components/scw-states';
import { ScwTopbar } from '../../../_shared/components/scw-topbar';
import { useLoader } from '../../../_shared/hooks/use-async';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { COUNTING_STATES_COPY } from '../../_shared/lib/states-copy';
import { countingApi } from '../../_shared/services/counting-api';
import type { CountRow } from '../../_shared/types/counting-contract';
import { COUNTS, COUNTS_COPY, COUNTS_FILTERS, makeCountColumns } from './counts-columns';

/**
 * Counts (Paper steps 8 and 48, `1X6I-0`, `25F8-0`), for every desktop role. A summary strip, status chips (a strip cell with a
 * filter sets the same chip), and the table of every count with search, a numbered pager and rows per page, all in the URL. Write
 * controls appear only when the server says the person may use them: Start count (`counts.record`), Review on a row (the row's
 * own `can.review`), Log waste (`waste.log`). "Unsectioned N →" opens Count setup's Add items drawer.
 */
export function CountsListScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { can, ready } = usePermissions();
  const summary = useLoader('counts-summary', () => countingApi.summary('manager'), COUNTING_STATES_COPY.countsList.error);
  const [unsectioned, setUnsectioned] = React.useState<number | null>(null);
  const status = params.get('status') ?? '';

  const setStatus = React.useCallback(
    (value: string): void => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set('status', value);
      else next.delete('status');
      next.delete('page');
      router.replace(`${COUNTS}${next.toString() ? `?${next}` : ''}`, { scroll: false });
    },
    [params, router],
  );

  const columns = React.useMemo(() => makeCountColumns((href) => router.push(href)), [router]);

  if (ready && !can('counts.read')) {
    return <ScwStatePanel kind="permission" text={COUNTING_STATES_COPY.countsList.permission} className="m-8" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScwTopbar
        breadcrumb={{ section: 'Central Store', screen: 'Counts' }}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href={`${COUNTS}/setup`}>Count setup</Link>
            </Button>
            {can('waste.log') ? (
              <Button variant="secondary" asChild>
                <Link href="/app/inventory/stock/waste?drawer=log">Log waste</Link>
              </Button>
            ) : null}
            {can('counts.record') ? (
              <Button asChild>
                <Link href={`${COUNTS}/new`}>Start count</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-wds-sans text-wds-mobile-title tracking-tight text-wds-text-ink">Counts</h1>
          <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">Every count, from the first number to the signed record.{can('counts.record') ? ' Start one any time.' : ''}</p>
        </div>
        {summary.data ? (
          <ScwKpiStrip cells={summary.data.kpis} activeFilter={status} onFilter={(f) => setStatus(status === f ? '' : f)} />
        ) : summary.status === 'error' ? null : (
          <ScwKpiStripSkeleton />
        )}
        {unsectioned !== null && unsectioned > 0 ? (
          <div className="-mb-2 flex justify-end">
            <Link
              href={`${COUNTS}/setup?drawer=add-items`}
              className="border border-wds-warning-border bg-wds-warning-bg px-[11px] py-1.5 font-wds-sans text-[12px] leading-4 text-wds-warning-fg outline-none transition-colors hover:bg-wds-caramel-100 focus-visible:shadow-wds-ring"
            >
              Unsectioned {unsectioned} →
            </Link>
          </div>
        ) : null}
        <DataTable<CountRow>
          label="Counts"
          columns={columns}
          getRowId={(r) => r.id}
          filters={COUNTS_FILTERS}
          copy={COUNTS_COPY}
          searchPlaceholder="Search a count, section or person"
          enabled={ready}
          onRowActivate={(r) => router.push(r.status === 'OPEN' && r.mine ? `${COUNTS}/${r.id}/count` : `${COUNTS}/${r.id}`)}
          rowClassName={(r) => (r.can.review ? 'bg-wds-warning-bg' : undefined)}
          fetchRows={async (q, { signal }) => {
            const res = await countingApi.list({ status: (q.filters.status as 'waiting' | 'inProgress' | 'approved' | undefined) ?? 'all', search: q.search || undefined, page: q.page, pageSize: q.perPage as 25 | 50 | 100 }, signal);
            setUnsectioned(res.chips.unsectioned);
            return {
              rows: res.rows,
              total: res.page.total,
              counts: { status: { '': res.chips.all, waiting: res.chips.waiting, inProgress: res.chips.inProgress, approved: res.chips.approved } },
            };
          }}
        />
      </main>
    </div>
  );
}
