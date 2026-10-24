'use client';

import * as React from 'react';

import { ActionCards, Callout, DrawerSection, WorkforceDrawer, initialsOf, type ActionCardItem } from '../../../_shared';
import { addDays, nairobiToday } from '../../../rota';
import { hmOf, minutesBetween } from '../../_shared/lib/nairobi-clock';
import type { Board, BoardPerson, BoardShift } from '../../_shared/types/attendance-types';
import { lookShiftOf } from '../lib/board-view';
import { useLateness } from '../../fixes/hooks/use-day-data';

/**
 * One person from the board, in the side drawer (Paper Chapter 7 step 2): where they stand today, their shift, how often they were late
 * this month, and what the viewer can do. Every button is passed only when the server's table lets this viewer use it, and a person's
 * own row never offers a way to change their own time.
 */

export interface DrawerActions {
  clockFor?: (shift: BoardShift) => void;
  wait?: () => void;
  editTime?: (shift: BoardShift) => void;
  review?: (shift: BoardShift) => void;
}

/** "WED 28 OCT", the section heading when the board shows a day that has passed. */
const dayCaption = (date: string): string =>
  new Date(`${date}T12:00:00+03:00`).toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi', weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '').toUpperCase();

function statusOf(shift: BoardShift | null, person: BoardPerson): { tone: 'error' | 'warning' | 'success' | 'neutral'; title: string; body: string } {
  const first = person.name.split(/\s+/)[0] ?? person.name;
  if (!shift) return { tone: 'neutral', title: 'No shift', body: `${first} has no shift on this day.` };
  const start = `${shift.startTime}`;
  switch (shift.state) {
    case 'NOT_IN':
    case 'MISSED':
      return { tone: 'error', title: shift.state === 'NOT_IN' ? 'Not in yet' : 'Missed the shift', body: `The shift started at ${start}. There is no clock-in and no message from ${first}.` };
    case 'LATE':
      return { tone: 'warning', title: `Late ${shift.minutesLate} min`, body: `Clocked in at ${shift.clockedInAt ? hmOf(shift.clockedInAt) : '--:--'}, ${shift.minutesAfterGrace} min past the grace.` };
    case 'AUTO_CLOSED':
      return { tone: 'warning', title: 'Closed by the phone', body: `${first} did not answer the end-of-shift question, so the shift was closed at its end and flagged.` };
    case 'NOT_STARTED':
      return { tone: 'neutral', title: 'Shift not started', body: `The shift starts at ${start}.` };
    case 'FINISHED':
      return { tone: 'success', title: 'Finished', body: `Clocked out at ${shift.clockedOutAt ? hmOf(shift.clockedOutAt) : '--:--'}.` };
    default:
      return { tone: 'success', title: 'On shift', body: `In at ${shift.clockedInAt ? hmOf(shift.clockedInAt) : '--:--'}.` };
  }
}

export function PersonDrawer({
  board,
  person,
  canReadTime,
  actions,
  onClose,
}: {
  board: Board;
  person: BoardPerson;
  canReadTime: boolean;
  actions: DrawerActions;
  onClose: () => void;
}) {
  const shift = lookShiftOf(person) ?? person.shifts[0] ?? null;
  const from = addDays(board.date, -29);
  const lateness = useLateness(person.employeeId, from, board.date, canReadTime);
  const status = statusOf(shift, person);
  const rows: ActionCardItem[] = [];
  if (shift && actions.clockFor && (shift.state === 'NOT_IN' || shift.state === 'MISSED')) {
    rows.push({ key: 'clock-for', title: `Clock in for ${person.name.split(/\s+/)[0]}`, description: 'They are here but could not clock in. You say when they arrived.', primary: true, onSelect: () => actions.clockFor?.(shift) });
  }
  if (shift && actions.review && shift.state === 'AUTO_CLOSED') {
    rows.push({ key: 'review', title: 'Set the real finish', description: 'Keep the closing time or say when they really finished.', primary: true, onSelect: () => actions.review?.(shift) });
  }
  if (shift && actions.editTime && shift.state !== 'NOT_STARTED') {
    rows.push({ key: 'edit', title: 'Edit this day’s clock times', description: 'Change, add or remove a clock event. A reason is always required and the old value stays in the history.', onSelect: () => actions.editTime?.(shift) });
  }
  if (actions.wait && (shift?.state === 'NOT_IN' || shift?.state === 'LATE')) {
    rows.push({ key: 'wait', title: `Wait, ${person.name.split(/\s+/)[0]} has told me`, description: 'Hide this from the list for 30 minutes on this screen.', onSelect: actions.wait });
  }
  const lateDays = lateness.data?.summary[0];
  const minutesAgo = shift ? Math.max(0, minutesBetween(`${board.date}T${shift.startTime}:00+03:00`, Date.now())) : 0;

  return (
    <WorkforceDrawer open onOpenChange={(o) => !o && onClose()} title={person.name} subtitle={person.departmentName ?? 'No department'} initials={initialsOf(person.name)}>
      <div className="flex flex-col gap-[18px] px-7 py-[22px]">
        <Callout tone={status.tone === 'neutral' ? 'neutral' : status.tone} title={status.title}>
          {status.body}
          {shift?.state === 'NOT_IN' && board.date === nairobiToday() ? ` That was ${minutesAgo} minutes ago.` : ''}
        </Callout>
        <DrawerSection caption={board.date === nairobiToday() ? 'TODAY' : dayCaption(board.date)}>
          <dl className="m-0 flex flex-col gap-2">
            <Row label="Shift" value={shift ? `${shift.templateName} ${shift.startTime} to ${shift.endTime}` : 'None'} />
            <Row label="Clocked in" value={shift?.clockedInAt ? hmOf(shift.clockedInAt) : 'Not yet'} />
            <Row label="Clocked out" value={shift?.clockedOutAt ? hmOf(shift.clockedOutAt) : '—'} />
            {shift?.recordedForBy ? <Row label="Clock-in entered by" value="A manager, not their phone" /> : null}
            {canReadTime ? <Row label="Late in the last 30 days" value={lateness.status === 'ready' ? (lateDays ? `${lateDays.lateDays} ${lateDays.lateDays === 1 ? 'day' : 'days'}, ${lateDays.minutesAfterGrace} min past grace` : 'Not late') : '…'} /> : null}
          </dl>
        </DrawerSection>
        {rows.length > 0 ? (
          <DrawerSection caption="WHAT DO YOU WANT TO DO">
            <ActionCards label={`What to do about ${person.name}`} items={rows} />
          </DrawerSection>
        ) : null}
      </div>
    </WorkforceDrawer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{label}</dt>
      <dd className="m-0 text-right font-wds-sans text-[13px] leading-4 text-wds-text-ink">{value}</dd>
    </div>
  );
}
