'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui2/button';
import { useAuthStore } from '@/store/authStore';

import { PageHeader, useRemote, useWorkforcePermissions, WorkforceFrame, WorkforceKpiStrip } from '../../../_shared';
import { LegendLine } from '../../_shared/components/legend-line';
import { longDate } from '../../_shared/lib/conduct-dates';
import { conductReads } from '../../_shared/services/conduct-services';
import type { DeskDetail, DeskList, DeskRow } from '../../_shared/types/conduct-types';
import { KPI_SUBTITLE, kpiCells } from '../lib/desk-model';
import { buildDeskFilters, DeskTable } from './desk-table';
import { DeskDialogs, type DeskDialog } from './desk-dialogs';
import { NoticeDetailPanel } from './notice-detail-panel';

/** "Conduct · Nyeri Town" for a manager, "Conduct · All sites" for HR and the Director (or the site they picked). */
function titleFor(siteName: string | null, picked: string | undefined, sites: { id: string; name: string }[] | null, readsAll: boolean): string {
  if (readsAll) return `Conduct · ${picked ? (sites?.find((s) => s.id === picked)?.name ?? 'One site') : 'All sites'}`;
  return `Conduct · ${siteName ?? 'your site'}`;
}

/**
 * Conduct for managers, HR and the Director (spec S8 and S12; Paper 1GB0-0, 1GYE-0): the title, four numbers, the table beside the chosen
 * notice. The chosen notice is in the address (`?id=`) so a link, a reload and the Inbox row all land on it. "Issue a warning" is the one
 * brown button and appears only for whoever may issue. Below 1100 px the panel goes under the list.
 */
export function DeskScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const permissions = useWorkforcePermissions();
  const siteName = useAuthStore((s) => s.user?.organizationName ?? null);
  const readsAll = permissions.ready && permissions.scopeOf('discipline.read') === 'all';
  const canIssue = permissions.ready && permissions.can('discipline.issue');
  const lookups = useRemote(() => conductReads.sites(), 'conduct-sites', readsAll);
  const [list, setList] = React.useState<DeskList | null>(null);
  const [dialog, setDialog] = React.useState<DeskDialog | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);
  const [note, setNote] = React.useState<string | null>(null);
  const today = React.useMemo(() => longDate(new Date()), []);

  const selectedId = params.get('id');
  const sites = lookups.data ?? null;
  const filters = React.useMemo(() => buildDeskFilters(readsAll ? sites : null), [readsAll, sites]);

  const setParam = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [params, pathname, router]
  );
  const select = React.useCallback((row: DeskRow) => setParam({ id: row.id }), [setParam]);
  const showAppeals = React.useCallback(() => setParam({ status: 'appealed', id: null, page: null }), [setParam]);
  const refresh = React.useCallback(() => setReloadToken((n) => n + 1), []);
  const onDone = React.useCallback(
    (message: string, noticeId?: string) => {
      setDialog(null);
      setNote(message);
      if (noticeId) setParam({ id: noticeId });
      refresh();
    },
    [refresh, setParam]
  );
  const onLoaded = React.useCallback((next: DeskList) => setList(next), []);
  const open = React.useCallback((kind: DeskDialog['kind']) => (detail: DeskDetail) => setDialog({ kind, detail }), []);

  const issue = canIssue ? (
    <Button size="default" onClick={() => setDialog({ kind: 'issue' })}>
      Issue a warning
    </Button>
  ) : null;

  return (
    <WorkforceFrame breadcrumb={{ section: 'People', screen: 'Conduct' }} phoneTitle="Conduct" label="Conduct" actions={issue}>
      <div className="flex w-full flex-col gap-5 px-wds-8 py-7 max-md:px-4">
        <PageHeader size="lg" title={titleFor(siteName, params.get('site') ?? undefined, sites, readsAll)} subtitle={`${today} · ${KPI_SUBTITLE}`} actions={issue ? <span className="lg:hidden">{issue}</span> : undefined} />
        {note ? (
          <p role="status" className="m-0 border border-wds-success-border bg-wds-success-bg px-4 py-2.5 font-wds-sans text-[14px] leading-[18px] text-wds-success-fg">
            {note}
          </p>
        ) : null}
        {list ? <WorkforceKpiStrip aria-label="Conduct numbers" cells={kpiCells(list.counts, list.nextEnding, showAppeals)} /> : null}
        <div className="flex min-w-0 flex-col gap-5 min-[1100px]:flex-row min-[1100px]:items-start">
          <div className="min-w-0 min-[1100px]:w-[500px] min-[1100px]:shrink-0">
            <DeskTable selectedId={selectedId} onSelect={select} filters={filters} counts={list?.counts ?? null} onLoaded={onLoaded} refreshToken={reloadToken} />
            <LegendLine />
          </div>
          <section aria-label="The chosen notice" className="min-w-0 flex-1 border border-wds-border bg-wds-surface">
            <NoticeDetailPanel id={selectedId} reloadToken={reloadToken} readsAll={readsAll} onRecord={open('record')} onDecide={open('decide')} onChange={open('change')} />
          </section>
        </div>
      </div>
      <DeskDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={onDone} />
    </WorkforceFrame>
  );
}
