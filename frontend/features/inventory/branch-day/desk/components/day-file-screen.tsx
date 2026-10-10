'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { DataTable, type TableColumn } from '@/components/ui2/data-table/data-table';
import { Skeleton } from '@/components/ui2/skeleton';
import { LoadingAnnouncer, ScwStatePanel } from '../../../_shared/components/scw-states';
import { Chip, RefLink } from '../../../_shared/components/block2-phone-parts';
import { useLoader } from '../../../_shared/hooks/use-async';
import { BRANCH_DAY_BUTTONS, BRANCH_DAY_MESSAGES, BRANCH_DAY_STATES_COPY, dayStatusChip } from '../../_shared/lib/branch-day-copy';
import type { CorrectCountResult, DayActivityEntry, DayDocument, DayFile, DayStatus, DepartmentFigures } from '../../_shared/types/branch-day-contract';
import { useDayAccess, useDayBase } from '../hooks/use-day-access';
import { clock12, longDay, shortDay, shortDayClock, weekdayClock } from '../lib/desk-format';
import { dayPaths } from '../lib/desk-paths';
import { branchDayDeskApi } from '../services/branch-day-desk-api';
import { CorrectCountDrawer, type CorrectionTarget } from './correct-drawer';
import { DayTopbar } from './day-topbar';
import { CheckDisc, PRESS } from './day-parts';
import { DepartmentRail, DepartmentSelect, FiguresTable } from './department-pane';
import { DayTracker, FileTabs, type FileTab } from './file-tabs';

type TabId = 'items' | 'documents' | 'activity';
const TABS: readonly TabId[] = ['items', 'documents', 'activity'];
const STATUS_TONE: Record<DayStatus, 'info' | 'success' | 'warning'> = { OPEN: 'info', CLOSED: 'success', CORRECTED: 'warning' };
const PANEL = 'day-file-panel';
const SECONDARY_BUTTON = `${PRESS} inline-flex items-center justify-center whitespace-nowrap border border-wds-border-strong bg-wds-surface font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink outline-none focus-visible:shadow-wds-ring [@media(hover:hover)]:hover:bg-wds-neutral-50`;

/**
 * Block 4, desktop: the closed day file (Paper B11 Items, B12b Activity, B13 Documents). Tabs and the department live in the URL
 * (`?tab=&dept=`). Correct a count (B12) is for the holder of `branch_day.correct` only, hidden for everyone else; Print the day sheet is for
 * every desktop role on every tab. An open day has no file: it goes to Today (gap G11).
 */
export function DayFileScreen({ dayId }: { dayId: string }) {
  const access = useDayAccess();
  if (access.failed) return <ScwStatePanel kind="error" text={BRANCH_DAY_STATES_COPY.dayFile.error} className="m-8" />;
  if (!access.ready) return <FileSkeleton />;
  if (access.view === 'none') return <ScwStatePanel kind="permission" text={BRANCH_DAY_STATES_COPY.today.permission} className="m-8" />;
  return <DayFileView dayId={dayId} everyBranch={access.view === 'all'} seesMoney={access.seesMoney} canCorrect={access.canCorrect} />;
}

function FileSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-8" aria-hidden="true">
      <LoadingAnnouncer text={BRANCH_DAY_STATES_COPY.dayFile.loading} />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

function DayFileView({ dayId, everyBranch, seesMoney, canCorrect }: { dayId: string; everyBranch: boolean; seesMoney: boolean; canCorrect: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const base = useDayBase();
  const paths = dayPaths(base);
  const file = useLoader<DayFile>(`file:${dayId}`, () => branchDayDeskApi.dayFile(dayId), BRANCH_DAY_STATES_COPY.dayFile.error);
  const [correctOpen, setCorrectOpen] = React.useState(false);
  const [target, setTarget] = React.useState<CorrectionTarget | null>(null);
  const [posted, setPosted] = React.useState<string | null>(null);
  const [staleNote, setStaleNote] = React.useState<string | null>(null);
  const opener = React.useRef<HTMLButtonElement>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);

  const raw = params.get('tab');
  const tab: TabId = TABS.find((t) => t === raw) ?? 'items';
  const setTab = React.useCallback(
    (next: TabId): void => {
      const q = new URLSearchParams(params.toString());
      q.set('tab', next);
      q.delete('page');
      q.delete('perPage');
      router.replace(`?${q.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const data = file.data;
  // An open day has no file (gap G11): Today is its page.
  React.useEffect(() => {
    if (data && data.day.status === 'OPEN') router.replace(paths.today(everyBranch ? data.branch.id : undefined));
  }, [data, router, paths, everyBranch]);

  if (file.status === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DayTopbar breadcrumb={{ root: everyBranch ? 'Branches / Day' : 'Branch / Day', section: 'History', sectionHref: paths.history, screen: '…' }} />
        <ScwStatePanel kind="error" text={BRANCH_DAY_STATES_COPY.dayFile.error} onRetry={() => void file.reload()} className="m-8" />
      </div>
    );
  }
  if (!data || data.day.status === 'OPEN') return <FileSkeleton />;

  const closedBy = data.tracker.closed.by;
  const windowPassed = canCorrect && !data.can.correct;
  const tabs: FileTab<TabId>[] = [
    { id: 'items', label: 'Items' },
    { id: 'documents', label: 'Documents', count: data.tabCounts.documents },
    { id: 'activity', label: 'Activity', count: data.tabCounts.activity },
  ];
  const trackerItems = [
    `Openings checked · ${data.tracker.openingsChecked.checked} of ${data.tracker.openingsChecked.total}`,
    `Counted · ${data.tracker.counted.counted} of ${data.tracker.counted.total}${data.tracker.counted.lastAt ? ` by ${clock12(data.tracker.counted.lastAt)}` : ''}`,
    `Closed ${data.tracker.closed.at ? clock12(data.tracker.closed.at) : ''} · signed by ${closedBy?.roleLabel === 'Branch Manager' ? 'the Branch Manager' : (closedBy?.name ?? 'the Branch Manager')}`,
  ];
  const chip = canCorrect ? (windowPassed ? 'Corrections are closed: tomorrow’s opening has been accepted' : BRANCH_DAY_MESSAGES.correctionRule().replace(/\.$/, '')) : null;

  const afterCorrection = (result: CorrectCountResult): void => {
    setCorrectOpen(false);
    const change = result.line.correction;
    setPosted(
      BRANCH_DAY_MESSAGES.correctionPosted(clock12(result.entry.at), result.line.itemName, change ? String(Number(change.fromClosingQty)) : '', change ? String(Number(change.toClosingQty)) : (result.line.closingQty ?? ''), Number(result.usedValueKes).toLocaleString('en-KE', { maximumFractionDigits: 0 })),
    );
    void file.reload();
    setTab('activity');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DayTopbar breadcrumb={{ root: everyBranch ? 'Branches / Day' : 'Branch / Day', section: 'History', sectionHref: paths.history, screen: data.day.reference }} />
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-8 pb-10 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 ref={titleRef} tabIndex={-1} className="m-0 font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink outline-none">
                {longDay(data.day.date)}
              </h1>
              <Chip spec={{ text: dayStatusChip(data.day.status), tone: STATUS_TONE[data.day.status], dot: true }} dotShape="square" size="default" />
            </div>
            <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-text-secondary">
              {data.branch.name} · <RefLink reference={data.day.reference} href={paths.file(dayId)} className="text-[14px]" />
            </p>
          </div>
          <Link href={paths.print(dayId)} target="_blank" rel="noopener" className={cn(SECONDARY_BUTTON, 'h-10 px-[18px]')}>
            {BRANCH_DAY_BUTTONS.printSheet}
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </div>

        <DayTracker items={trackerItems} chip={chip} />
        {staleNote ? <p role="alert" className="m-0 border border-wds-warning-border bg-wds-warning-bg px-4 py-3 font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg">{staleNote}</p> : null}

        <FileTabs tabs={tabs} active={tab} onChange={setTab} panelId={PANEL} label="Day file" />
        <div role="tabpanel" id={PANEL} aria-labelledby={`${PANEL}-tab-${tab}`} className="flex min-h-0 flex-col gap-4">
          {tab === 'items' ? (
            <ItemsTab
              dayId={dayId}
              file={data}
              seesMoney={seesMoney}
              canCorrectNow={canCorrect && data.can.correct}
              openerRef={opener}
              onCorrect={(t) => {
                setTarget(t);
                setCorrectOpen(true);
              }}
            />
          ) : tab === 'documents' ? (
            <DocumentsTab dayId={dayId} reference={data.day.reference} />
          ) : (
            <ActivityTab dayId={dayId} note={posted} />
          )}
        </div>
      </main>

      <CorrectCountDrawer
        dayId={dayId}
        reference={data.day.reference}
        referenceHref={paths.file(dayId)}
        rail={data.rail.map((t) => ({ departmentId: t.departmentId, name: t.name }))}
        initial={target}
        open={correctOpen}
        onOpenChange={(open) => {
          setCorrectOpen(open);
          if (!open) window.setTimeout(() => (opener.current ?? titleRef.current)?.focus(), 0);
        }}
        onCorrected={(result) => {
          afterCorrection(result);
          window.setTimeout(() => titleRef.current?.focus(), 0);
        }}
        onStale={(message) => {
          setCorrectOpen(false);
          setStaleNote(message);
          void file.reload();
        }}
      />
    </div>
  );
}

// --- Items (B11) -----------------------------------------------------------------------------------------------------

function ItemsTab({ dayId, file, seesMoney, canCorrectNow, openerRef, onCorrect }: {
  dayId: string;
  file: DayFile;
  seesMoney: boolean;
  canCorrectNow: boolean;
  openerRef: React.RefObject<HTMLButtonElement>;
  onCorrect: (target: CorrectionTarget) => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const deptParam = params.get('dept');
  const deptId = file.rail.find((t) => t.departmentId === deptParam)?.departmentId ?? file.rail[0]?.departmentId ?? null;
  const figures = useLoader<DepartmentFigures>(deptId ? `fig:${dayId}:${deptId}` : null, () => branchDayDeskApi.figures(dayId, deptId ?? ''), BRANCH_DAY_STATES_COPY.figures.error);
  const hrefFor = React.useCallback(
    (id: string): string => {
      const q = new URLSearchParams(params.toString());
      q.set('tab', 'items');
      q.set('dept', id);
      return `?${q.toString()}`;
    },
    [params],
  );
  // Reload the figures when the file reloads after a correction.
  const corrections = file.lastCorrection?.at ?? '';
  const reload = figures.reload;
  React.useEffect(() => {
    void reload();
  }, [corrections, reload]);

  if (!deptId) return <ScwStatePanel kind="empty" text="This day has no departments." />;
  if (figures.status === 'error') return <ScwStatePanel kind="error" text={BRANCH_DAY_STATES_COPY.figures.error} onRetry={() => void figures.reload()} />;
  const data = figures.data;
  const department = data?.department;
  const countedBy = department?.countedBy ? (department.onBehalf ? `${department.countedBy.name} on behalf of the department` : department.countedBy.name) : null;
  const firstLine = department?.lines.find((l) => l.closingQty !== null) ?? null;

  return (
    <div className="flex min-h-[420px] border-t border-wds-text-ink">
      <DepartmentRail rail={file.rail} selectedId={deptId} hrefFor={hrefFor} showMoney={seesMoney && file.usedValueKes !== undefined} branchTotal={file.usedValueKes} />
      <section aria-label={`${department?.name ?? 'Department'} figures`} className="flex min-w-0 grow flex-col">
        <DepartmentSelect rail={file.rail} selectedId={deptId} onSelect={(id) => router.replace(hrefFor(id), { scroll: false })} />
        {!department ? (
          <div className="flex flex-col gap-3 px-5 py-4" aria-hidden="true">
            <Skeleton className="h-6 w-40" />
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-5 py-4" aria-busy={figures.status === 'loading'}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <h2 className="m-0 font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink">{department.name}</h2>
                <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
                  {department.countedAt ? `Counted by ${countedBy} at ${clock12(department.countedAt)} · signed with PIN` : 'This department did not count.'}
                </p>
              </div>
              {canCorrectNow && firstLine ? (
                <Button ref={openerRef} size="md" shape="square" onClick={() => onCorrect({ departmentId: department.id, departmentName: department.name, line: firstLine })}>
                  {BRANCH_DAY_BUTTONS.correctCount}
                </Button>
              ) : null}
            </div>
            <FiguresTable figures={department} showMoney={seesMoney && department.totals !== undefined} />
          </div>
        )}
      </section>
    </div>
  );
}

// --- Documents (B13) -------------------------------------------------------------------------------------------------

const DOC_HEAD = 'pb-2.5 font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.06em] text-wds-text-secondary';

function DocumentsTab({ dayId, reference }: { dayId: string; reference: string }) {
  const paths = dayPaths(useDayBase());
  const docs = useLoader<DayDocument[]>(`docs:${dayId}`, async () => (await branchDayDeskApi.documents(dayId)).documents, BRANCH_DAY_STATES_COPY.documents.error);
  if (docs.status === 'error') return <ScwStatePanel kind="error" text={BRANCH_DAY_STATES_COPY.documents.error} onRetry={() => void docs.reload()} />;
  if (!docs.data) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (docs.data.length === 0) return <ScwStatePanel kind="empty" text={BRANCH_DAY_STATES_COPY.documents.empty} />;
  return (
    <table className="w-full table-fixed border-collapse" aria-label="Day sheets">
      <colgroup>
        <col />
        <col className="w-[70px]" />
        <col className="w-[200px]" />
        <col className="w-[146px]" />
      </colgroup>
      <thead>
        <tr className="border-b border-wds-text-ink">
          <th scope="col" className={cn(DOC_HEAD, 'pl-2 pr-4 text-left')}>Document</th>
          <th scope="col" className={cn(DOC_HEAD, 'pr-4 text-left')}>Pages</th>
          <th scope="col" className={cn(DOC_HEAD, 'pr-4 text-left')}>Made</th>
          <th scope="col" className={DOC_HEAD}><span className="sr-only">Print</span></th>
        </tr>
      </thead>
      <tbody>
        {docs.data.map((d) => {
          const corrected = d.kind === 'AFTER_CORRECTION';
          return (
            <tr key={d.id} className={cn('border-b border-wds-border', d.latest && 'bg-wds-caramel-100')}>
              <td className="py-4 pl-2 pr-4 align-middle">
                <div className="flex flex-col gap-[3px]">
                  <span className="flex flex-wrap items-center gap-2.5">
                    <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">Day sheet</span>
                    <RefLink reference={reference} href={paths.file(dayId)} className="text-[13px] leading-4" />
                    {d.latest && corrected ? (
                      <span className="border border-wds-warning-border bg-wds-warning-bg px-2 py-px font-wds-sans text-[12px] leading-4 text-wds-warning-fg">Latest · includes the correction</span>
                    ) : (
                      <span className="border border-wds-border-strong bg-wds-surface px-2 py-px font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{corrected ? `Version ${d.version}` : 'At the close'}</span>
                    )}
                  </span>
                  <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
                    {d.latest ? 'Every department’s figures, who counted and signed, and the Branch Manager’s signature' : `As signed on ${shortDay(d.madeAt.slice(0, 10))}, before the correction. Kept on file.`}
                  </span>
                </div>
              </td>
              <td className="pr-4 align-middle font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">{d.pages}</td>
              <td className="pr-4 align-middle font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{shortDayClock(d.madeAt)}</td>
              <td className="pr-2 text-right align-middle">
                <Link href={paths.print(dayId, d.version)} target="_blank" rel="noopener" className={cn(SECONDARY_BUTTON, 'h-9 w-[130px]')}>
                  Print<span className="sr-only"> version {d.version} (opens in a new tab)</span>
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// --- Activity (B12b) -------------------------------------------------------------------------------------------------

const ACTIVITY_COPY = {
  emptyTitle: 'Nothing yet',
  emptyDescription: 'Nothing has happened on this day yet.',
  filteredEmptyTitle: 'Nothing yet',
  filteredEmptyDescription: 'Nothing has happened on this day yet.',
  errorTitle: 'Could not load the activity',
  errorDescription: 'Could not load the activity. Try again.',
};

function ActivityTab({ dayId, note }: { dayId: string; note: string | null }) {
  const paths = dayPaths(useDayBase());
  const columns = React.useMemo<TableColumn<DayActivityEntry>[]>(
    () => [
      { id: 'when', header: 'When', width: '120px', className: 'pl-2 pr-4 align-top py-3.5', headClassName: 'text-wds-text-secondary', cell: (e) => <span className="font-wds-mono text-[13px] leading-4 text-wds-text-secondary">{weekdayClock(e.at)}</span> },
      { id: 'who', header: 'Who', width: '216px', className: 'pl-0 pr-4 align-top py-3.5', headClassName: 'text-wds-text-secondary', cell: (e) => <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{e.actor.name}{e.actor.roleLabel ? ` · ${e.actor.roleLabel}` : ''}</span> },
      {
        id: 'what',
        header: 'What',
        className: 'pl-0 pr-4 align-top py-3.5',
        headClassName: 'text-wds-text-secondary',
        cell: (e) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{e.sentence}</span>
            {e.detail ? <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{e.detail}</span> : null}
          </div>
        ),
      },
      {
        id: 'record',
        header: 'Record',
        width: '158px',
        className: 'pl-0 pr-2 align-top py-3.5',
        headClassName: 'text-wds-text-secondary',
        cell: (e) =>
          e.link?.kind === 'DAY' ? (
            <RefLink reference={e.link.reference ?? ''} href={paths.file(e.link.id)} className="text-[13px] leading-4" />
          ) : e.link ? (
            <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Stock ledger entry</span>
          ) : null,
      },
    ],
    [paths],
  );
  return (
    <div className="flex flex-col gap-3">
      {note ? (
        <div role="status" className="flex items-center gap-3 border border-wds-success-border bg-wds-success-bg px-4 py-3">
          <CheckDisc size={18} />
          <p className="m-0 font-wds-sans text-[14px] leading-[18px] text-wds-success-fg">{note}</p>
        </div>
      ) : null}
      <DataTable<DayActivityEntry>
        label="Activity"
        columns={columns}
        getRowId={(e) => e.id}
        copy={ACTIVITY_COPY}
        searchable={false}
        className="border-0 bg-transparent"
        tableClassName="min-w-[760px]"
        rowClassName={(e) => (e.type === 'COUNT_CORRECTED' ? 'bg-[#FBF2E4] border-b-[#E7D3AC]' : undefined)}
        fetchRows={async (q, { signal }) => {
          // The contract's BD17 takes a `limit` only; the screen asks for the whole list and pages it (gap G16).
          const res = await branchDayDeskApi.activity(dayId, 100, signal);
          const start = (q.page - 1) * q.perPage;
          return { rows: res.entries.slice(start, start + q.perPage), total: res.total };
        }}
      />
    </div>
  );
}
