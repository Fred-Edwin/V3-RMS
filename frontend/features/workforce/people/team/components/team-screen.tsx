'use client';

import * as React from 'react';

import { DataTable, type TableColumn, type TableCopy } from '@/components/ui2/data-table/data-table';
import { HighlightMatch } from '@/components/ui2/data-table/highlight-match';
import type { TableFilter } from '@/components/ui2/data-table/table-toolbar';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';

import { PageHeader, PersonAvatar, PersonLabelLine, StatusTag } from '../../../_shared';
import { PeopleFrame } from '../../_shared/components/people-frame';
import { shiftCell, statusCell, toTeamQuery } from '../lib/team-copy';
import { teamReads } from '../services/team-reads';
import type { TeamMember } from '../types/team-types';

/**
 * My team (frames 9.2 and 9.5): who a head leads, read only. Name and position, today's status, today's shift; search, the three
 * chips, the numbered pager with rows per page. No pay, no ID number and no link to a file: a head reads this, they do not open it.
 */
const COPY: TableCopy = {
  emptyTitle: 'Nobody is on your team yet',
  emptyDescription: 'People in your department appear here once HR adds them.',
  filteredEmptyTitle: 'Nobody matches',
  filteredEmptyDescription: 'Try a different name, or clear the filter to see everyone.',
  errorTitle: 'Your team did not load',
  errorDescription: 'Check your connection and try again.',
  permissionDescription: 'Your role does not open My team.',
};

const FILTERS: TableFilter[] = [
  {
    kind: 'chips',
    key: 'filter',
    options: [
      { value: '', label: 'All' },
      { value: 'on_shift', label: 'On shift' },
      { value: 'not_on_shift', label: 'Not on shift' },
    ],
  },
];

const COLUMNS: TableColumn<TeamMember>[] = [
  {
    id: 'person',
    header: 'PERSON',
    cell: (m, { term }) => (
      <div className="flex min-w-0 items-center gap-3">
        <PersonAvatar name={m.name} size="sm" />
        <PersonLabelLine name={m.name} position={m.position} query={term} />
      </div>
    ),
  },
  {
    id: 'today',
    header: 'TODAY',
    width: '180px',
    cell: (m) => {
      const s = statusCell(m);
      return <StatusTag tone={s.tone}>{s.label}</StatusTag>;
    },
  },
  { id: 'shift', header: 'SHIFT', width: '200px', cell: (m) => <span className="font-wds-mono text-[13px] leading-[18px] text-wds-text-ink">{shiftCell(m)}</span> },
];

/** A phone row (frame 9.2): the person at the left, today's status at the right, the shift under it. */
function TeamCard({ member, term }: { member: TeamMember; term: string }) {
  const s = statusCell(member);
  return (
    <div className="flex items-center gap-3 border-b border-wds-neutral-100 px-4 py-3">
      <PersonAvatar name={member.name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink"><HighlightMatch text={member.name} term={term} /></p>
        {member.position ? <p className="m-0 truncate font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{member.position}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className={cn('m-0 font-wds-sans text-[13px] leading-[18px]', s.tone === 'success' ? 'text-wds-success-fg' : 'text-wds-text-secondary')}>{s.label}</p>
        <p className="m-0 font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{shiftCell(member)}</p>
      </div>
    </div>
  );
}

export function TeamScreen() {
  const phone = useMediaQuery('(max-width: 767px)');
  return (
    <PeopleFrame breadcrumb={{ root: 'Department', section: 'People', screen: 'My team' }} phoneTitle="My team" label="My team">
      <div className="flex w-full flex-col gap-5 px-wds-8 py-7 max-md:px-4">
        <PageHeader title="My team" subtitle="Names, positions and today's status. Pay and IDs are not shown." />
        <DataTable<TeamMember>
          label="My team"
          layout={phone.matches ? 'cards' : 'table'}
          renderCard={(m, { term }) => <TeamCard member={m} term={term} />}
          columns={COLUMNS}
          getRowId={(m) => m.id}
          filters={FILTERS}
          copy={COPY}
          searchPlaceholder="Find a person"
          tableLook="workforce"
          className="border-0 bg-transparent"
          fetchRows={async (q) => {
            const page = await teamReads.list(toTeamQuery(q));
            return { rows: page.people, total: page.pagination.total, counts: { filter: { '': page.counts.all, on_shift: page.counts.onShift, not_on_shift: page.counts.notOnShift } } };
          }}
        />
      </div>
    </PeopleFrame>
  );
}
