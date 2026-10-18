import { ConflictError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { addDays } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { eventOf, timeEntry } from '../attendance-audit';
import { inAppendOrder, lastLiveEvent } from '../days/day-model';
import { daysRepository } from '../days/days-repository';
import { loadClockContext } from './clock-context';
import { clockRepository } from './clock-repository';
import type { UndoInput } from './clock-validators';

const MS_PER_SECOND = 1000;

export interface UndoResult {
  replayed: boolean;
  /** What was cancelled. */
  undid: { type: 'IN' | 'OUT'; eventId: string; occurredAt: string };
}

/**
 * "Undo either, one tap, two minutes" (the window is the ATTENDANCE rule). It cancels the person's own newest tap with a
 * voiding correction, so the shift carries on with no gap and "nothing is recorded". The window runs from when the server
 * received the tap. A tap a manager made for the person, or one that is not the newest, cannot be undone here.
 */
export async function undoLastTap(subject: AccessSubject, input: UndoInput, now: Date = new Date()): Promise<UndoResult> {
  const c = await loadClockContext(subject, now);
  const replay = await clockRepository.findByClientId(c.person.id, input.clientEventId);
  if (replay?.correctsEventId) return summary(await clockRepository.findById(c.site.id, replay.correctsEventId), true);

  return runAudited(async (tx) => {
    await clockRepository.lockEmployee(tx, c.person.id);
    const retried = await clockRepository.findByClientId(c.person.id, input.clientEventId, tx);
    if (retried?.correctsEventId) return { result: summary(await clockRepository.findById(c.site.id, retried.correctsEventId, tx), true), entries: [] };

    const data = await daysRepository.loadDayData(c.site.id, addDays(c.today, -1), c.today, [c.person.id], tx);
    const last = lastLiveEvent(inAppendOrder(data.events));
    if (!last || last.source !== 'PHONE' || (last.type !== 'IN' && last.type !== 'OUT')) {
      throw new ConflictError('There is nothing of yours to undo.', 'UNDO_NOT_AVAILABLE');
    }
    if (now.getTime() > last.serverAt.getTime() + c.rules.attendance.undoWindowSeconds * MS_PER_SECOND) {
      throw new ConflictError('That is past the time you have to undo it. Your manager will put it right.', 'UNDO_EXPIRED');
    }

    await clockRepository.insert(tx, {
      siteId: c.site.id,
      employeeId: c.person.id,
      rotaEntryId: last.rotaEntryId,
      shiftDate: last.shiftDate,
      type: 'CORRECTION',
      source: 'PHONE',
      occurredAt: last.occurredAt,
      serverAt: now,
      clientEventId: input.clientEventId,
      correctsEventId: last.id,
      voidsCorrected: true,
      reasonCode: 'UNDO',
    });
    const audit = timeEntry({
      companyId: c.site.companyId,
      siteId: c.site.id,
      actor: c.ctx.auditActor,
      action: 'attendance.undone',
      employeeId: c.person.id,
      userId: c.person.userId,
      before: { type: last.type, at: last.occurredAt.toISOString() },
      after: null,
    });
    const event = eventOf('attendance.undone', { siteId: c.site.id, employeeId: c.person.id, userId: c.person.userId, shiftDate: last.shiftDate, undid: last.type }, now);
    return { result: summary(last, false), entries: [audit], events: [event] };
  });
}

function summary(target: { id: string; type: string; occurredAt: Date } | null, replayed: boolean): UndoResult {
  if (!target || (target.type !== 'IN' && target.type !== 'OUT')) throw new ConflictError('There is nothing of yours to undo.', 'UNDO_NOT_AVAILABLE');
  return { replayed, undid: { type: target.type, eventId: target.id, occurredAt: target.occurredAt.toISOString() } };
}
