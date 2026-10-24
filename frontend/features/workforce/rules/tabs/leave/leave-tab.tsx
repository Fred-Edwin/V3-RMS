'use client';

import * as React from 'react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui2/table';

import { Callout, DialogButton } from '../../../_shared';
import { ChangeLink } from '../../components/change-link';
import { useOnline } from '../../hooks/use-rules-data';
import type { LeaveType, LeaveValues } from '../../types/rules-types';
import { CoverPanel } from './leave-cover';
import { LeaveTypeEditor } from './leave-type-editor';
import type { TabProps } from '../tab-types';

const buildsUp = (t: LeaveType): string => (t.accrual === 'MONTHLY' ? `${t.perMonthDays ?? '?'} a month` : t.accrual === 'PER_EVENT' ? 'Per event' : 'All at the start');
const needs = (t: LeaveType): string => {
  const bits = [t.carryOverDays > 0 ? `Carry over up to ${t.carryOverDays} days` : '', t.sickNoteAfterDays !== null ? `Sick note after ${t.sickNoteAfterDays} days` : '', t.approvedBy === 'HR' ? 'Approved by HR' : '', t.requiresReason ? 'A reason' : ''].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'Nothing';
};

export function LeaveTab(props: TabProps) {
  const { page, onSaved, onStale } = props;
  const online = useOnline();
  const [editing, setEditing] = React.useState<LeaveType | 'new' | null>(null);
  const answer = page.rows.leaveTypes;
  const mayEdit = Boolean(answer?.canChange);
  const types = (page.values as unknown as LeaveValues).leaveTypes;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-[minmax(0,720px)_minmax(320px,1fr)]">
        <section aria-label="Leave types" className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">LEAVE TYPES · CHANGED BY HR</h3>
            {mayEdit ? <DialogButton kind="primary" onClick={() => setEditing('new')} disabled={!online} title={online ? undefined : 'No connection'}>Add a leave type</DialogButton> : null}
          </div>
          <Table look="workforce" aria-label="Leave types">
            <TableHeader>
              <TableRow>
                <TableHead>TYPE</TableHead>
                <TableHead className="text-right">DAYS</TableHead>
                <TableHead>BUILDS UP</TableHead>
                <TableHead>PAY</TableHead>
                <TableHead>ALSO NEEDS</TableHead>
                <TableHead className="w-[72px]"><span className="sr-only">Change</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.code}>
                  <TableCell className="font-semibold">{t.label}</TableCell>
                  <TableCell className="text-right font-wds-mono">{t.daysPerYear ?? 'No limit'}</TableCell>
                  <TableCell>{buildsUp(t)}</TableCell>
                  <TableCell className={t.paid ? undefined : 'text-wds-warning-fg'}>{t.paid ? 'Normal pay' : 'Not paid'}</TableCell>
                  <TableCell>{needs(t)}</TableCell>
                  <TableCell>
                    {mayEdit ? (
                      <ChangeLink thing={`${t.label.toLowerCase()} leave`} state={{ kind: 'change' }} onChange={() => setEditing(t)} offline={!online} />
                    ) : (
                      <ChangeLink thing="leave types" state={{ kind: 'locked', whoCan: answer?.lockedReason?.whoCan ?? [] }} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            Every calendar day from the first to the last day of leave counts as one day, because Wendo works seven days a week. Figures follow the Employment Act, 2007; the client’s lawyer confirms them. Leave types are never deleted, so past leave can always be explained.
          </p>
        </section>
        <CoverPanel page={page} onSaved={onSaved} onStale={onStale} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[1100px]:grid-cols-4">
        <Callout tone="neutral" variant="bar" kicker="WHO DECIDES">The Branch Manager. A manager’s own leave goes to HR.</Callout>
        <Callout tone="neutral" variant="bar" kicker="NOT ANSWERED">After 3 days it goes to HR, so it is never stuck.</Callout>
        <Callout tone="warning" variant="bar" kicker="BELOW MINIMUM COVER">Warns the approver and the person asking. It never blocks.</Callout>
        <Callout tone="neutral" variant="bar" kicker="WHEN APPROVED">Shifts shows leave and the balance drops by itself.</Callout>
      </div>
      {editing ? <LeaveTypeEditor page={page} type={editing === 'new' ? null : editing} onSaved={onSaved} onStale={onStale} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
