import { nameAndRole } from '../../../_shared';
import type { AuditRow } from '../types/audit-log-types';

/** The words of the Audit log (6a A1 to A4). */
export const AUDIT_COPY = {
  title: 'Audit log',
  subtitle: 'Company log · every area, every entry is written with the change itself · nobody can edit or delete an entry',
  searchPlaceholder: 'Search person, document or word',
  empty: 'No entries in this month.',
  nothingFound: 'No entry matches. Widen the dates or clear the filter.',
  loadError: 'We could not load the log.',
  loadErrorLine: 'Opening it was still recorded.',
  archived: 'Entries older than 7 years are archived.',
  chooseDates: 'Choose dates to go further.',
  datesNote: 'Later dates can’t be picked. The log shows every entry from the first to the last day you choose.',
  exportNothing: 'Nothing to export.',
  exportTooMany: 'Too many to export. Narrow the dates.',
  exportPreparing: 'Preparing your file…',
  exportFailed: 'Could not export. Try again.',
  viewersTitle: 'WHO LOOKED AT THIS LOG',
  viewersNone: 'Nobody else has opened the log.',
  viewersNote: 'Payslip opens show who and when, never how much. The Director reads who opened whose payslip.',
  proofLine: 'Written with the change itself. Nobody can edit or delete it.',
  drawerMissing: 'We could not find that entry.',
} as const;

export const EVENT_LABEL: Record<string, string> = {
  people: 'People',
  time: 'Time and attendance',
  leave: 'Leave',
  pay: 'Pay and payroll',
  rules: 'Rules',
  payslips: 'Payslip access',
  documents: 'Documents',
  conduct: 'Conduct',
  security: 'Security and sign-ins',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Parts {
  d: number;
  m: number;
  y: number;
  hh: string;
  mm: string;
}

function nairobiParts(iso: string): Parts {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const v = Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { d: Number(v.day), m: Number(v.month), y: Number(v.year), hh: v.hour ?? '00', mm: v.minute ?? '00' };
}

/** The table's WHEN: "19 Oct 14:05" (Nairobi). */
export function whenShort(iso: string): string {
  const p = nairobiParts(iso);
  return `${p.d} ${MONTHS[p.m - 1]} ${p.hh}:${p.mm}`;
}

/** The drawer's When: "19 Oct 2026, 14:05". */
export function whenLong(iso: string): string {
  const p = nairobiParts(iso);
  return `${p.d} ${MONTHS[p.m - 1]} ${p.y}, ${p.hh}:${p.mm}`;
}

/** "20 Sep to 19 Oct" on the date button; "to today" when the range ends today. */
export function rangeLabel(from: string, to: string, today: string): string {
  const short = (day: string): string => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
  if (from === to) return to === today ? 'Today' : `${short(to)} ${to.slice(0, 4)}`;
  return `${short(from)} to ${to === today ? 'today' : short(to)}`;
}

const grouped = (n: number): string => n.toLocaleString('en-GB');

/** The footer: "Showing 1 to 50 of 1,284" (SD6), or over the cap "Showing 1 to 50 of over 50,000. Narrow the dates to count them." */
export function footerText(page: number, pageSize: number, shown: number, total: number, exact: boolean): string {
  if (shown === 0) return '';
  const first = (page - 1) * pageSize + 1;
  const last = first + shown - 1;
  return exact ? `Showing ${grouped(first)} to ${grouped(last)} of ${grouped(total)}` : `Showing ${grouped(first)} to ${grouped(last)} of over ${grouped(total)}. Narrow the dates to count them.`;
}

/** The count in plain words for the search line and the export: "1,284 entries", "more than 50,000 entries". */
export function countWords(total: number, exact: boolean): string {
  if (!exact) return `more than ${grouped(total)} entries`;
  return `${grouped(total)} ${total === 1 ? 'entry' : 'entries'}`;
}

/** "3 matches for "oat"" (table convention); null when there is no search. */
export function matchesLine(total: number, exact: boolean, term: string): string | null {
  const t = term.trim();
  if (!t) return null;
  if (!exact) return `More than ${grouped(total)} matches for “${t}”`;
  return `${grouped(total)} ${total === 1 ? 'match' : 'matches'} for “${t}”`;
}

/** The Who cell: "Mercy Achieng, HR"; the system has no role. */
export const whoText = (row: Pick<AuditRow, 'actor'>): string => (row.actor.id === null ? 'The system' : nameAndRole(row.actor.name, row.actor.role));

/** The drawer's Who line, with the assistant channel named. */
export function whoLine(row: Pick<AuditRow, 'actor' | 'channel'>): string {
  const base = whoText(row);
  return row.channel.toUpperCase() === 'ASSISTANT' ? `${base}, via the assistant` : base;
}

/** The mono kicker of the drawer: "PAY AND PAYROLL · WORKFORCE"-style, `AREA · EVENT`. */
export const kickerOf = (row: Pick<AuditRow, 'area' | 'event'>): string => `${row.area === 'ACCESS' ? 'ACCESS' : 'WORKFORCE'} · ${(EVENT_LABEL[row.event] ?? row.event).toUpperCase()}`;

/** The spoken name of a row: "{when}, {who}, {what}, {detail}, flagged". */
export const rowSpeech = (row: AuditRow): string => `${whenShort(row.occurredAt)}, ${whoText(row)}, ${row.title}, ${row.detail}${row.flagged ? ', flagged' : ''}`;

/** A hash shortened for reading: "3f9a…c21e". */
export const shortHash = (hash: string): string => (hash.length > 12 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash);

export const entryNumber = (seq: string): string => grouped(Number(seq));
