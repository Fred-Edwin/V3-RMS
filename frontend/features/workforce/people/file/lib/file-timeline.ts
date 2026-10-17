import type { LifeEvent } from '../../../_shared';
import { formatDayMonth, formatDayMonthYear } from '../../_shared/lib/people-dates';
import type { EmployeeFile, ExitReason, TimelineEvent } from '../../_shared/types/people-types';

/**
 * "Life at Wendo" (Paper `11LC-0`): the file's events in date order, then the decision still to come (probation) drawn dashed.
 * The API sends machine facts (`kind` and a small `detail`); the words are written here. Capitals in the date, as the kit expects.
 */
export const EXIT_WORDS: Record<ExitReason, string> = {
  RESIGNED: 'Resigned',
  END_OF_CONTRACT: 'End of contract',
  DISMISSED: 'Dismissed',
  REDUNDANCY: 'Redundancy',
  RETIRED: 'Retired',
  OTHER: 'Left',
};

const DOCUMENT_WORDS: Record<string, string> = {
  CONTRACT: 'Contract received',
  ID_COPY: 'ID received',
  NATIONAL_ID_FRONT: 'ID received',
  NATIONAL_ID_BACK: 'ID received',
  CERTIFICATE: 'Certificate received',
  MEDICAL_CERTIFICATE: 'Medical certificate received',
};

const PAY_WORDS: Record<string, string> = {
  HIRING: 'Hired at basic pay',
  PROBATION_CONFIRMED: 'Pay changed: probation confirmed',
  PROMOTION: 'Pay changed: promotion',
  ANNUAL_REVIEW: 'Pay changed: annual review',
  CORRECTION: 'Pay corrected',
};

export function eventText(e: TimelineEvent, file: Pick<EmployeeFile, 'position' | 'probation'>): string {
  const d = e.detail;
  switch (e.kind) {
    case 'HIRED':
      return `Hired as ${file.position?.name ?? 'staff'}${file.probation ? ', probation began' : ''}`;
    case 'REHIRE':
      return 'Rehired, a new start';
    case 'DOCUMENT':
      return DOCUMENT_WORDS[String(d.type)] ?? 'Document received';
    case 'PAY_CHANGE':
      return PAY_WORDS[String(d.reason)] ?? 'Pay changed';
    case 'TRANSFER':
      return `Moved to ${d.toSite ?? 'another site'}`;
    case 'LOAN':
      return `Sent to ${d.toSite ?? 'another site'}`;
    case 'PROBATION':
      return 'Probation decided';
    case 'CONTRACT':
      return `Contract recorded${d.type ? `: ${d.type}` : ''}`;
    case 'EXIT':
      return `Left: ${EXIT_WORDS[d.reason as ExitReason] ?? 'Left'}`;
  }
}

export interface ActivityRow {
  key: string;
  when: string;
  kind: 'Change' | 'Document' | 'Decision';
  what: string;
}

const KIND_WORDS: Record<TimelineEvent['kind'], ActivityRow['kind']> = {
  HIRED: 'Change', REHIRE: 'Change', PAY_CHANGE: 'Change', TRANSFER: 'Change', LOAN: 'Change', CONTRACT: 'Change', EXIT: 'Change', DOCUMENT: 'Document', PROBATION: 'Decision',
};

/** Every event on the file, newest first. The Activity tab shows these until the Audit log can be read by person. */
export function activityRows(file: EmployeeFile): ActivityRow[] {
  return [...file.timeline]
    .sort((a, b) => b.on.localeCompare(a.on))
    .map((e, i) => ({ key: `${e.kind}-${e.on}-${i}`, when: formatDayMonthYear(e.on), kind: KIND_WORDS[e.kind], what: eventText(e, file) }));
}

/** The last `limit` events (default four, the width of the band) in date order, and the probation decision after them. */
export function lifeEvents(file: EmployeeFile, limit = 4): LifeEvent[] {
  const past: LifeEvent[] = [...file.timeline]
    .sort((a, b) => a.on.localeCompare(b.on))
    .map((e, i) => ({ key: `${e.kind}-${e.on}-${i}`, date: formatDayMonth(e.on).toUpperCase(), text: eventText(e, file), state: 'done' as const }));
  const open = file.probation && !file.probation.confirmedOn && file.status !== 'EXITED';
  const future: LifeEvent[] = open && file.probation ? [{ key: 'probation-decision', date: formatDayMonth(file.probation.endsOn).toUpperCase(), text: 'Probation decision', state: 'future' }] : [];
  return [...past.slice(-(limit - future.length)), ...future];
}
