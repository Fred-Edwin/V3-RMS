import { logger } from '../../../../utils/logger';
import { runAudited } from '../../_shared/audit/audit-writer';
import { addDays, instantAt, nairobiToday, parseClockTime, type NairobiDate } from '../../_shared/time/nairobi-time';
import { told } from '../../people/people-context';
import { eventOf, SYSTEM_ACTOR, timeEntry } from '../attendance-audit';
import { FORGOTTEN_CLOSE_AFTER_MIDNIGHT_MINUTES, SWEEP_LOOKBACK_DAYS, SYSTEM_REASONS } from '../attendance.constants';
import type { EntryDay, PersonRow } from '../attendance.types';
import { clockRepository } from '../clock/clock-repository';
import { attendanceRulesFor } from '../days/day-rules';
import { daysRepository } from '../days/days-repository';
import { buildPersonDay } from '../days/person-day';
import { switchRepository } from '../switch/switch-repository';
import { alertsRepository } from './alerts-repository';

type Cause = 'NO_ANSWER' | 'FORGOT';

/** The Nairobi moment after which a clock-in that was never ended is treated as forgotten (just past midnight, like the legacy job). */
const forgottenFrom = (date: NairobiDate): Date => instantAt(addDays(date, 1), parseClockTime(`00:0${FORGOTTEN_CLOSE_AFTER_MIDNIGHT_MINUTES}`));

/** Why a shift must be closed now, or null. A prompt nobody answered closes after the rule; anything still open after midnight is forgotten. */
export function closeCause(entry: EntryDay, now: Date): Cause | null {
  const open = entry.state === 'ON_SHIFT' || entry.state === 'PROMPT_DUE' || entry.state === 'STAYING_ON';
  if (!open) return null;
  if (now.getTime() >= forgottenFrom(entry.date).getTime()) return 'FORGOT';
  if (entry.state === 'PROMPT_DUE' && now.getTime() >= entry.autoCloseAt.getTime()) return 'NO_ANSWER';
  return null;
}

/**
 * Closes every shift that is due, at the scheduled end, flagged for the manager (decision A6). It only touches sites whose
 * switch is on, checks again inside the person's lock (their own clock-out may have just landed), and writes through
 * the audit chain as the system. Safe to run every minute: a shift that is already closed is skipped.
 */
export async function sweepAutoClose(now: Date = new Date()): Promise<{ closed: number }> {
  let closed = 0;
  for (const siteId of await switchRepository.enabledSiteIds()) {
    try {
      closed += await sweepSite(siteId, now);
    } catch (error) {
      logger.error({ err: error, siteId }, 'attendance auto-close failed for a site');
    }
  }
  return { closed };
}

async function sweepSite(siteId: string, now: Date): Promise<number> {
  const today = nairobiToday(now);
  const from = addDays(today, -SWEEP_LOOKBACK_DAYS);
  const site = await daysRepository.siteFacts(siteId);
  if (!site) return 0;
  const rules = await attendanceRulesFor(siteId, today);
  const data = await daysRepository.loadDayData(siteId, from, today, null);
  const people = await daysRepository.peopleByIds(siteId, [...new Set(data.events.map((e) => e.employeeId))]);

  let closed = 0;
  for (const person of people) {
    for (let date = from; date <= today; date = addDays(date, 1)) {
      const day = buildPersonDay(person, date, data, rules, now);
      for (const entry of day.entries) {
        const cause = closeCause(entry, now);
        if (cause && (await closeOne(person, entry, cause, site.companyId, now))) closed += 1;
      }
    }
  }
  return closed;
}

async function closeOne(person: PersonRow, planned: EntryDay, cause: Cause, companyId: string, now: Date): Promise<boolean> {
  const rules = await attendanceRulesFor(person.siteId, planned.date);
  const recipients = await alertsRepository.closeAlertRecipients(person.siteId, person.departmentId, planned.date);
  const done = await runAudited(async (tx) => {
    await clockRepository.lockEmployee(tx, person.id);
    const data = await daysRepository.loadDayData(person.siteId, planned.date, planned.date, [person.id], tx);
    const entry = buildPersonDay(person, planned.date, data, rules, now).entries.find((e) => e.entryId === planned.entryId);
    if (!entry || closeCause(entry, now) === null) return { result: false, entries: [] }; // closed meanwhile

    const at = new Date(Math.max(entry.endsAt.getTime(), (entry.clockedInAt ?? entry.endsAt).getTime()));
    await clockRepository.insert(tx, {
      siteId: person.siteId,
      employeeId: person.id,
      rotaEntryId: entry.entryId,
      shiftDate: entry.date,
      type: 'AUTO_OUT',
      source: 'SYSTEM',
      occurredAt: at,
      serverAt: now,
      reasonCode: cause === 'NO_ANSWER' ? SYSTEM_REASONS.noAnswer : SYSTEM_REASONS.forgot,
    });
    const audit = timeEntry({
      companyId,
      siteId: person.siteId,
      actor: SYSTEM_ACTOR,
      channel: 'SYSTEM',
      action: 'attendance.auto_closed',
      employeeId: person.id,
      userId: person.userId,
      after: { shift: entry.templateName, date: entry.date, closedAt: at.toISOString(), cause },
    });
    const payload = { siteId: person.siteId, employeeId: person.id, userId: person.userId, rotaEntryId: entry.entryId, shiftDate: entry.date };
    return {
      result: true,
      entries: [audit],
      events: [
        eventOf('attendance.auto_closed', { ...payload, closedAt: at.toISOString(), cause }, now),
        eventOf('attendance.clocked_out', { ...payload, occurredAt: at.toISOString(), closedBy: 'AUTO_OUT', leftEarlyMinutes: 0, afterEndMinutes: 0 }, now),
      ],
    };
  });
  if (done) await told([...recipients, person.userId], 'attendance.auto_closed', { employee: person.name, date: planned.date, shift: planned.templateName, cause });
  return done;
}
