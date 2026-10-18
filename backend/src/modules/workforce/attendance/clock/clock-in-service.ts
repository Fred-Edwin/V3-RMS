import { env } from '../../../../config/env';
import { runAudited } from '../../_shared/audit/audit-writer';
import { computeLateness } from '../../_shared/time/lateness';
import { nairobiDateOf } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { eventOf, timeEntry } from '../attendance-audit';
import { buildPersonDay } from '../days/person-day';
import { daysRepository } from '../days/days-repository';
import { checkLocation, chooseEntryToClockIn, trustedMoment } from './clock-rules';
import { loadClockContext, radiusFor, resultOf, type ClockResult } from './clock-context';
import { clockRepository } from './clock-repository';
import type { ClockInInput } from './clock-validators';

const MS_PER_SECOND = 1000;

/**
 * "Clock in with one tap." The tap counts for the moment it was made (decision A5), against the shift whose window is
 * open, only on a rostered shift. A retry with the same `clientEventId` returns the first answer and writes nothing new.
 */
export async function clockIn(subject: AccessSubject, input: ClockInInput, now: Date = new Date()): Promise<ClockResult> {
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
    const entry = chooseEntryToClockIn(day.entries, input.rotaEntryId);
    const lateness = computeLateness(entry.shift, moment.occurredAt, c.rules.lateness);

    const event = await clockRepository.insert(tx, {
      siteId: c.site.id,
      employeeId: c.person.id,
      rotaEntryId: entry.entryId,
      shiftDate: date,
      type: 'IN',
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
    });

    const payload = { siteId: c.site.id, employeeId: c.person.id, userId: c.person.userId, rotaEntryId: entry.entryId, shiftDate: date };
    const events = [
      eventOf('attendance.clocked_in', { ...payload, occurredAt: event.occurredAt.toISOString(), source: 'PHONE', minutesLate: lateness.minutesLate, countsAsLate: lateness.countsAsLate }, now),
      ...(lateness.countsAsLate ? [eventOf('attendance.late', { ...payload, minutesLate: lateness.minutesLate, minutesAfterGrace: lateness.minutesAfterGrace }, now)] : []),
    ];
    const audit = timeEntry({
      companyId: c.site.companyId,
      siteId: c.site.id,
      actor: c.ctx.auditActor,
      action: 'attendance.clocked_in',
      employeeId: c.person.id,
      userId: c.person.userId,
      after: { shift: entry.templateName, date, at: event.occurredAt.toISOString(), minutesLate: lateness.minutesLate, countsAsLate: lateness.countsAsLate, offline: moment.deviceAt !== null && moment.occurredAt.getTime() < now.getTime() - MS_PER_SECOND * 60 },
    });
    const { minutesLate, countsAsLate, minutesAfterGrace } = lateness;
    return {
      result: resultOf(event, false, new Date(event.serverAt.getTime() + windowMs), { lateness: { minutesLate, countsAsLate, minutesAfterGrace } }),
      entries: [audit],
      events,
    };
  });
}
