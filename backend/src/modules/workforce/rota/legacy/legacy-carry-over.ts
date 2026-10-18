import { runAudited } from '../../_shared/audit/audit-writer';
import { fromDateColumn, minutesOfDay, nairobiToday, parseClockTime, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { SHIFT_COLOURS } from '../rota.constants';
import { weekStartOf } from '../rota-days';
import { legacyRepository } from './legacy-repository';

export interface CarryOverResult {
  templatesCreated: number;
  templatesSkipped: number;
  entriesCreated: number;
  weeksLeftAlone: number;
}

const usable = (start: string, end: string): boolean => {
  try {
    return minutesOfDay(parseClockTime(end)) > minutesOfDay(parseClockTime(start));
  } catch {
    return false;
  }
};

/**
 * One-way, repeatable copy of the legacy shifts and their not-yet-past assignments into the new rota tables (decision R1).
 * The legacy tables are only read and stay authoritative for the clock until slice 3. Running it twice changes nothing:
 * templates and entries carry their legacy id (unique), and a week that was edited in the new rota is never touched again.
 * Overnight or malformed legacy shifts cannot exist in the new model, so they and their assignments are left out.
 */
export async function carryOverLegacyRota(now: Date): Promise<CarryOverResult> {
  const total: CarryOverResult = { templatesCreated: 0, templatesSkipped: 0, entriesCreated: 0, weeksLeftAlone: 0 };
  const today = nairobiToday(now);
  for (const company of await legacyRepository.companies()) {
    const shifts = await legacyRepository.legacyShifts(company.id);
    const assignments = await legacyRepository.upcomingAssignments(company.id, toDateColumn(today));
    const result = await runAudited(async (tx) => {
      const mine: CarryOverResult = { templatesCreated: 0, templatesSkipped: 0, entriesCreated: 0, weeksLeftAlone: 0 };
      const known = await legacyRepository.carriedShiftIds(tx, shifts.map((s) => s.id));
      const templateOf = new Map(known);
      for (const [index, shift] of shifts.entries()) {
        if (known.has(shift.id)) continue;
        if (!usable(shift.startTime, shift.endTime)) {
          mine.templatesSkipped += 1;
          continue;
        }
        const created = await legacyRepository.createTemplate(tx, {
          companyId: company.id,
          siteId: shift.siteId,
          name: shift.name,
          colour: SHIFT_COLOURS[index % SHIFT_COLOURS.length] as string,
          startTime: shift.startTime,
          endTime: shift.endTime,
          isActive: shift.isActive,
          legacyShiftId: shift.id,
        });
        templateOf.set(shift.id, created.id);
        mine.templatesCreated += 1;
      }

      const done = await legacyRepository.carriedAssignmentIds(tx, assignments.map((a) => a.id));
      const weekCache = new Map<string, { id: string; touched: boolean }>();
      const startsOn = new Map<string, number>();
      const rows = [];
      for (const a of assignments) {
        const employee = a.user.employee;
        const templateId = templateOf.get(a.shiftId);
        if (done.has(a.id) || !employee || !templateId || employee.siteId !== a.siteId) continue;
        if (!startsOn.has(a.siteId)) startsOn.set(a.siteId, (await getEffectiveRuleGroup(a.siteId, today, 'WEEK_AND_BREAKS')).values.weekStartsOn);
        const date = fromDateColumn(a.date) as NairobiDate;
        const weekStart = weekStartOf(date, startsOn.get(a.siteId) as number);
        const key = `${a.siteId}|${employee.departmentId ?? ''}|${weekStart}`;
        let week = weekCache.get(key);
        if (!week) {
          week = await legacyRepository.weekFor(tx, a.siteId, employee.departmentId, toDateColumn(weekStart));
          weekCache.set(key, week);
          if (week.touched) mine.weeksLeftAlone += 1;
        }
        if (week.touched) continue;
        rows.push({ weekId: week.id, siteId: a.siteId, employeeId: employee.id, date: a.date, templateId, legacyAssignmentId: a.id });
      }
      await legacyRepository.addEntries(tx, rows);
      mine.entriesCreated = rows.length;

      const changed = mine.templatesCreated + mine.entriesCreated > 0;
      return {
        result: mine,
        entries: changed
          ? [
              {
                companyId: company.id,
                siteId: null,
                actor: { id: null, role: 'SYSTEM', name: 'System' },
                channel: 'SYSTEM' as const,
                action: 'rota.legacy_carried',
                category: 'TIME' as const,
                subjectType: 'Company',
                subjectId: company.id,
                after: { templates: mine.templatesCreated, entries: mine.entriesCreated, skippedShifts: mine.templatesSkipped },
              },
            ]
          : [],
      };
    });
    total.templatesCreated += result.templatesCreated;
    total.templatesSkipped += result.templatesSkipped;
    total.entriesCreated += result.entriesCreated;
    total.weeksLeftAlone += result.weeksLeftAlone;
  }
  return total;
}
