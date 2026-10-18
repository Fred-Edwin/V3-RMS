import { env } from '../../../../config/env';
import { runAudited } from '../../_shared/audit/audit-writer';
import { nairobiDateOf } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { eventOf, timeEntry } from '../attendance-audit';
import { daysRepository } from '../days/days-repository';
import { buildPersonDay } from '../days/person-day';
import { loadClockContext, radiusFor, resultOf, type ClockResult } from './clock-context';
import { clockRepository } from './clock-repository';
import { checkLocation, chooseEntryToClockOut, earlyLeaveReason, trustedMoment } from './clock-rules';
import type { ClockOutInput } from './clock-validators';

const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1000;

/**
 * "Clock out": one tap at or after the scheduled end. Before the end it needs a reason chip first. When the shift-end
 * prompt was showing, the tap is also the "Finish now" answer. A retry with the same `clientEventId` writes nothing new.
 */
export async function clockOut(subject: AccessSubject, input: ClockOutInput, now: Date = new Date()): Promise<ClockResult> {
  const c = await loadClockContext(subject, now);
  const windowMs = c.rules.attendance.undoWindowSeconds * MS_PER_SECOND;
  const replay = await clockRepository.findByClientId(c.person.id, input.clientEventId);
  if (replay) return resultOf(replay, true, new Date(replay.serverAt.getTime() + windowMs));

  const moment = trustedMoment(now, input.deviceAt, input.sentAt, c.rules.attendance.clockSkewFlagMinutes);
  const position = input.latitude === undefined || input.longitude === undefined ? undefined : { latitude: input.latitude, longitude: input.longitude };
  const place = checkLocation(c.site, position, radiusFor(c.rules, env.CLOCK_GEOFENCE_RADIUS_METRES));
  const date = nairobiDateOf(moment.occurredAt);

  return runAudited(async (tx) => {
    await clockRepository.lockEmployee(tx, c.person.id);
    const retried = await clockRepository.findByClientId(c.person.id, input.clientEventId, tx);
    if (retried) return { result: resultOf(retried, true, new Date(retried.serverAt.getTime() + windowMs)), entries: [] };

    const data = await daysRepository.loadDayData(c.site.id, date, date, [c.person.id], tx);
    const day = buildPersonDay(c.person, date, data, c.rules, moment.occurredAt);
    const entry = chooseEntryToClockOut(day.entries, input.rotaEntryId);
    const reasonCode = earlyLeaveReason(entry, moment.occurredAt, input.reasonCode);
    const leftEarlyMinutes = reasonCode ? Math.floor((entry.endsAt.getTime() - moment.occurredAt.getTime()) / MS_PER_MINUTE) : 0;
    const afterEndMinutes = Math.max(0, Math.floor((moment.occurredAt.getTime() - entry.endsAt.getTime()) / MS_PER_MINUTE));

    const event = await clockRepository.insert(tx, {
      siteId: c.site.id,
      employeeId: c.person.id,
      rotaEntryId: entry.entryId,
      shiftDate: date,
      type: 'OUT',
      source: 'PHONE',
      occurredAt: moment.occurredAt,
      serverAt: now,
      deviceAt: moment.deviceAt,
      skewMinutes: moment.skewMinutes,
      skewFlagged: moment.skewFlagged,
      clientEventId: input.clientEventId,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      distanceMetres: place.distanceMetres,
      reasonCode,
      reason: reasonCode ? (input.reason ?? null) : null,
    });
    if (entry.state === 'PROMPT_DUE') {
      await clockRepository.insertAnswer(tx, { siteId: c.site.id, employeeId: c.person.id, rotaEntryId: entry.entryId, answer: 'FINISH_NOW', reasonCode: null, estimateMinutes: null });
    }

    const audit = timeEntry({
      companyId: c.site.companyId,
      siteId: c.site.id,
      actor: c.ctx.auditActor,
      action: 'attendance.clocked_out',
      employeeId: c.person.id,
      userId: c.person.userId,
      after: { shift: entry.templateName, date, at: event.occurredAt.toISOString(), leftEarlyMinutes, afterEndMinutes, ...(reasonCode ? { reasonCode } : {}) },
      reason: reasonCode ? (input.reason ?? null) : null,
    });
    const payload = { siteId: c.site.id, employeeId: c.person.id, userId: c.person.userId, rotaEntryId: entry.entryId, shiftDate: date, occurredAt: event.occurredAt.toISOString(), closedBy: 'OUT' as const, leftEarlyMinutes, afterEndMinutes };
    return {
      result: resultOf(event, false, new Date(event.serverAt.getTime() + windowMs), { leftEarlyMinutes }),
      entries: [audit],
      events: [eventOf('attendance.clocked_out', payload, now)],
    };
  });
}
