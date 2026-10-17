'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { formatApiErrorMessage } from '@/types/api';

import { EmptyState, ErrorBlock, ListSkeleton, UnderlineTabs, UndoToast } from '../../../_shared';
import { PeopleFrame } from '../../_shared/components/people-frame';
import { useEmployeeFile } from '../../_shared/hooks/use-people-data';
import { nairobiDay } from '../../_shared/lib/people-dates';
import type { EmployeeFile } from '../../_shared/types/people-types';
import { finishTarget, pageActions, tabsFor, TAB_WAITS, type FileTabKey, type PageAction } from '../lib/file-model';
import { FileDialogs, type OpenFileDialog } from './dialogs/file-dialogs';
import { FileHeader } from './file-header';
import { ActivityTab } from './tabs/activity-tab';
import { DocumentsTab } from './tabs/documents-tab';
import { JobPayTab } from './tabs/job-pay-tab';
import { BranchKpis } from './tabs/overview-branch';
import { ExitBanner } from './tabs/overview-exited';
import { OverviewTab } from './tabs/overview-tab';

const TAB_VALUES: readonly FileTabKey[] = ['overview', 'job-pay', 'time', 'leave', 'documents', 'conduct', 'activity'];
const isTab = (value: string | null): value is FileTabKey => TAB_VALUES.includes(value as FileTabKey);

/**
 * The employee file (Paper Chapter 4). It loads the file, draws the header, the tabs and the Overview that fits the person and the
 * viewer, and hands every button to a dialog. A button is drawn only when the server's `actions` allow it. The chosen tab is in the
 * address (`?tab=`), so a reload keeps it. `?hired=1` adds the green "Hired" line after the hire wizard.
 */
export function FileScreen({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const file = useEmployeeFile(id);
  const today = React.useMemo(() => nairobiDay(), []);

  const requested = params.get('tab');
  const tab: FileTabKey = isTab(requested) ? requested : 'overview';
  const [dialog, setDialog] = React.useState<OpenFileDialog | null>(null);
  const [notice, setNotice] = React.useState<string | null>(params.get('hired') === '1' ? 'Hired. The file is open and the people who need to know have been told.' : null);
  const [undo, setUndo] = React.useState<{ message: string; run: () => Promise<void> } | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const reloadFile = file.reload;

  const chooseTab = React.useCallback(
    (next: string) => {
      const query = new URLSearchParams(params.toString());
      query.set('tab', next);
      query.delete('hired');
      router.replace(`${pathname}?${query.toString()}`);
    },
    [params, pathname, router]
  );
  const open = React.useCallback((key: OpenFileDialog['key'], requestId?: string) => setDialog({ key, requestId }), []);
  const close = React.useCallback(() => setDialog(null), []);
  const done = React.useCallback(
    (message: string, undoRun?: () => Promise<void>) => {
      setDialog(null);
      setNotice(message);
      setUndo(undoRun ? { message, run: undoRun } : null);
      setReloadKey((n) => n + 1);
      reloadFile();
    },
    [reloadFile]
  );
  React.useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const data = file.data;
  const crumbs = { root: 'People', section: 'Employees', sectionHref: '/app/workforce/employees', screen: data?.name ?? 'Employee' };

  if (!data) {
    return (
      <PeopleFrame breadcrumb={crumbs} phoneTitle="Employee" label="Employee file">
        <div className="flex w-full flex-col gap-5 px-wds-8 py-7 max-md:px-4">
          {file.status === 'error' ? <FileProblem status={file.error.status} onRetry={file.reload} onBack={() => router.push('/app/workforce/employees')} /> : <ListSkeleton rows={5} columns={[80, 'fill', 120]} label="Loading the file" />}
        </div>
      </PeopleFrame>
    );
  }

  const runAction = (a: PageAction): void => open(a.dialog === 'finish' ? (finishTarget(data) ?? 'details') : a.dialog);
  const actions = pageActions(data, tab);
  const bar = actions.length > 0 ? <ActionButtons actions={actions} onAction={runAction} /> : null;
  const tabs = tabsFor(data);
  const branchView = data.completeness === null && data.status !== 'EXITED';

  return (
    <PeopleFrame breadcrumb={crumbs} phoneTitle={data.name} label={`${data.name}, employee file`} actions={bar}>
      <div className="flex w-full flex-col gap-5 px-wds-8 py-6 max-md:px-4">
        <FileHeader file={data} today={today} />
        {notice ? (
          <p role="status" className="m-0 border border-wds-success-border bg-wds-success-bg px-4 py-2.5 font-wds-sans text-[14px] leading-[18px] text-wds-success-fg">
            {notice}
          </p>
        ) : null}
        {bar ? <div className="flex flex-wrap gap-2 lg:hidden">{bar}</div> : null}
        {data.status === 'EXITED' ? <ExitBanner file={data} today={today} onUndo={() => open('undo-exit')} /> : null}
        {branchView ? <BranchKpis file={data} today={today} /> : null}
        <UnderlineTabs items={tabs} value={tab} onChange={chooseTab} label={`${data.name}'s file`} className="overflow-y-hidden" />
        <div role="tabpanel" aria-label={tabs.find((t) => t.value === tab)?.label}>
          <TabBody file={data} tab={tab} today={today} open={open} reloadKey={reloadKey} />
        </div>
      </div>
      <FileDialogs file={data} open={dialog} onClose={close} done={done} />
      {undo ? (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <UndoToast
            message={undo.message}
            onUndo={() => {
              const run = undo.run;
              setUndo(null);
              run().catch((err: unknown) => setNotice(formatApiErrorMessage(err, 'That could not be undone.')));
            }}
            onExpire={() => setUndo(null)}
          />
        </div>
      ) : null}
    </PeopleFrame>
  );
}

function TabBody({ file, tab, today, open, reloadKey }: { file: EmployeeFile; tab: FileTabKey; today: string; open: (key: OpenFileDialog['key'], requestId?: string) => void; reloadKey: number }) {
  if (tab === 'job-pay') return <JobPayTab file={file} today={today} open={open} reloadKey={reloadKey} />;
  if (tab === 'documents') return <DocumentsTab file={file} reloadKey={reloadKey} />;
  if (tab === 'activity') return <ActivityTab file={file} />;
  if (tab === 'time' || tab === 'leave' || tab === 'conduct') return <EmptyState kind="nothingYet" title="Comes with a later slice" line={TAB_WAITS[tab]} />;
  return <OverviewTab file={file} open={open} />;
}

/** The buttons of the top bar: outlined ones first, the brown one last (rule 04). */
function ActionButtons({ actions, onAction }: { actions: PageAction[]; onAction: (a: PageAction) => void }) {
  return (
    <>
      {actions.map((a) => (
        <Button key={a.key} type="button" variant={a.primary ? 'primary' : 'flat'} onClick={() => onAction(a)}>
          {a.label}
        </Button>
      ))}
    </>
  );
}

/** A file that did not load: 404 is "not on your list" (a person of another site reads the same), 403 is no access. */
function FileProblem({ status, onRetry, onBack }: { status: number; onRetry: () => void; onBack: () => void }) {
  if (status === 404) return <EmptyState kind="nothingFound" title="This file is not on your list" line="It may belong to another site, or the link may be old." action={{ label: 'Back to Employees', onClick: onBack }} />;
  if (status === 403) return <EmptyState kind="nothingFound" title="You do not have access to this file" line="Ask HR if you think you should." action={{ label: 'Back to Employees', onClick: onBack }} />;
  return <ErrorBlock title="The file did not load" line="Nothing was changed. Try again." onRetry={onRetry} />;
}
