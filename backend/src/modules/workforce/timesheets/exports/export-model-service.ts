import { env } from '../../../../config/env';
import { eachDay, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { attendanceRulesFor } from '../../attendance/days/day-rules';
import { daysRepository } from '../../attendance/days/days-repository';
import { decidedText, type Decider } from '../approval/decided-by';
import { snapshotPeople, type MonthSnapshot } from '../approval/snapshot';
import { dayResult } from '../months/day-result';
import { assertRangeInMonth, monthForViewer } from '../months/month-context';
import { loadMonthData, sliceRange } from '../months/month-data';
import { documentCode } from '../months/months-service';
import { monthLabelOf } from '../months/month-state';
import { monthTotals } from '../months/people-rows';
import { dayFactsOf } from '../months/person-day-facts';
import { rulesUsedFor } from '../months/rules-used';
import { periodsRepository } from '../periods/periods-repository';
import { writerFor } from '../timesheets-scope';
import type { ExportBody } from './exports-validators';
import { clockOf, rangeWords, resultWords } from './export-format';
import { fromSnapshot, type DailyRow, type ExportModel } from './export-model';

/** A month this big is refused (413) rather than slowing the server; a background job is the next step (decision X2). */
export const MAX_EXPORT_PEOPLE = 400;

/**
 * Assembles what a document needs. An approved month exported whole is built from the snapshot frozen at approval, so the file
 * never changes; a draft, a range or a one-person extract is built from the live rows (which an approved month no longer changes).
 * The access check is `timesheet.export` at the site (403 without it, 404 for another site), then the ordinary read.
 */
export async function buildExportModel(subject: AccessSubject, monthKey: string, body: ExportBody, exportedBy: Decider, now: Date): Promise<ExportModel & { siteId: string; periodId: string }> {
  writerFor(subject, 'timesheet.export', body.site ?? subject.siteId ?? '');
  const ctx = await monthForViewer(subject, monthKey, body.site, now);
  const { period } = ctx;
  const range = body.scope === 'range' ? { from: body.from as NairobiDate, to: body.to as NairobiDate } : null;
  assertRangeInMonth(period, range ?? {});
  const draft = ctx.state !== 'APPROVED';

  const data = await loadMonthData(period);
  const slice = sliceRange(data, range ?? {});
  if (slice.rows.length > MAX_EXPORT_PEOPLE) throw new ExportTooLarge(slice.rows.length);
  const names = await periodsRepository.people([...new Set([...data.items.map((i) => i.decidedById), ...data.days.map(({ day }) => day.decidedById), period.approvedById].filter((id): id is string => id !== null))]);
  const nameOf = (userId: string | null): Decider | null => (userId ? (names.get(userId) ?? null) : null);

  const snapshotJson = !draft && !range && !body.employeeId ? await periodsRepository.snapshotOf(period.id) : null;
  const snapshot = snapshotJson as unknown as MonthSnapshot | null;
  const wanted = body.employeeId ? slice.rows.filter((r) => r.employeeId === body.employeeId) : slice.rows;
  const live = {
    totals: monthTotals(wanted, slice.items),
    people: snapshotPeople(wanted, data.days.map(({ day }) => day), slice.items, nameOf),
    rules: await rulesUsedFor(period.siteId, period.end),
  };
  const content = snapshot?.version === 1 ? fromSnapshot(snapshot) : live;
  const extractName = body.employeeId ? (live.people[0]?.name ?? null) : null;
  const days = range ? rangeWords(range.from, range.to) : null;
  const scopeNote = extractName ? `Extract: ${extractName}${days ? `, ${days}` : ''}` : days ? `${draft ? 'Range' : 'Extract'}: ${days}` : null;
  const wantedIds = new Set(content.people.map((p) => p.employeeId));
  const site = await periodsRepository.siteName(period.siteId);
  const hashPrefix = period.documentHash?.slice(0, 10) ?? null;
  const number = documentCode(period.documentNumber);

  return {
    siteId: period.siteId,
    periodId: period.id,
    siteName: site,
    monthKey: ctx.key,
    monthLabel: monthLabelOf(ctx.key),
    start: range?.from ?? period.start,
    end: range?.to ?? period.end,
    draft,
    documentNumber: draft ? null : number,
    hashPrefix: draft ? null : hashPrefix,
    approvedAt: draft ? null : period.approvedAt,
    approvedBy: draft ? null : nameOf(period.approvedById),
    scopeNote,
    fileSuffix: [extractName ? 'extract' : '', range ? `${range.from.slice(8)}-${range.to.slice(8)}` : ''].filter(Boolean).join('-'),
    ...content,
    exportedBy,
    exportedAt: now,
    qrUrl: !draft && number && hashPrefix ? `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}/verify/tsh/${number}?h=${hashPrefix}` : null,
    daily: body.format === 'xlsx' ? await dailyRows(period.siteId, period.start, period.end, range, data, wantedIds, nameOf, now) : [],
  };
}

export class ExportTooLarge extends Error {
  constructor(public readonly people: number) {
    super(`This month has ${people} people; exports are limited to ${MAX_EXPORT_PEOPLE}.`);
  }
}

async function dailyRows(
  siteId: string,
  start: NairobiDate,
  end: NairobiDate,
  range: { from: NairobiDate; to: NairobiDate } | null,
  data: Awaited<ReturnType<typeof loadMonthData>>,
  wanted: ReadonlySet<string>,
  nameOf: (userId: string | null) => Decider | null,
  now: Date,
): Promise<DailyRow[]> {
  const from = range?.from ?? start;
  const to = range?.to ?? end;
  const [dayData, rules] = await Promise.all([daysRepository.loadDayData(siteId, from, to, null), attendanceRulesFor(siteId, end)]);
  const dates = eachDay(from, to);
  const rows: DailyRow[] = [];
  const people = new Map(data.days.map(({ person }) => [person.id, person] as const));
  for (const employeeId of [...wanted]) {
    const person = people.get(employeeId);
    if (!person) continue;
    const mine = { entries: dayData.entries.filter((e) => e.employeeId === employeeId), events: dayData.events.filter((e) => e.employeeId === employeeId), answers: dayData.answers };
    const facts = dayFactsOf(employeeId, dates, mine, rules, now);
    for (const date of dates) {
      const day = data.days.find(({ day: d, person: p }) => p.id === employeeId && d.shiftDate === date)?.day ?? null;
      if (!day) continue;
      const item = data.items.find((i) => i.employeeId === employeeId && i.shiftDate === date) ?? null;
      const f = facts.get(date);
      const result = dayResult(day, item, data.requests.filter((r) => r.employeeId === employeeId && r.shiftDate === date));
      rows.push({
        person: person.name,
        department: person.department?.name ?? null,
        date,
        plannedIn: f?.plannedStart ?? null,
        plannedOut: f?.plannedEnd ?? null,
        clockIn: clockOf(f?.clockIn ?? null),
        clockOut: clockOf(f?.clockOut ?? null),
        workedMinutes: day.workedMinutes,
        overtimeMinutes: item?.rawMinutes ?? 0,
        lateMinutes: day.minutesLate,
        result: resultWords(result.resultKey, { lateMinutes: day.minutesLate, overtimeMinutes: item?.rawMinutes ?? 0 }),
        decision: item && item.decidedById ? decidedText([overtimeLine(item, nameOf)]) : '',
      });
    }
  }
  return rows.sort((a, b) => (a.department ?? '').localeCompare(b.department ?? '', 'en') || a.person.localeCompare(b.person, 'en') || a.date.localeCompare(b.date));
}

const overtimeLine = (item: Awaited<ReturnType<typeof loadMonthData>>['items'][number], nameOf: (userId: string | null) => Decider | null): Parameters<typeof decidedText>[0][number] =>
  item.status === 'APPROVED_PART'
    ? { code: 'OVERTIME_PART', by: nameOf(item.decidedById), minutes: item.authorisedMinutes - item.autoMinutes, ofMinutes: item.needsMinutes }
    : item.status === 'DECLINED'
      ? { code: 'OVERTIME_NOT_APPROVED', by: nameOf(item.decidedById) }
      : { code: 'OVERTIME_APPROVED', by: nameOf(item.decidedById), minutes: item.authorisedMinutes - item.autoMinutes };
