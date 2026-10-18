import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { fromDateColumn } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { eventOf, timeEntry } from '../attendance-audit';
import { loadClockContext } from '../clock/clock-context';
import { clockRepository } from '../clock/clock-repository';
import type { ShiftEndInput } from '../clock/clock-validators';
import { daysRepository } from '../days/days-repository';
import { buildPersonDay } from '../days/person-day';

export interface StayOnResult {
  replayed: boolean;
  rotaEntryId: string;
  reasonCode: string | null;
  estimateMinutes: number | null;
  /** If nobody clocks out, the phone closes the shift at the scheduled end (flagged) once the day is over. */
  note: 'OVERTIME_PENDING_APPROVAL';
}

/**
 * "Stay on": the answer to the shift-end prompt when the person is working past the end. It keeps the reason and the
 * estimate for the manager; it starts overtime as PENDING only (nothing is paid until a manager approves, slice 4).
 * "Finish now" is just the clock-out. An answer after the 15 minutes is too late: the shift closes at its scheduled end.
 */
export async function stayOn(subject: AccessSubject, input: ShiftEndInput, now: Date = new Date()): Promise<StayOnResult> {
  const c = await loadClockContext(subject, now);
  const owned = await clockRepository.entryOwnedBy(c.site.id, c.person.id, input.rotaEntryId);
  if (!owned) throw new NotFoundError('Shift not found');
  const date = fromDateColumn(owned.date);

  return runAudited(async (tx) => {
    await clockRepository.lockEmployee(tx, c.person.id);
    const same = (a: { answer: string; reasonCode: string | null; estimateMinutes: number | null }) => ({
      replayed: true as const,
      rotaEntryId: input.rotaEntryId,
      reasonCode: a.reasonCode,
      estimateMinutes: a.estimateMinutes,
      note: 'OVERTIME_PENDING_APPROVAL' as const,
    });
    const existing = await clockRepository.findAnswer(c.site.id, input.rotaEntryId, tx);
    if (existing?.answer === 'STAY_ON') return { result: same(existing), entries: [] };

    const data = await daysRepository.loadDayData(c.site.id, date, date, [c.person.id], tx);
    const entry = buildPersonDay(c.person, date, data, c.rules, now).entries.find((e) => e.entryId === input.rotaEntryId);
    if (!entry || entry.state === 'UPCOMING' || entry.state === 'CLOCK_IN_OPEN' || entry.state === 'NOT_IN' || entry.state === 'MISSED') {
      throw new ConflictError('You are not clocked in on this shift.', 'CLOCK_NOT_IN');
    }
    if (entry.state === 'ON_SHIFT') throw new ConflictError('Your shift has not reached its end yet.', 'PROMPT_NOT_DUE', { endsAt: entry.endsAt.toISOString() });
    if (entry.state !== 'PROMPT_DUE') throw new ConflictError('This shift is already closed.', 'SHIFT_ALREADY_DONE');
    if (now.getTime() >= entry.autoCloseAt.getTime()) {
      throw new ConflictError(`You did not answer in time, so the shift closes at ${entry.shift.endTime}.`, 'PROMPT_EXPIRED', { endedAt: entry.endsAt.toISOString() });
    }

    const estimateMinutes = input.estimateMinutes ?? null;
    await clockRepository.insertAnswer(tx, { siteId: c.site.id, employeeId: c.person.id, rotaEntryId: input.rotaEntryId, answer: 'STAY_ON', reasonCode: input.reasonCode, estimateMinutes });
    const audit = timeEntry({
      companyId: c.site.companyId,
      siteId: c.site.id,
      actor: c.ctx.auditActor,
      action: 'attendance.shift_end_answered',
      employeeId: c.person.id,
      userId: c.person.userId,
      after: { shift: entry.templateName, date, answer: 'STAY_ON', reasonCode: input.reasonCode, estimateMinutes },
    });
    const event = eventOf('attendance.stayed_on', { siteId: c.site.id, employeeId: c.person.id, userId: c.person.userId, rotaEntryId: input.rotaEntryId, shiftDate: date, reasonCode: input.reasonCode, estimateMinutes }, now);
    return { result: { ...same({ answer: 'STAY_ON', reasonCode: input.reasonCode, estimateMinutes }), replayed: false as boolean }, entries: [audit], events: [event] };
  });
}
