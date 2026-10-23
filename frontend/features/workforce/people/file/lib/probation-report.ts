import { formatDayMonth } from '../../_shared/lib/people-dates';
import type { EmployeeFile, ProbationNoteView, ProbationVerdict } from '../../_shared/types/people-types';

/** The head's probation report (frames 9.1 to 9.4): Good, Needs work or Not good, with a note. CONCERNS is the older wording. */
export const VERDICT_LABELS: Record<ProbationVerdict, string> = { GOOD: 'Good', NEEDS_WORK: 'Needs work', NOT_GOOD: 'Not good', CONCERNS: 'Concerns' };

/** The three choices a head is offered today. */
export const REPORT_CHOICES: readonly ProbationVerdict[] = ['GOOD', 'NEEDS_WORK', 'NOT_GOOD'];

/** A report that is not Good must say why: HR reads the words, not just the chip. */
export const reportNeedsWords = (verdict: ProbationVerdict | null): boolean => verdict !== null && verdict !== 'GOOD';

export interface HeadReportBlock {
  verdict: ProbationVerdict;
  verdictLabel: string;
  /** "Victor Maina · Head of Kitchen". */
  from: string;
  /** "SENT 19 OCT". */
  sent: string;
  note: string | null;
}

const newest = (notes: readonly ProbationNoteView[]): ProbationNoteView | undefined => [...notes].sort((a, b) => b.createdOn.localeCompare(a.createdOn))[0];

/** Who can read a report, said for whoever is writing it: a head's goes to HR and the head's manager, a manager's to HR and the Director. */
export function reportReaders(role: string | null): string {
  if (role === 'MANAGER' || role === 'STORE_MANAGER') return 'Only HR and the Director can read this.';
  if (role === 'HR_MANAGER') return 'Only HR and the managers of this site can read this.';
  return 'Only HR and your Branch Manager can read this.';
}

/** The latest report from the head, as HR's Decide dialog shows it; null when the head has not written one ("No report yet"). */
export function headReportBlock(file: Pick<EmployeeFile, 'probation'>): HeadReportBlock | null {
  const note = newest((file.probation?.notes ?? []).filter((n) => n.authorKind === 'HEAD'));
  if (!note) return null;
  return {
    verdict: note.verdict,
    verdictLabel: VERDICT_LABELS[note.verdict],
    from: [note.authorName, note.authorPosition].filter(Boolean).join(' · '),
    sent: `SENT ${formatDayMonth(note.createdOn).toUpperCase()}`,
    note: note.note,
  };
}
