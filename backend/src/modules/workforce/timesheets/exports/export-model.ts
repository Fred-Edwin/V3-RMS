import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { Decider } from '../approval/decided-by';
import type { MonthSnapshot, SnapshotPerson } from '../approval/snapshot';
import type { MonthTotals } from '../months/people-rows';
import type { RuleUsed } from '../months/rules-used';

/** One person's day for the Excel "Daily hours" sheet. Times are Nairobi "HH:MM" clock strings. */
export interface DailyRow {
  person: string;
  department: string | null;
  date: NairobiDate;
  plannedIn: string | null;
  plannedOut: string | null;
  clockIn: string | null;
  clockOut: string | null;
  workedMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  result: string;
  decision: string;
}

/** Everything a document needs, assembled once: the PDF and the Excel are both drawn from this and nothing else. */
export interface ExportModel {
  siteName: string;
  monthKey: string;
  monthLabel: string;
  start: NairobiDate;
  end: NairobiDate;
  /** Not approved yet: the file says "Draft, not approved" and carries no number, signature or QR. */
  draft: boolean;
  documentNumber: string | null;
  hashPrefix: string | null;
  approvedAt: Date | null;
  approvedBy: Decider | null;
  /** "Range: 14 to 20 September 2026" (draft) or "Extract: 14 to 20 September 2026" / "Extract: Name" (approved). */
  scopeNote: string | null;
  /** Added to the file name for a range, e.g. "14-20". */
  fileSuffix: string;
  totals: MonthTotals;
  people: SnapshotPerson[];
  rules: RuleUsed[];
  exportedBy: Decider;
  exportedAt: Date;
  qrUrl: string | null;
  daily: DailyRow[];
}

/** The department groups of the people, A to Z, in the order the screen, the PDF and the Excel all use. */
export function groupByDepartment(people: readonly SnapshotPerson[]): { department: string; people: (SnapshotPerson & { id: string })[] }[] {
  const groups = new Map<string, (SnapshotPerson & { id: string })[]>();
  for (const person of people) {
    const name = person.department ?? 'No department';
    groups.set(name, [...(groups.get(name) ?? []), { ...person, id: person.employeeId }]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([department, list]) => ({ department, people: list }));
}

export const fromSnapshot = (snapshot: MonthSnapshot): Pick<ExportModel, 'totals' | 'people' | 'rules'> => ({ totals: snapshot.totals, people: snapshot.people, rules: snapshot.rules });

/** `Timesheet-Nyeri-Town-2026-09.xlsx` (a range adds `-14-20`). */
export function fileNameOf(model: Pick<ExportModel, 'siteName' | 'monthKey' | 'fileSuffix'>, format: 'pdf' | 'xlsx'): string {
  const site = model.siteName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Site';
  return `Timesheet-${site}-${model.monthKey}${model.fileSuffix ? `-${model.fileSuffix}` : ''}.${format}`;
}
