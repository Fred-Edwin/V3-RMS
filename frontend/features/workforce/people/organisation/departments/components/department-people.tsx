'use client';

import * as React from 'react';
import Link from 'next/link';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';

import { AvatarCell, EmptyState, StatusText } from '../../../../_shared';
import { PanelCaption, PanelLink, TitledPanel } from '../../../_shared/components/titled-panel';
import type { DepartmentView } from '../../_shared/types/org-types';
import { dailyRateLine, employmentWord, moreLine } from '../lib/department-copy';

/** "People in Service" (Paper step 02, left): the monthly staff, a page of them, with a link to the full Employees list for this department. */
export function PeoplePanel({ department }: { department: DepartmentView }) {
  const { items, total } = department.peoplePage;
  const seeAll = `/app/workforce/employees?departmentId=${department.id}`;
  return (
    <TitledPanel title={`People in ${department.name}`} aside={<PanelCaption>{items.length} OF {total}</PanelCaption>}>
      {items.length === 0 ? (
        <EmptyState kind="nothingYet" title="Nobody works here yet" line="People appear here once they are hired into this department." />
      ) : (
        <div className="[&>div]:border-0">
        <Table look="workforce" aria-label={`People in ${department.name}`}>
          <TableHeader>
            <TableRow className="h-9 hover:bg-transparent">
              <TableHead>Employee</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Employment</TableHead>
              <TableHead>Today</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow key={p.employeeId} size="compact" className="h-12">
                <TableCell>
                  <Link href={`/app/workforce/employees/${p.employeeId}`} className="text-inherit no-underline focus-visible:shadow-wds-ring focus-visible:outline-none">
                    <AvatarCell name={p.name} sub={p.isHead ? 'Head' : undefined} />
                  </Link>
                </TableCell>
                <TableCell><span className="font-wds-sans text-[14px] text-wds-text-ink">{p.positionName ?? '–'}</span></TableCell>
                <TableCell><StatusText tone="muted">{employmentWord(p)}</StatusText></TableCell>
                <TableCell><StatusText tone="muted">–</StatusText></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
      {total > 0 ? (
        <div className="flex items-center justify-between gap-3 border-t border-wds-border bg-wds-neutral-50 px-4 py-2.5">
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{moreLine(items.length, total) || 'That is everyone. Today arrives with Attendance.'}</span>
          <Link href={seeAll} className="font-wds-sans text-[13px] leading-4 text-wds-primary no-underline hover:underline focus-visible:shadow-wds-ring focus-visible:outline-none">See all {total} →</Link>
        </div>
      ) : null}
    </TitledPanel>
  );
}

/** "Casual pool" (Paper step 02, right): people paid by the day, with the daily rate only for someone who may read pay (the server leaves it out otherwise). */
export function CasualPoolPanel({ department, onAdd }: { department: DepartmentView; onAdd: (() => void) | null }) {
  const { items, total } = department.casualPool;
  return (
    <TitledPanel title="Casual pool" aside={onAdd ? <PanelLink onClick={onAdd}>Add casual</PanelLink> : undefined}>
      {items.length === 0 ? (
        <p className="m-0 px-4 py-4 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No casuals in this pool yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {items.map((c) => (
            <li key={c.employeeId} className="flex items-center justify-between gap-3 border-b border-wds-border px-4 py-3 last:border-b-0">
              <Link href={`/app/workforce/employees/${c.employeeId}`} className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink no-underline hover:underline focus-visible:shadow-wds-ring focus-visible:outline-none">{c.name}</Link>
              {dailyRateLine(c.dailyRate) ? <span className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{dailyRateLine(c.dailyRate)}</span> : null}
            </li>
          ))}
          {total > items.length ? <li className="px-4 py-2.5 font-wds-sans text-[12px] text-wds-text-secondary">{total - items.length} more in the pool.</li> : null}
        </ul>
      )}
    </TitledPanel>
  );
}
