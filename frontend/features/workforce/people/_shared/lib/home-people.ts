import { daysBetween, formatDayMonth } from './people-dates';
import type { EmployeeListRow, FilePart } from '../types/people-types';

/**
 * What the Home cards that slice 1a owns show, worked out from the roster (every person on file the viewer may see). Pure and tested.
 * Words follow Paper Chapter 1; a person is named, never "she" or "he".
 */
export const PROBATION_WINDOW_DAYS = 14;
export const COMING_UP_DAYS = 30;

const GAP_WORDS: Partial<Record<FilePart, string>> = {
  IDENTITY: 'ID', JOB: 'job', PAY: 'pay', BANK: 'bank details', LOGIN: 'login', NSSF_SHA: 'NSSF and SHA', PHOTO_AND_DETAILS: 'photo and details',
};
const FINISHING: readonly FilePart[] = ['IDENTITY', 'JOB', 'PAY', 'BANK', 'LOGIN', 'NSSF_SHA', 'PHOTO_AND_DETAILS'];

const current = (rows: readonly EmployeeListRow[]): EmployeeListRow[] => rows.filter((r) => r.status !== 'EXITED');

export const onboardingCount = (rows: readonly EmployeeListRow[]): number => rows.filter((r) => r.status === 'ONBOARDING').length;

export interface BranchCountRow {
  key: string;
  name: string;
  count: number;
}

/** Active people per site, the biggest first. A person still onboarding is not yet counted as active. */
export function peopleByBranch(rows: readonly EmployeeListRow[]): BranchCountRow[] {
  const counts = new Map<string, BranchCountRow>();
  for (const r of rows.filter((x) => x.status === 'ACTIVE' || x.status === 'ON_LEAVE' || x.status === 'NOTICE' || x.status === 'SUSPENDED')) {
    const row = counts.get(r.organizationId) ?? { key: r.organizationId, name: r.organizationName, count: 0 };
    row.count += 1;
    counts.set(r.organizationId, row);
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export interface AttentionRow {
  key: string;
  employeeId: string;
  kind: 'setup' | 'date';
  title: string;
  detail: string;
  age: string;
  late: boolean;
  action: string;
  /** Lower first. */
  rank: number;
}

const gapWords = (gaps: readonly FilePart[]): string => {
  const words = FINISHING.filter((g) => gaps.includes(g)).map((g) => GAP_WORDS[g] ?? g);
  return words.length === 0 ? 'The file needs finishing' : `${words.slice(0, 3).join(', ')}${words.length > 3 ? ` and ${words.length - 3} more` : ''} missing`;
};

const daysWord = (n: number): string => (n <= 0 ? 'TODAY' : n === 1 ? '1 DAY' : `${n} DAYS`);

/** "Finish hiring" (a gap that holds payroll or the rota) and "Probation ends" (within two weeks), most urgent first. */
export function attentionRows(rows: readonly EmployeeListRow[], today: string): AttentionRow[] {
  const out: AttentionRow[] = [];
  for (const r of current(rows)) {
    const holding = r.gaps.filter((g) => FINISHING.includes(g));
    if (holding.length > 0) out.push({ key: `finish-${r.id}`, employeeId: r.id, kind: 'setup', title: `Finish hiring · ${r.name}`, detail: gapWords(holding), age: 'SET UP', late: false, action: 'Finish', rank: 50 });
    if (r.probationEndsOn) {
      const left = daysBetween(today, r.probationEndsOn);
      if (left <= PROBATION_WINDOW_DAYS) {
        out.push({
          key: `probation-${r.id}`, employeeId: r.id, kind: 'date', title: `Probation ends · ${r.name}`, detail: `Decide by ${formatDayMonth(r.probationEndsOn)}`,
          age: daysWord(left), late: left <= 3, action: 'Decide', rank: left,
        });
      }
    }
  }
  return out.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));
}

export interface ComingUpRow {
  key: string;
  date: string;
  text: string;
  on: string;
}

/** Probation ends in the next 30 days, soonest first (the dated items on "Coming up"). */
export function comingUpRows(rows: readonly EmployeeListRow[], today: string): ComingUpRow[] {
  return current(rows)
    .flatMap((r) => {
      if (!r.probationEndsOn) return [];
      const left = daysBetween(today, r.probationEndsOn);
      return left >= 0 && left <= COMING_UP_DAYS ? [{ key: `probation-${r.id}`, date: formatDayMonth(r.probationEndsOn).toUpperCase(), text: `${r.name}: probation decision`, on: r.probationEndsOn }] : [];
    })
    .sort((a, b) => a.on.localeCompare(b.on));
}
