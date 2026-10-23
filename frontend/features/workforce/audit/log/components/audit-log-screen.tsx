'use client';

import * as React from 'react';

import { TablePager } from '@/components/ui2/data-table/table-pager';
import { useWdsToastStore } from '@/store/wdsToastStore';

import { Callout, DialogButton, EmptyState, ErrorBlock, ListSkeleton, OfflineStrip, PageHeader, WorkforceFrame, useWorkforcePermissions } from '../../../_shared';
import { useExport } from '../hooks/use-audit-actions';
import { useAuditList } from '../hooks/use-audit-list';
import { useAuditQuery } from '../hooks/use-audit-query';
import { DEEP_PAGE } from '../lib/audit-query';
import { AUDIT_COPY, countWords, footerText, matchesLine } from '../lib/audit-words';
import type { AuditRow } from '../types/audit-log-types';
import { AuditFilters } from './audit-filters';
import { AuditTable } from './audit-table';
import { EntryDrawer } from './entry-drawer';

/**
 * The company Audit log (6a A1): the one log for every area. Read only. The view (search, area, event, site, dates, flagged, sort, page,
 * rows per page) is in the address bar; the drawer opens one entry; Export gives the CSV of exactly this view. What each reader sees is the
 * API's decision (facets and counts come from it), so nothing here knows a role.
 */
export function AuditLogScreen({ tabs }: { tabs?: React.ReactNode }) {
  const permissions = useWorkforcePermissions();
  const q = useAuditQuery();
  const { list, retry } = useAuditList(q.query, q.key);
  const exporter = useExport();
  const [open, setOpen] = React.useState<AuditRow | null>(null);
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    const sync = (): void => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  const data = list.data;
  const rows = data?.entries ?? [];
  const total = data?.total ?? 0;
  const exact = data?.totalIsExact ?? true;
  const exportReason = list.status === 'loading' ? null : rows.length === 0 ? AUDIT_COPY.exportNothing : !exact ? AUDIT_COPY.exportTooMany : null;

  const onExport = async (): Promise<void> => {
    if (await exporter.run(q.query)) useWdsToastStore.getState().addToast({ variant: 'success', title: 'Your file is ready.' });
  };

  let body: React.ReactNode;
  if (list.status === 'loading') body = <ListSkeleton rows={8} columns={[110, 150, 200, 'fill']} label="Loading the log" />;
  else if (list.status === 'error' && !data) {
    body = <ErrorBlock title={AUDIT_COPY.loadError} line={AUDIT_COPY.loadErrorLine} reference={list.error.code === 'NETWORK' ? undefined : list.error.code} onRetry={retry} />;
  } else if (rows.length === 0 && q.query.page > DEEP_PAGE) {
    body = <EmptyState kind="nothingFound" title={AUDIT_COPY.chooseDates} />;
  } else if (rows.length === 0) {
    body = q.filtered ? (
      <EmptyState kind="nothingFound" title={AUDIT_COPY.nothingFound} action={{ label: 'Clear filters', onClick: q.clear }} />
    ) : (
      <EmptyState kind="nothingYet" title={AUDIT_COPY.empty} />
    );
  } else {
    body = (
      <div className={list.status === 'ready' && !online ? 'opacity-60' : undefined}>
        <AuditTable rows={rows} term={q.query.q} openId={open?.id ?? null} page={data?.page ?? 1} total={countWords(total, exact)} onOpen={(row) => setOpen(row)} />
        <TablePager page={q.query.page} perPage={q.query.pageSize} shown={rows.length} total={total} onPageChange={q.goToPage} onPerPageChange={(n) => q.change({ pageSize: n as 25 | 50 | 100 })} />
        {/* The pager already shows the range; this line is drawn only over the cap, where it says how to narrow the count. */}
        <p role="status" className={`m-0 px-4 pt-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary${exact ? ' sr-only' : ''}`}>
          {footerText(data?.page ?? 1, data?.pageSize ?? q.query.pageSize, rows.length, total, exact)}
        </p>
        {data?.range.reachesArchive ? <p className="m-0 px-4 pt-1 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{AUDIT_COPY.archived}</p> : null}
      </div>
    );
  }

  const search = matchesLine(total, exact, q.query.q);
  const actions = (
    <div className="flex flex-col items-end gap-1">
      <DialogButton kind="cancel" size="lg" disabled={exporter.busy || list.status === 'loading' || exportReason !== null} onClick={() => void onExport()}>
        Export this view
      </DialogButton>
      {exportReason ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{exportReason}</span> : null}
    </div>
  );

  return (
    <WorkforceFrame breadcrumb={{ section: 'Settings', screen: AUDIT_COPY.title }} phoneTitle={AUDIT_COPY.title} label={AUDIT_COPY.title}>
      {!online ? <OfflineStrip stillWorks="The last page is kept below." /> : null}
      <div className="flex flex-col gap-4 px-8 py-7 max-sm:px-4">
        <PageHeader size="lg" title={AUDIT_COPY.title} subtitle={AUDIT_COPY.subtitle} actions={actions} />
        {tabs}
        {exporter.message ? <Callout tone={exporter.message === AUDIT_COPY.exportFailed ? 'error' : 'neutral'} role={exporter.message === AUDIT_COPY.exportFailed ? 'alert' : 'status'}>{exporter.message}</Callout> : null}
        <AuditFilters query={q.query} facets={data?.facets ?? null} today={q.today} onChange={q.change} />
        {search ? <p role="status" className="m-0 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{search}</p> : null}
        <div className="min-w-0">{body}</div>
      </div>
      <EntryDrawer row={open} canCheck={permissions.can('audit.verify_chain')} onClose={() => setOpen(null)} />
    </WorkforceFrame>
  );
}
