'use client';

import * as React from 'react';
import Link from 'next/link';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';
import { cn } from '@/lib/cn';

import { DialogButton, FOCUS_RING, NumberCell, StatusTag } from '../../../../_shared';
import { approvalsGoTo, headNote } from '../../_shared/lib/org-copy';
import type { DepartmentSummary, SiteBlock } from '../../_shared/types/org-types';

/**
 * The departments of one site (Paper Chapter 3 step 01): department, head, people, and who approves today. A row with a gap is tinted
 * and carries "Assign head" when the person may name heads. The name is a real link, so the keyboard reaches every department; the
 * whole row also opens it for a pointer.
 */
export function DepartmentsTable({ site, canAssignHeads, onAssign, onOpen }: { site: SiteBlock; canAssignHeads: boolean; onAssign: (department: DepartmentSummary) => void; onOpen: (department: DepartmentSummary) => void }) {
  return (
    <Table look="workforce" aria-label={`Departments at ${site.name}`}>
      <TableHeader>
        <TableRow className="h-9 hover:bg-transparent">
          <TableHead className="w-[150px]">Department</TableHead>
          <TableHead className="w-[190px]">Head</TableHead>
          <TableHead className="w-[70px] text-right">People</TableHead>
          <TableHead>Approvals go to</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {site.departments.map((d) => {
          const approvals = approvalsGoTo(d, site.headsAllowed);
          const note = headNote(d);
          const canAssign = canAssignHeads && site.headsAllowed && d.isActive && !d.head;
          return (
            <TableRow key={d.id} onClick={() => onOpen(d)} className={cn('h-12 cursor-pointer', d.hasGap && 'bg-[color-mix(in_oklab,var(--wds-warning-bg)_45%,white)]')}>
              <TableCell>
                <Link href={`/app/workforce/organisation/${d.id}`} onClick={(e) => e.stopPropagation()} className={cn('font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink no-underline', FOCUS_RING)}>
                  {d.name}
                </Link>
                {!d.isActive ? <span className="ml-2 font-wds-sans text-[12px] text-wds-text-secondary">Retired</span> : null}
              </TableCell>
              <TableCell>
                {d.head ? (
                  <div className="flex flex-col">
                    <span className="font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{d.head.name}</span>
                    {note ? <span className="font-wds-sans text-[11px] leading-[13px] text-wds-warning-fg">{note}</span> : null}
                  </div>
                ) : !site.headsAllowed ? (
                  <span className="font-wds-sans text-[13px] text-wds-text-secondary">No heads here</span>
                ) : (
                  <StatusTag tone="warning">No head</StatusTag>
                )}
              </TableCell>
              <TableCell><NumberCell>{d.people}</NumberCell></TableCell>
              <TableCell>
                <div className="flex items-center justify-between gap-3">
                  <span className={cn('whitespace-nowrap font-wds-sans text-[14px] leading-[18px]', approvals.tone === 'warning' ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>{approvals.text}</span>
                  {canAssign ? (
                    <DialogButton
                      kind="cancel"
                      aria-label={`Assign a head for ${d.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssign(d);
                      }}
                    >
                      Assign head
                    </DialogButton>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
