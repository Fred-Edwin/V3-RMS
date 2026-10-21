import { roleWords } from '../../../_shared';
import type { DocumentItem, DocumentPanelData } from '../types/documents-types';

export const DOCUMENTS_COPY = {
  searchPlaceholder: 'Search number, person or word',
  subtitle: 'Every letter and statement signed with a PIN. Each has a QR that opens the same page, so a printed copy can always be checked.',
  empty: 'No signed documents in this period.',
  nothingFound: 'No document matches. Widen the dates or clear the filter.',
  error: 'We could not load the documents.',
  errorLine: 'Opening one is still recorded.',
  openFailed: 'Could not open the document. Try again.',
  archived: 'Archived. Ask support for a copy.',
  linkCopied: 'Link copied.',
  linkFailed: 'Could not copy the link.',
  retention: 'Documents are kept for 7 years from signing, then archived. You see the documents your role may read. Opening one is written in the audit log.',
  noPanel: 'Choose a document to see who signed it.',
} as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso: string): { d: number; m: number; y: number; hh: string; mm: string } {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const v = Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { d: Number(v.day), m: Number(v.month), y: Number(v.year), hh: v.hour ?? '00', mm: v.minute ?? '00' };
}

/** The table's DATE: "19 Oct". */
export const dateShort = (iso: string): string => {
  const p = parts(iso);
  return `${p.d} ${MONTHS[p.m - 1]}`;
};

/** "20 Oct 2026". */
export const dateLong = (iso: string): string => {
  const p = parts(iso);
  return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
};

/** "19 Oct 11:05". */
export const dateTime = (iso: string): string => {
  const p = parts(iso);
  return `${p.d} ${MONTHS[p.m - 1]} ${p.hh}:${p.mm}`;
};

/** The DOCUMENT cell: "Payslip · version 2 · September 2026". */
export function documentLine(d: Pick<DocumentItem, 'title' | 'version' | 'about'>): string {
  return [d.title, d.version > 1 ? `version ${d.version}` : null, d.about].filter(Boolean).join(' · ');
}

/** The grey line under it on a newer version: "Version 2 replaces version 1". */
export const replacesLine = (d: Pick<DocumentItem, 'version' | 'replacesVersion'>): string | null => (d.replacesVersion ? `Version ${d.version} replaces version ${d.replacesVersion}` : null);

/** Status in words (never colour alone). Current has no word. */
export const statusWord = (s: DocumentItem['status']): string | null => (s === 'CURRENT' ? null : s === 'REPLACED' ? 'Replaced' : s === 'WITHDRAWN' ? 'Withdrawn' : 'Archived');

/** "Showing 1 to 50 of 214 documents", or over the cap. */
export function footer(page: number, pageSize: number, shown: number, total: number, exact: boolean): string {
  if (shown === 0) return '';
  const first = (page - 1) * pageSize + 1;
  const n = (x: number): string => x.toLocaleString('en-GB');
  return exact ? `Showing ${n(first)} to ${n(first + shown - 1)} of ${n(total)} documents` : `Showing ${n(first)} to ${n(first + shown - 1)} of over ${n(total)} documents. Narrow the dates to count them.`;
}

/** The status sentence in the panel. */
export function statusLine(p: DocumentPanelData): string | null {
  if (p.status === 'ARCHIVED') return DOCUMENTS_COPY.archived;
  if (p.withdrawn) {
    return `Withdrawn on ${dateLong(p.withdrawn.on)} by ${roleLower(p.withdrawn.byRole)}.${p.withdrawn.replacedByNumber ? ` Replaced by ${p.withdrawn.replacedByNumber}.` : ''}`;
  }
  if (p.status === 'REPLACED' && p.replacedBy) return `Replaced by version ${p.replacedBy.version} on ${dateLong(p.replacedBy.on)}.`;
  return replacesLine(p);
}

const roleLower = (code: string): string => `the ${roleWords(code)}`;

/** The kicker of the panel: "PS-0987 · SIGNED". */
export const panelKicker = (p: Pick<DocumentPanelData, 'number' | 'status'>): string => `${p.number} · ${p.status === 'CURRENT' ? 'SIGNED' : p.status}`;

/** The spoken name of a row. */
export const rowSpeech = (d: DocumentItem): string => `${d.number}, ${documentLine(d)}, signed by ${d.signedBy.role ? roleWords(d.signedBy.role) : d.signedBy.name}, ${dateShort(d.signedAt)}${statusWord(d.status) ? `, ${statusWord(d.status)?.toLowerCase()}` : ''}`;
