'use client';

import * as React from 'react';

import { DataTable, type TableColumn, type TableCopy } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { Picker } from '@/components/ui2/picker';
import { cn } from '@/lib/cn';
import { formatApiErrorMessage } from '@/types/api';
import { useAuthStore } from '@/store/authStore';

import { useOrgOverview } from '../../../people';
import { Callout, DialogButton, ErrorBlock, FOCUS_RING, ListSkeleton, PageHeader, SHIFT_PAINT, WorkforceFrame, WorkforceKpiStrip, useWorkforcePermissions } from '../../../_shared';
import { useTemplates } from '../../_shared/hooks/use-rota-data';
import { mondayOf, nairobiToday, weekShortRange } from '../../_shared/lib/rota-dates';
import { breakWords, hoursUnit, timeRangeMono, toneOfColour, usedByWords } from '../../_shared/lib/shift-look';
import { rotaWrites } from '../../_shared/services/rota-services';
import type { TemplateView } from '../../_shared/types/rota-types';
import { RefusalScreen } from '../../../refusal';
import { firstSite, rememberSite, rememberedSite } from '../../_shared/lib/last-site';
import { mayEdit, retiredWords, templateCounts, templateRows } from '../lib/template-rows';
import { TemplateDialog } from './template-dialog';

const COPY: TableCopy = {
  emptyTitle: 'No shifts yet',
  emptyDescription: 'Add the first shift and it appears in every Shifts cell.',
  filteredEmptyTitle: 'No shift matches',
  filteredEmptyDescription: 'Try a different name, or clear the filters.',
  errorTitle: 'The shifts did not load',
  errorDescription: 'Check your connection and try again.',
};

const THIS_WEEK = mondayOf(nairobiToday());

/** Shift templates (Paper steps 6 and 7): where the rota's shifts are defined. Break and paid hours live here, so every rota counts them the same way. */
export function TemplatesScreen() {
  const perms = useWorkforcePermissions();
  const user = useAuthStore((s) => s.user);
  const canWrite = perms.can('rota.template_write');
  const writesAllSites = perms.scopeOf('rota.template_write') === 'all';
  const readsAllSites = perms.scopeOf('rota.read') === 'all';
  const overview = useOrgOverview(false, perms.ready);
  // The Central Store has no shifts, so it is not offered; the screen opens on the branch looked at last, else the first branch.
  const sites = (overview.data?.organizations ?? []).filter((s) => s.type === 'BRANCH');
  const [siteChoice, setSiteChoice] = React.useState<string | null>(null);
  const [remembered] = React.useState(rememberedSite);
  const siteId = readsAllSites ? (siteChoice ?? firstSite(sites, remembered)) : (user?.organizationId ?? undefined);
  const site = sites.find((s) => s.id === siteId);
  const siteName = site?.name ?? user?.organizationName ?? 'this site';
  const templates = useTemplates(readsAllSites ? siteId : undefined, THIS_WEEK, true, perms.ready && perms.can('rota.read') && (!readsAllSites || siteId !== undefined));
  const [editing, setEditing] = React.useState<TemplateView | 'new' | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const data = templates.data;
  // The table reloads its page whenever new shifts arrive (after a save, a retire or a restore).
  const version = React.useRef({ data, count: 0 });
  if (version.current.data !== data) version.current = { data, count: version.current.count + 1 };

  const restore = async (t: TemplateView): Promise<void> => {
    setFailed(null);
    try {
      await rotaWrites.restoreTemplate(t.id);
      setNotice(`${t.name} was restored.`);
      templates.reload();
    } catch (err) {
      setFailed(formatApiErrorMessage(err, 'That did not go through. Nothing was changed.'));
    }
  };

  const filters: TableFilter[] = React.useMemo(
    () => [{ kind: 'chips', key: 'view', options: [{ value: '', label: 'All' }, { value: 'company', label: 'Company-wide' }, { value: 'site', label: `${siteName} only` }, { value: 'retired', label: 'Show retired' }] }],
    [siteName]
  );

  const columns: TableColumn<TemplateView>[] = [
    {
      id: 'shift',
      header: 'SHIFT',
      cell: (t, { term }) => (
        <span className="flex items-center gap-3">
          <span aria-hidden className={cn('h-3.5 w-3.5 shrink-0 border', SHIFT_PAINT[toneOfColour(t.colour)].chip)} />
          <span className={cn('flex flex-col', !t.isActive && 'text-wds-text-secondary')}>
            <span className="font-wds-sans text-[14px] leading-[18px]">
              <HighlightMatch text={t.name} term={term} />
            </span>
            <span className={cn('font-wds-sans text-[12px] leading-4', t.isActive && t.organizationId !== null ? 'text-wds-info-fg' : 'text-wds-text-secondary')}>
              {!t.isActive ? retiredWords(t.retiredAt) : t.organizationId === null ? 'Company-wide' : `${siteName} only`}
            </span>
          </span>
        </span>
      ),
    },
    { id: 'time', header: 'TIME', width: '150px', cell: (t) => <span className={cn('font-wds-mono text-[13px]', !t.isActive && 'text-wds-text-secondary')}>{timeRangeMono(t)}</span> },
    { id: 'break', header: 'UNPAID BREAK', align: 'right', width: '130px', cell: (t) => <span className="font-wds-mono text-[13px]">{t.unpaidBreakMinutes === 0 ? '0 min' : breakWords(t.unpaidBreakMinutes)}</span> },
    { id: 'paid', header: 'PAID HOURS', align: 'right', width: '110px', cell: (t) => <span className="font-wds-mono text-[13px]">{hoursUnit(t.paidMinutes)}</span> },
    { id: 'used', header: 'USED BY', cell: (t) => <span className="font-wds-sans text-[13px] text-wds-text-ink">{t.isActive ? usedByWords(t) : 'Not used'}</span> },
    { id: 'week', header: 'THIS WEEK', align: 'right', width: '100px', cell: (t) => <span className="font-wds-mono text-[13px]">{t.thisWeek}</span> },
    {
      id: 'action',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '90px',
      cell: (t) =>
        mayEdit(t, canWrite, writesAllSites) ? (
          <button type="button" onClick={() => (t.isActive ? setEditing(t) : void restore(t))} className={cn('font-wds-sans text-[13px] leading-4 text-wds-primary', FOCUS_RING)} aria-label={`${t.isActive ? 'Edit' : 'Restore'} ${t.name}`}>
            {t.isActive ? 'Edit' : 'Restore'}
          </button>
        ) : null,
    },
  ];

  const frame = (body: React.ReactNode) => (
    <WorkforceFrame
      breadcrumb={{ section: 'Schedule', screen: 'Shift templates' }}
      phoneTitle="Shift templates"
      label="Shift templates"
      actions={canWrite ? <DialogButton kind="primary" size="lg" onClick={() => setEditing('new')}>Add shift</DialogButton> : undefined}
    >
      {body}
    </WorkforceFrame>
  );

  if (!perms.ready && !perms.failed) return frame(<ListSkeleton rows={6} label="Loading the shifts" className="m-8" />);
  if (perms.failed) return frame(<ErrorBlock title="We could not load this" line="Your permissions did not load. Nothing was changed." onRetry={perms.retry} className="m-8" />);
  if (!perms.can('rota.read')) return <RefusalScreen from="/app/workforce/schedule/templates" />;
  if (templates.status === 'error' && !data) return frame(<ErrorBlock title="We could not load this" line={templates.error.message} reference={templates.error.code} onRetry={templates.reload} className="m-8" />);
  if (!data) return frame(<ListSkeleton rows={6} label="Loading the shifts" className="m-8" />);

  const active = data.filter((t) => t.isActive);
  const companyWide = active.filter((t) => t.organizationId === null).length;
  const taken = new Set(data.flatMap((t) => (t.letter ? [t.letter] : [])));
  const departments = (site?.departments ?? []).filter((d) => d.isActive).map((d) => ({ id: d.id, name: d.name }));

  return frame(
    <div className="flex flex-col gap-5 px-8 pb-10 pt-7">
      <PageHeader
        title="Shift templates"
        subtitle="The shifts you can put on the grid. Break and paid hours live here, so every week and payslip counts them the same way."
        // The desktop top bar carries this button from 1024 px; below that the page does.
        actions={canWrite ? <DialogButton kind="primary" size="lg" className="lg:hidden" onClick={() => setEditing('new')}>Add shift</DialogButton> : undefined}
      />
      {readsAllSites ? (
        <div className="flex items-center gap-3">
          <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">SITE</span>
          <Picker aria-label="Site" value={siteId ?? ''} onValueChange={(id) => { rememberSite(id); setSiteChoice(id); }} chips={false} className="h-8 w-[200px]" options={sites.map((s) => ({ value: s.id, label: s.name }))} />
        </div>
      ) : null}
      <WorkforceKpiStrip
        aria-label="Shifts at a glance"
        cells={[
          { key: 'use', label: 'IN USE', value: String(active.length), detail: `${companyWide} company-wide, ${active.length - companyWide} for ${siteName}` },
          { key: 'week', label: "SHIFTS PLANNED THIS WEEK", value: String(data.reduce((n, t) => n + t.thisWeek, 0)), detail: `${siteName}, ${weekShortRange(THIS_WEEK)}` },
          { key: 'retired', label: 'RETIRED', value: String(data.length - active.length), detail: 'kept so past weeks still read correctly' },
        ]}
      />
      {notice ? (
        <Callout tone="success" role="status" size="sm" action={<button type="button" onClick={() => setNotice(null)} className={cn('font-wds-sans text-[13px] text-wds-primary', FOCUS_RING)}>Dismiss</button>} actionAt="end">
          {notice}
        </Callout>
      ) : null}
      {failed ? (
        <Callout tone="error" role="alert" size="sm">
          {failed}
        </Callout>
      ) : null}
      <DataTable<TemplateView>
        label="Shift templates"
        columns={columns}
        getRowId={(t) => t.id}
        filters={filters}
        counts={templateCounts(data)}
        copy={COPY}
        searchPlaceholder="Find a shift"
        tableLook="workforce"
        className="border-0 bg-transparent"
        refreshToken={version.current.count}
        fetchRows={async (q) => templateRows(data, q)}
      />
      <p className="m-0 font-wds-sans text-[13px] leading-5 text-wds-text-secondary">
        HR and the Director edit company-wide shifts. A Branch Manager can add shifts for their own site only. Changing times affects future shifts only; past shifts keep their times, and staff with an affected shift are told. A shift is retired, never deleted.
      </p>
      {editing ? (
        <TemplateDialog
          template={editing === 'new' ? null : editing}
          siteId={siteId ?? null}
          siteName={siteName}
          departments={departments}
          canCompanyWide={writesAllSites}
          takenLetters={taken}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
            templates.reload();
          }}
        />
      ) : null}
    </div>
  );
}
