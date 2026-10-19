'use client';

import * as React from 'react';

import { DataTable, type TableColumn, type TableCopy } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';

import { Callout, ChoiceChips, EmptyState, ListSkeleton, PageHeader, StatusTag, WorkforceFrame, useWorkforcePermissions } from '../../../_shared';
import { useBranchChoice } from '../../_shared/hooks/use-branch-choice';
import { shortCompare } from '../../_shared/lib/request-compare';
import { requestTitle } from '../../_shared/lib/timesheet-words';
import { timesheetReads } from '../../_shared/services/timesheet-services';
import type { InboxRequest } from '../../_shared/types/timesheet-types';
import { inboxState, isEscalated, waitingWords } from '../lib/request-view';
import { RequestDialog } from './request-dialog';

const COPY: TableCopy = {
  emptyTitle: 'No requests waiting',
  emptyDescription: 'When someone reports a problem with their time it appears here.',
  filteredEmptyTitle: 'No requests match',
  filteredEmptyDescription: 'Try another name, or choose All.',
  errorTitle: 'The requests did not load',
  errorDescription: 'Check your connection and try again.',
};

const FILTERS = [
  {
    kind: 'chips' as const,
    key: 'state',
    // The clean address is Waiting (the first chip), so its value is the empty one.
    options: [
      { value: '', label: 'Waiting' },
      { value: 'ANSWERED', label: 'Answered' },
      { value: 'ALL', label: 'All' },
    ],
  },
];

/**
 * Requests (the manager's side of Report a problem and "clocked out by mistake"): the inbox of a branch, oldest first, each opening the
 * answer dialog with before and after. A request nobody answered in three days shows as gone to HR. HR and the Director read every
 * branch (a chooser); the Accountant reads. Buttons follow the server (`canAct` and the capability table), never a role name.
 */
export function RequestsScreen() {
  const permissions = useWorkforcePermissions();
  const branch = useBranchChoice('timesheet.read');
  const [canAct, setCanAct] = React.useState(false);
  const [open, setOpen] = React.useState<InboxRequest | null>(null);
  const [refresh, setRefresh] = React.useState(0);
  const [said, setSaid] = React.useState<string | null>(null);

  const columns = React.useMemo<TableColumn<InboxRequest>[]>(
    () => [
      { id: 'person', header: 'PERSON', width: '210px', cell: (r, { term }) => <span className="font-wds-sans text-[14px] font-medium leading-5 text-wds-text-ink"><HighlightMatch text={r.person.name} term={term} /></span> },
      { id: 'what', header: 'REQUEST', width: '230px', cell: (r) => <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{requestTitle(r.kind, r.requested, r.shiftDate)}</span> },
      { id: 'change', header: 'RECORDED, AND WHAT THEY SAY', cell: (r) => <span className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{shortCompare(r)}</span> },
      {
        id: 'state',
        header: 'STATUS',
        width: '220px',
        cell: (r) => (isEscalated(r) ? <StatusTag tone="warning">{waitingWords(r)}</StatusTag> : <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{waitingWords(r)}</span>),
      },
    ],
    []
  );

  let body: React.ReactNode;
  if (!permissions.ready || !branch.ready) body = <ListSkeleton rows={5} columns={[200, 'fill', 120]} label="Loading the requests" />;
  else if (branch.branches.length === 0 && permissions.scopeOf('timesheet.read') === 'all') {
    body = <EmptyState kind="nothingYet" title="No branch uses the new clock yet" line="Requests appear here once a branch is switched on." />;
  } else {
    body = (
      <>
        {said ? (
          <Callout tone="success" size="sm" role="status">
            {said}
          </Callout>
        ) : null}
        <DataTable<InboxRequest>
          key={branch.siteId ?? 'mine'}
          label="Requests"
          columns={columns}
          getRowId={(r) => r.id}
          filters={FILTERS}
          copy={COPY}
          searchPlaceholder="Search a name"
          tableLook="workforce"
          rowSize="compact"
          className="border-0 bg-transparent"
          refreshToken={refresh}
          onRowActivate={setOpen}
          fetchRows={async (q) => {
            const page = await timesheetReads.inbox(inboxState(q.filters.state), q.search || undefined, q.page, q.perPage, branch.siteId);
            setCanAct(page.canAct);
            return { rows: page.rows, total: page.total };
          }}
        />
      </>
    );
  }

  return (
    <WorkforceFrame breadcrumb={{ section: 'Workforce', screen: 'Requests' }} phoneTitle="Requests" label="Requests" className="px-4 py-6 lg:px-8 lg:py-7">
      <div className="mx-auto flex w-full max-w-[1140px] flex-col gap-5">
        <PageHeader title={`Requests${branch.name ? ` · ${branch.name}` : ''}`} subtitle="Problems people report with their time. Nobody answers their own." />
        {branch.branches.length > 1 ? <ChoiceChips legend="Branch" legendStyle="caps" size="sm" value={branch.siteId ?? null} onChange={branch.choose} options={branch.branches.map((b) => ({ value: b.id, label: b.name }))} /> : null}
        {body}
      </div>
      {open ? (
        <RequestDialog
          request={open}
          canAct={canAct && permissions.can('timesheet.approve')}
          onClose={() => setOpen(null)}
          onDone={(message) => {
            setOpen(null);
            setSaid(message);
            setRefresh((n) => n + 1);
          }}
        />
      ) : null}
    </WorkforceFrame>
  );
}
