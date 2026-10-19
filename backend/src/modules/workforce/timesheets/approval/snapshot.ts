import { createHash } from 'node:crypto';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { MonthTotals } from '../months/people-rows';
import type { RuleUsed } from '../months/rules-used';
import type { DayRow, OvertimeRow } from '../timesheets.types';
import { decidedLines, type DecidedLine, type Decider } from './decided-by';
import type { PersonMonthRow } from '../months/people-rows';

export interface SnapshotPerson {
  employeeId: string;
  name: string;
  department: string | null;
  plannedMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  overtimeAuthorisedMinutes: number;
  lateMinutes: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  decided: DecidedLine[];
}

/** What the site's manager signed. Frozen at approval: the PDF and the Excel of an approved month are built from this, so they never change. */
export interface MonthSnapshot {
  version: 1;
  monthKey: string;
  siteId: string;
  siteName: string;
  start: NairobiDate;
  end: NairobiDate;
  approvedAt: string;
  approvedBy: Decider | null;
  ownHoursIncluded: boolean;
  totals: MonthTotals;
  rules: RuleUsed[];
  people: SnapshotPerson[];
}

/** One row per person, department A to Z then name A to Z (the order the screen, the PDF and the Excel all use). */
export function snapshotPeople(rows: readonly PersonMonthRow[], days: readonly DayRow[], items: readonly OvertimeRow[], nameOf: (userId: string | null) => Decider | null): SnapshotPerson[] {
  return [...rows]
    .sort((a, b) => (a.department ?? '').localeCompare(b.department ?? '', 'en') || a.name.localeCompare(b.name, 'en') || a.employeeId.localeCompare(b.employeeId))
    .map(
      (row): SnapshotPerson => ({
        employeeId: row.employeeId,
        name: row.name,
        department: row.department,
        plannedMinutes: row.plannedMinutes,
        workedMinutes: row.workedMinutes,
        overtimeMinutes: row.overtimeMinutes,
        overtimeAuthorisedMinutes: row.overtimeAuthorisedMinutes,
        lateMinutes: row.lateMinutes,
        lateDays: row.lateDays,
        absentDays: row.absentDays,
        leaveDays: row.leaveDays,
        decided: decidedLines(
          days.filter((d) => d.employeeId === row.employeeId),
          items.filter((i) => i.employeeId === row.employeeId),
          nameOf,
          row.leaveDays,
        ),
      }),
    );
}

export function buildSnapshot(args: {
  monthKey: string;
  site: { id: string; name: string };
  start: NairobiDate;
  end: NairobiDate;
  approvedAt: Date;
  approvedBy: Decider | null;
  ownHoursIncluded: boolean;
  totals: MonthTotals;
  rules: RuleUsed[];
  rows: readonly PersonMonthRow[];
  days: readonly DayRow[];
  items: readonly OvertimeRow[];
  nameOf: (userId: string | null) => Decider | null;
}): MonthSnapshot {
  const people = snapshotPeople(args.rows, args.days, args.items, args.nameOf);
  return {
    version: 1,
    monthKey: args.monthKey,
    siteId: args.site.id,
    siteName: args.site.name,
    start: args.start,
    end: args.end,
    approvedAt: args.approvedAt.toISOString(),
    approvedBy: args.approvedBy,
    ownHoursIncluded: args.ownHoursIncluded,
    totals: args.totals,
    rules: args.rules,
    people,
  };
}

/** Keys sorted at every level, so the same snapshot always hashes the same. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

export const hashSnapshot = (snapshot: MonthSnapshot): string => createHash('sha256').update(stableStringify(snapshot)).digest('hex');
