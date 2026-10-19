'use client';

import { cn } from '@/lib/cn';

import { DialogButton } from '../../../_shared';
import { dateOf, hmOf } from '../../../attendance';
import { clockHours, resultWords } from '../../_shared/lib/month-words';
import { dayTitle } from '../../_shared/lib/timesheet-words';
import type { PersonDayRow } from '../../_shared/types/month-types';
import { rowFill, rowSecondary, timePair, type RowAction } from '../lib/days-view';

const cell = 'px-2 py-[9px] align-top font-wds-mono text-[12px] leading-4';
const dim = 'text-wds-neutral-500';

/** "22:35" and "+1" when the shift ended after midnight of its own day (a night shift stays on its start date). */
function outTime(day: PersonDayRow, out: string | null): string {
  if (!out) return '·';
  return `${hmOf(out)}${dateOf(out) > day.date ? ' +1' : ''}`;
}

/**
 * Every day of one person's month on a dense 35 px row (spec S5). Rest days are grey, late and overtime-to-decide rows are amber, a day
 * with two shifts shows two time pairs, a night shift shows "+1", and days before the person joined say "Not yet employed". An exception
 * row carries the same small buttons as the drawer's card, only the ones the viewer may use.
 */
export function DaysTable({ days, highlight, caption, actions, onAction }: { days: readonly PersonDayRow[]; highlight: string | null; caption: string; actions: (day: PersonDayRow) => RowAction | null; onAction: (action: RowAction, day: PersonDayRow) => void }) {
  return (
    <div className="overflow-x-auto border border-wds-border bg-wds-surface">
      <table className="w-full min-w-[700px] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-wds-text-ink font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary">
            {['DAY', 'PLANNED', 'IN', 'OUT', 'WORKED', 'OVERTIME', 'LATE', 'RESULT'].map((h) => (
              <th key={h} scope="col" className={cn('px-2 py-3 font-normal', ['WORKED', 'OVERTIME', 'LATE'].includes(h) && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const action = actions(day);
            const exception = day.needsLook || day.resultKey === 'LATE';
            return (
              <tr key={day.date} id={`day-${day.date}`} data-highlight={highlight === day.date || undefined} className={cn('border-b border-wds-neutral-100 data-[highlight]:outline data-[highlight]:outline-2 data-[highlight]:-outline-offset-2 data-[highlight]:outline-wds-caramel-600', rowFill(day))}>
                <th scope="row" className={cn('px-2 py-[9px] text-left align-top font-wds-sans text-[13px] leading-4 text-wds-text-ink', exception ? 'font-semibold' : 'font-normal')}>
                  {dayTitle(day.date)}
                </th>
                <td className={cn(cell, day.plannedStart ? 'text-wds-text-ink' : dim)}>
                  {day.beforeEmployment ? 'Not yet employed' : timePair(day.plannedStart, day.plannedEnd) ?? (day.resultKey === 'REST' ? 'Day off' : '·')}
                  {day.extraShifts.map((s) => (
                    <div key={`${s.plannedStart}-${s.plannedEnd}`}>{timePair(s.plannedStart, s.plannedEnd)}</div>
                  ))}
                </td>
                <td className={cn(cell, day.clockIn ? 'text-wds-text-ink' : dim)}>
                  {day.clockIn ? hmOf(day.clockIn) : '·'}
                  {day.extraShifts.map((s) => (
                    <div key={`in-${s.plannedStart}`}>{s.clockIn ? hmOf(s.clockIn) : '·'}</div>
                  ))}
                </td>
                <td className={cn(cell, day.clockOut ? 'text-wds-text-ink' : dim)}>
                  {outTime(day, day.clockOut)}
                  {day.extraShifts.map((s) => (
                    <div key={`out-${s.plannedStart}`}>{outTime(day, s.clockOut)}</div>
                  ))}
                </td>
                <td className={cn(cell, 'text-right', day.workedMinutes ? 'text-wds-text-ink' : dim)}>{day.workedMinutes ? clockHours(day.workedMinutes) : '·'}</td>
                <td className={cn(cell, 'text-right', day.overtimeMinutes ? 'text-wds-warning-fg' : dim)}>{day.overtimeMinutes ? clockHours(day.overtimeMinutes) : '·'}</td>
                <td className={cn(cell, 'text-right', day.lateMinutes ? 'text-wds-warning-fg' : dim)}>{day.lateMinutes ? `${day.lateMinutes} min` : '·'}</td>
                <td className={cn('px-2 py-[9px] align-top font-wds-sans text-[12px] leading-4', rowSecondary(day))}>
                  <span className="block">{resultWords(day.resultKey, day.lateMinutes, day.overtimeMinutes)}</span>
                  {action ? (
                    <DialogButton kind="cancel" className="mt-1 h-7 px-2.5 text-[12px]" onClick={() => onAction(action, day)}>
                      {action.label}
                    </DialogButton>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
