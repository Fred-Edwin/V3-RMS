import type { StatusTagTone } from '../../../_shared';
import { formatDayMonth } from '../../_shared/lib/people-dates';
import type { EmployeeListRow, FilePart } from '../../_shared/types/people-types';

/**
 * The words in an Employees row (Paper R1, `Y8C-0`'s list). Pure: the table cell only draws what these return.
 *
 * File column, in order: Exited; a gap that stops payroll or the rota (named when there is one, "Needs finishing" when there are
 * several); the probation end date; otherwise Complete. A missing contract or emergency contact is not a "needs finishing" gap:
 * the contract shows in the Employment column and the emergency contact on the file itself.
 */
const BLOCKING_GAPS: readonly FilePart[] = ['IDENTITY', 'JOB', 'PAY', 'BANK', 'LOGIN', 'NSSF_SHA', 'PHOTO_AND_DETAILS'];

const GAP_WORDS: Record<FilePart, string> = {
  IDENTITY: 'ID details missing',
  JOB: 'Job details missing',
  PAY: 'Pay missing',
  BANK: 'Bank details missing',
  LOGIN: 'Login missing',
  NSSF_SHA: 'NSSF or SHA missing',
  PHOTO_AND_DETAILS: 'Photo and details missing',
  EMERGENCY_CONTACT: 'Emergency contact missing',
  CONTRACT: 'No contract yet',
};

export interface FileCellCopy {
  tone: StatusTagTone;
  label: string;
}

export function fileCellOf(row: Pick<EmployeeListRow, 'status' | 'gaps' | 'probationEndsOn'>): FileCellCopy {
  if (row.status === 'EXITED') return { tone: 'neutral', label: 'Exited' };
  const blocking = row.gaps.filter((g) => BLOCKING_GAPS.includes(g));
  if (blocking.length === 1 && blocking[0]) return { tone: 'warning', label: GAP_WORDS[blocking[0]] };
  if (blocking.length > 1) return { tone: 'warning', label: 'Needs finishing' };
  if (row.probationEndsOn) return { tone: 'warning', label: `Probation ends ${formatDayMonth(row.probationEndsOn)}` };
  return { tone: 'success', label: 'Complete' };
}

/** "Monthly", "Monthly · no contract yet", "Casual · daily, no login". */
export function employmentLine(row: Pick<EmployeeListRow, 'employment' | 'contractStatus'>): string {
  if (row.employment === 'CASUAL') return 'Casual · daily, no login';
  return row.contractStatus === 'NONE' ? 'Monthly · no contract yet' : 'Monthly';
}

/** "Nyeri Town · Service", or just the site when the person has no department (a Branch Manager). */
export function siteDepartmentLine(row: Pick<EmployeeListRow, 'organizationName' | 'departmentName'>): string {
  return row.departmentName ? `${row.organizationName} · ${row.departmentName}` : row.organizationName;
}
