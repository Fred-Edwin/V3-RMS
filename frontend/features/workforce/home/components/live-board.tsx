'use client';

import * as React from 'react';

import { Callout, useWorkforcePermissions } from '../../_shared';
import {
  ClockForDialog,
  ClosedShiftFlow,
  EditTimeFlow,
  PersonDrawer,
  chipItems,
  departmentCountRows,
  departmentRows,
  exceptionRows,
  lookItems,
  type Board,
  type BoardShift,
  type LookItem,
} from '../../attendance';
import { DepartmentChips, NeedsALook, OnTimeByDepartment, type LookRow } from './branch-board';
import { EveryoneList } from './everyone-list';
import { DepartmentCounts, ExceptionsList, FixedAfterPanel } from './past-day-parts';
import { PhoneDepartments, PhoneNeedsALook, type PhoneLookRow } from './phone-board';

const SNOOZE_MS = 30 * 60 * 1000;

type Open =
  | { kind: 'person'; employeeId: string }
  | { kind: 'clock-for'; item: { employeeId: string; name: string; department: string; shift: BoardShift } }
  | { kind: 'edit'; employeeId: string; entryId: string | null; date: string }
  | { kind: 'closed'; employeeId: string; entryId: string; date: string };

/**
 * The Today board as the Branch Manager's Home and the Today page draw it (Paper Chapter 7 step 1): department chips, "Needs a look"
 * (not in and late first), and "On time and working" by department. It owns what opens from a row: the person's drawer, "Clock in for
 * them", the real-finish question for a shift the phone closed, and Edit time. A button appears only when the server's table lets this
 * viewer use it (`today.act`, `time.fix`, `timesheet.read`) AND the board says the action is open (`board.actions`: no "Clock in for
 * them" on a day that is over), never by role.
 *
 * Three drawings of the same board (Schedule V1): a live day on a desktop, a live day on a phone (stacked cards, 44 px buttons), and a day
 * that is over (`board.pastDay`: that day's exceptions with Edit time, "Fixed after the day", By department).
 */
export function LiveBoard({
  board,
  reload,
  everyone = false,
  phone = false,
  initialReview,
}: {
  board: Board;
  reload: () => void;
  /** The Today page also lists everyone rostered, under the board (desktop only). */
  everyone?: boolean;
  /** The phone drawing: stacked cards, no chips, no everyone list. */
  phone?: boolean;
  /** Opens the "set the real finish" question at once (the Home's Waiting for you links here). */
  initialReview?: { employeeId: string; entryId: string; date: string };
}) {
  const permissions = useWorkforcePermissions();
  const [department, setDepartment] = React.useState('all');
  const [open, setOpen] = React.useState<Open | null>(initialReview ? { kind: 'closed', ...initialReview } : null);
  const [snoozed, setSnoozed] = React.useState<ReadonlySet<string>>(new Set());
  const [note, setNote] = React.useState<string | null>(null);
  const canAct = permissions.can('today.act') && board.actions.clockFor;
  const canFix = permissions.can('time.fix') && board.actions.fixTime;
  const canRead = permissions.can('timesheet.read');

  const snooze = (employeeId: string): void => {
    setSnoozed((s) => new Set(s).add(employeeId));
    setTimeout(() => setSnoozed((s) => (s.has(employeeId) ? new Set(Array.from(s).filter((id) => id !== employeeId)) : s)), SNOOZE_MS);
    setOpen(null);
  };
  const done = (message: string): void => {
    setOpen(null);
    setNote(message);
    reload();
  };

  const chips = chipItems(board);
  const chosen = chips.find((c) => c.key === department);
  const items = lookItems(board, snoozed).filter((i) => department === 'all' || !chosen || (i.departmentId ?? 'none') === department);
  const rows = departmentRows(board).filter((d) => department === 'all' || d.key === department);
  const personOf = (id: string) => board.people.find((p) => p.employeeId === id);
  const shiftOf = (i: LookItem): BoardShift | undefined => personOf(i.employeeId)?.shifts.find((s) => s.entryId === i.entryId);

  /** The one button a "Needs a look" row may carry, or none: "Clock in for them" for someone not in, "Review" for a shift the phone closed. */
  const actionOf = (i: LookItem): { label: string; onClick: () => void } | undefined => {
    const shift = shiftOf(i);
    if (i.kind === 'NOT_IN' && canAct && shift) return { label: 'Clock in for them', onClick: () => setOpen({ kind: 'clock-for', item: { employeeId: i.employeeId, name: i.name, department: i.department, shift } }) };
    if (i.kind === 'AUTO_CLOSED' && canFix) return { label: 'Review', onClick: () => setOpen({ kind: 'closed', employeeId: i.employeeId, entryId: i.entryId, date: i.date }) };
    return undefined;
  };
  const lookRow = (i: LookItem): LookRow => {
    const action = actionOf(i);
    return { key: i.key, name: i.name, role: personOf(i.employeeId)?.departmentName ?? i.department, status: i.status, tone: i.tone, tile: i.kind === 'NOT_IN' || i.kind === 'MISSED' ? 'muted' : 'name', late: i.late, actions: i.late || !action ? undefined : [action], onOpen: () => setOpen({ kind: 'person', employeeId: i.employeeId }) };
  };
  const phoneRow = (i: LookItem): PhoneLookRow => ({ key: i.key, name: i.name, status: `${i.status} · ${i.department}`, tone: i.tone, action: actionOf(i), onOpen: () => setOpen({ kind: 'person', employeeId: i.employeeId }) });

  const person = open?.kind === 'person' ? personOf(open.employeeId) : undefined;
  return (
    <div className="flex flex-col gap-5">
      {note ? (
        <Callout tone="success" role="status" size="sm">
          {note}
        </Callout>
      ) : null}
      {board.pastDay ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,360px)] items-start gap-5 max-lg:grid-cols-1">
            <ExceptionsList rows={exceptionRows(board)} onEdit={canFix ? (row) => setOpen({ kind: 'edit', employeeId: row.employeeId, entryId: row.entryId, date: board.date }) : undefined} />
            <FixedAfterPanel rows={board.fixedAfterTheDay} />
          </div>
          <DepartmentCounts rows={departmentCountRows(board, 'absent')} />
        </>
      ) : phone ? (
        <>
          <PhoneNeedsALook rows={lookItems(board, snoozed).map(phoneRow)} />
          <PhoneDepartments rows={departmentCountRows(board, 'not in')} />
        </>
      ) : (
        <>
          <DepartmentChips chips={chips} value={department} onChange={setDepartment} />
          {items.length > 0 ? (
            <NeedsALook rows={items.map(lookRow)} shiftLine="Not in and late first" />
          ) : (
            <p className="m-0 border-b border-wds-border pb-4 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">Nobody needs a look right now.</p>
          )}
          <OnTimeByDepartment rows={rows.map((r) => ({ ...r, onOpen: () => setDepartment(r.key) }))} />
          {everyone ? <EveryoneList board={board} onOpen={(employeeId) => setOpen({ kind: 'person', employeeId })} /> : null}
        </>
      )}

      {person ? (
        <PersonDrawer
          board={board}
          person={person}
          canReadTime={canRead}
          onClose={() => setOpen(null)}
          actions={{
            ...(canAct ? { clockFor: (shift: BoardShift) => setOpen({ kind: 'clock-for', item: { employeeId: person.employeeId, name: person.name, department: person.departmentName ?? 'No department', shift } }), wait: () => snooze(person.employeeId) } : {}),
            ...(canFix ? { editTime: (shift: BoardShift) => setOpen({ kind: 'edit', employeeId: person.employeeId, entryId: shift.entryId, date: board.date }), review: (shift: BoardShift) => setOpen({ kind: 'closed', employeeId: person.employeeId, entryId: shift.entryId, date: board.date }) } : {}),
          }}
        />
      ) : null}
      {open?.kind === 'clock-for' ? (
        <ClockForDialog
          employeeId={open.item.employeeId}
          name={open.item.name}
          department={open.item.department}
          shiftLine={`${open.item.shift.templateName} ${open.item.shift.startTime} to ${open.item.shift.endTime}`}
          startsAt={`${board.date}T${open.item.shift.startTime}:00+03:00`}
          date={board.date}
          onClose={() => setOpen(null)}
          onDone={done}
        />
      ) : null}
      {open?.kind === 'edit' ? <EditTimeFlow employeeId={open.employeeId} date={open.date} entryId={open.entryId} onClose={() => setOpen(null)} onDone={done} /> : null}
      {open?.kind === 'closed' ? <ClosedShiftFlow employeeId={open.employeeId} date={open.date} entryId={open.entryId} onClose={() => setOpen(null)} onDone={done} /> : null}
    </div>
  );
}
