import type { SignedInAnswer, VerifyAnswer, VerifyView } from '../types/verify-types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ROLES: Record<string, string> = {
  ACCOUNTANT: 'Accountant',
  MANAGER: 'Branch Manager',
  STORE_MANAGER: 'Store Manager',
  HR_MANAGER: 'HR',
  DIRECTOR: 'Director',
  SYSTEM_ADMIN: 'System Admin',
};
export const roleName = (code: string | undefined): string => (code ? (ROLES[code] ?? code.toLowerCase().replace(/_/g, ' ')) : 'signer');

/** Who is told when a printed copy does not match: the document's issuer (6c D3). Unknown number: the System Admin. */
const ISSUER_OF_SLUG: Record<string, string> = { pay: 'Accountant', ps: 'Accountant', p9: 'Accountant', cps: 'Branch Manager', tsh: 'Branch Manager', lve: 'Branch Manager', wrn: 'HR', ctr: 'HR' };
export const issuerRoleOf = (slug: string): string => ISSUER_OF_SLUG[slug.toLowerCase()] ?? 'System Admin';

function parts(iso: string | undefined): { date: string; clock: string; day: string } {
  if (!iso) return { date: '', clock: '', day: '' };
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const v = Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { date: `${v.day} ${MONTHS[Number(v.month) - 1]} ${v.year}`, clock: `${v.hour}:${v.minute}`, day: `${v.year}-${String(v.month).padStart(2, '0')}-${String(v.day).padStart(2, '0')}` };
}

/** "Today 14:30", or the date and time. */
export function checkedWords(iso: string, now: Date = new Date()): string {
  const at = parts(iso);
  return at.day === parts(now.toISOString()).day ? `Today ${at.clock}` : `${at.date} ${at.clock}`;
}

const heading = (a: VerifyAnswer): string => `${a.documentLabel ?? 'Document'} ${a.number ?? ''}`.trim();

/**
 * The seven outcomes of 6c D3, in the owner's wording (decision O3: role and date only). Nothing here can show a name of an employee,
 * a site, a figure or a head count: the answer does not carry them. The signed-in view may add the signer's name only when the API gave it.
 */
export function viewOf(a: VerifyAnswer | SignedInAnswer, slug: string, signedIn: { name: string; role: string } | null, now: Date = new Date()): VerifyView {
  const checked = { label: 'Checked', value: checkedWords(a.checkedAt, now) };
  const si = 'canOpen' in a ? a : null;
  const matched = a.outcome === 'GENUINE' || a.outcome === 'REPLACED' || a.outcome === 'WITHDRAWN' || a.outcome === 'ARCHIVED';

  if (si && matched && !si.canOpen && signedIn) {
    const readers = si.readableBy.length > 0 ? si.readableBy.join(', ') : 'the people it is for';
    return {
      tone: 'warning',
      kicker: `SIGNED IN AS ${signedIn.name}, ${roleName(signedIn.role)}`.toUpperCase(),
      title: `You cannot read ${a.number ?? 'this document'}`,
      text: `It is a ${(a.documentLabel ?? 'document').toLowerCase()} for ${readers}. The check on the earlier page still holds.`,
      rows: [],
      action: 'home',
    };
  }

  const signerWords = si?.signedBy ? `${si.signedBy.name}, ${roleName(si.signedBy.role)}` : `the ${roleName(a.signedByRole)}`;
  const openAction = si?.canOpen ? 'open' : si ? null : 'signin';

  switch (a.outcome) {
    case 'GENUINE':
      return {
        tone: 'success',
        kicker: '✓ THIS COPY MATCHES THE RECORD',
        title: heading(a),
        text: `${a.periodLabel ?? ''}. Signed with a PIN by ${signerWords} on ${parts(a.signedOn).date}.`.replace(/^\. /, ''),
        rows: [{ label: 'Status', value: 'Signed, not changed' }, { label: 'Version', value: String(a.version ?? 1) }, checked],
        action: openAction,
      };
    case 'REPLACED':
      return {
        tone: 'warning',
        kicker: 'THIS COPY IS GENUINE BUT REPLACED',
        title: `${heading(a)}, version ${a.version ?? 1}`,
        text: `Replaced by version ${a.replacedByVersion ?? (a.version ?? 1) + 1} on ${parts(a.replacedOn).date}. Ask for the new copy and do not use this one.`,
        rows: [{ label: 'Status', value: 'Replaced' }, checked],
        action: openAction,
      };
    case 'WITHDRAWN':
      return {
        tone: 'error',
        kicker: 'THIS DOCUMENT WAS WITHDRAWN',
        title: heading(a),
        text: `Withdrawn on ${parts(a.withdrawnOn).date} by the ${roleName(a.withdrawnByRole)}.${a.replacedByNumber ? ` Replaced by ${a.replacedByNumber}.` : ''}`,
        rows: [{ label: 'Status', value: 'Withdrawn' }, checked],
        action: null,
      };
    case 'ARCHIVED':
      return {
        tone: 'neutral',
        kicker: 'THIS DOCUMENT IS ARCHIVED',
        title: heading(a),
        text: `It was signed on ${parts(a.signedOn).date} and is kept in the archive. Ask HR or the Accountant for a check.`,
        rows: [checked],
        action: null,
      };
    case 'RATE_LIMITED':
      return { tone: 'neutral', kicker: 'TOO MANY CHECKS', title: 'Too many checks', text: 'Wait a minute, then scan again.', rows: [], action: null };
    case 'MALFORMED':
    case 'NOT_VERIFIED':
    default:
      return {
        tone: 'error',
        kicker: 'THIS COPY DOES NOT MATCH',
        title: 'We could not match this copy',
        text: 'This copy does not match our records. Do not rely on it. If you were given it to pay from, ask the person who gave it to you.',
        rows: [checked],
        action: si && a.outcome === 'NOT_VERIFIED' ? 'report' : null,
      };
  }
}

/** The report button's words before it is pressed, and after. */
export const reportLabel = (slug: string): string => `Tell the ${issuerRoleOf(slug)}`;
export const reportedLabel = (slug: string): string => `The ${issuerRoleOf(slug)} has been told.`;

/** The first 10 hex characters of the file hash, as printed in the QR; anything else is not sent to the report call. */
export const validHash = (h: string | null): h is string => h !== null && /^[0-9a-f]{10}$/.test(h);
