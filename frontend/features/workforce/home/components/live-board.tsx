'use client';

import * as React from 'react';

import { Callout, useWorkforcePermissions } from '../../_shared';
import { ClockForDialog, ClosedShiftFlow, EditTimeFlow, PersonDrawer, chipItems, departmentRows, lookItems, type Board, type BoardShift, type LookItem } from '../../attendance';
import { DepartmentChips, NeedsALook, OnTimeByDepartment, type LookRow } from './branch-board';
import { EveryoneList } from './everyone-list';

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
 * viewer use it (`today.act`, `time.fix`, `timesheet.read`), never by role.
 */
export function LiveBoard({
  board,
  reload,
  everyone = false,
  initialReview,
}: {
  board: Board;
  reload: () => void;
  /** The Today page also lists everyone rostered, under the board. */
  everyone?: boolean;
  /** Opens the "set the real finish" question at once (the Home's Waiting for you links here). */
  initialReview?: { employeeId: string; entryId: string; date: string };
}) {
  const permissions = useWorkforcePermissions();
  const [department, setDepartment] = React.useState('all');
  const [open, setOpen] = React.useState<Open | null>(initialReview ? { kind: 'closed', ...initialReview } : null);
  const [snoozed, setSnoozed] = React.useState<ReadonlySet<string>>(new Set());
  const [note, setNote] = React.useState<string | null>(null);
  const canAct = permissions.can('today.act');
  const canFix = permissions.can('time.fix');
  const canRead = permissions.can('timesheet.read');
  const isToday = board.date === new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });

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

  const lookRow = (i: LookItem): LookRow => {
    const shift = shiftOf(i);
    const person = personOf(i.employeeId);
    const first = i.name.split(/\s+/)[0] ?? i.name;
    const actions: Array<{ label: string; kind?: 'outlined' | 'danger'; onClick: () => void }> = [];
    if (i.kind === 'NOT_IN' && canAct && isToday && shift) actions.push({ label: `Clock in for ${first}`, onClick: () => setOpen({ kind: 'clock-for', item: { employeeId: i.employeeId, name: i.name, department: i.department, shift } }) });
    if (i.kind === 'AUTO_CLOSED' && canFix) actions.push({ label: 'Review', onClick: () => setOpen({ kind: 'closed', employeeId: i.employeeId, entryId: i.entryId, date: i.date }) });
    return { key: i.key, name: i.name, role: person?.departmentName ?? i.department, status: i.status, tone: i.tone, tile: i.kind === 'NOT_IN' || i.kind === 'MISSED' ? 'muted' : 'name', late: i.late, actions: i.late ? undefined : actions, onOpen: () => setOpen({ kind: 'person', employeeId: i.employeeId }) };
  };

  const person = open?.kind === 'person' ? personOf(open.employeeId) : undefined;
  return (
    <div className="flex flex-col gap-5">
      {note ? (
        <Callout tone="success" role="status" size="sm">
          {note}
        </Callout>
      ) : null}
      <DepartmentChips chips={chips} value={department} onChange={setDepartment} />
      {items.length > 0 ? (
        <NeedsALook rows={items.map(lookRow)} shiftLine="Not in and late first" />
      ) : (
        <p className="m-0 border-b border-wds-border pb-4 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">Nobody needs a look right now.</p>
      )}
      <OnTimeByDepartment rows={rows.map((r) => ({ ...r, onOpen: () => setDepartment(r.key) }))} />
      {everyone ? <EveryoneList board={board} onOpen={(employeeId) => setOpen({ kind: 'person', employeeId })} /> : null}

      {person ? (
        <PersonDrawer
          board={board}
          person={person}
          canReadTime={canRead}
          onClose={() => setOpen(null)}
          actions={{
            ...(canAct && isToday ? { clockFor: (shift: BoardShift) => setOpen({ kind: 'clock-for', item: { employeeId: person.employeeId, name: person.name, department: person.departmentName ?? 'No department', shift } }), wait: () => snooze(person.employeeId) } : {}),
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
