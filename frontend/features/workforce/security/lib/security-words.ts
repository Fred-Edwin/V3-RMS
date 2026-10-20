import type { AlertKind, AlertRow, Phone } from '../types/security-types';

/**
 * Every word of the security screens that is not a kit part (6a S1 to S3). Pure and tested. The UI never explains how phones are recognised
 * (owner, SD15), and no alert wording holds an amount, a code or a payslip number.
 */
const NAIROBI = 'Africa/Nairobi';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const clock = (iso: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
const dayKey = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: NAIROBI }).format(d);

/** "Today 14:03", "Yesterday 09:10", "Mon 12 Oct, 09:10". */
export function whenLabel(iso: string, now: Date): string {
  const at = new Date(iso);
  const days = Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(at))) / 86_400_000);
  if (days === 0) return `Today ${clock(iso)}`;
  if (days === 1) return `Yesterday ${clock(iso)}`;
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, weekday: 'short', day: 'numeric', month: 'short' }).format(at);
  return `${date}, ${clock(iso)}`;
}

/** "14 Jul" for "first used". */
export const shortDate = (iso: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, day: 'numeric', month: 'short' }).format(new Date(iso));

/** "Nairobi" becomes "Nairobi (approximate)": a place comes from a coarse lookup, never an address. */
export const placeWords = (place: string | null): string => (place ? `${place} (approximate)` : 'Place not known');

/** The second line of a phone card: "Nyeri · first used 14 Jul · last seen now". */
export function phoneMeta(phone: Phone, now: Date): string {
  const used = dayKey(new Date(phone.firstSeenAt)) === dayKey(now) ? `first used today ${clock(phone.firstSeenAt)}` : `first used ${shortDate(phone.firstSeenAt)}`;
  const seen = phone.isThisPhone ? 'last seen now' : phone.notUsedFor12Months ? 'not used for 12 months' : `last seen ${whenLabel(phone.lastSeenAt, now).toLowerCase()}`;
  return [phone.placeLabel, used, seen].filter(Boolean).join(' · ');
}

export const PHONE_COPY = {
  questionTitle: 'Is this your phone?',
  questionLine: 'This is the first time you have signed in on this phone.',
  yes: 'Yes, this is my phone',
  once: 'Use it just once',
  onceNote: '"Use it just once" signs out when you close the app, and this phone is not remembered. Every other phone you already use is told about this sign-in.',
  listLine: 'Phones that have signed in as you. A payslip opened on a phone you have not confirmed raises an alert.',
  empty: 'No other phones. This is the only phone that has signed in.',
  offline: 'No signal. Your phones need a connection.',
  signOutInstead: 'Sign out instead',
  keep: 'Keep it',
  removeThis: 'Remove this phone',
  removed: 'Removing a phone is written to Activity on my record.',
  removeLine: 'It is signed out at once. The next time it is used, you are asked again whether it is yours.',
  many: (n: number): string => `You have signed in on ${n} phones.`,
  showing: (n: number): string => `Showing ${n} of ${n} ${n === 1 ? 'phone' : 'phones'}`,
} as const;

export const removeTitle = (phone: Pick<Phone, 'label'>): string => `Remove ${phone.label}?`;

/** The spoken name of a phone card: "Tecno, Android, not confirmed". */
export const phoneRegionName = (phone: Phone): string => `${phone.label}${phone.isThisPhone ? ', this phone' : ''}, ${phone.confirmed ? 'confirmed' : 'not confirmed'}`;

// ── "This wasn't me" and the password reset (S3) ────────────────────────────────────────────────────────────────────────────────

export const WASNT_ME_COPY = {
  title: 'Payslip opened',
  question: "This wasn't me?",
  intro: 'If you press it, three things happen at once:',
  steps: ['Every phone and computer signed in as you is signed out.', 'You choose a new password and a new code next time.', 'The System Admin is told straight away.'],
  yes: "Yes, this wasn't me",
  no: 'That was me',
  doneTitle: 'We signed you out everywhere',
  doneLine: 'The System Admin has been told. Your pay was not changed. Choose a new password to come back in.',
  currentLabel: 'Your current password',
  currentHelp: 'We need it once to let you in, so you can choose the new one.',
  newLabel: 'New password',
  newHelp: 'At least 8 characters',
  againLabel: 'Say it again',
  save: 'Save and sign in',
  wrongCurrent: 'That is not your current password.',
} as const;

export interface PasswordCheck {
  newPassword: string | null;
  confirm: string | null;
}

/** The reset page's own checks, before the server's (8 characters, the two match). The server also refuses the old password. */
export function checkPasswords(newPassword: string, confirm: string): PasswordCheck {
  return {
    newPassword: newPassword.length < 8 ? 'Use at least 8 characters.' : null,
    confirm: confirm !== '' && confirm !== newPassword ? 'The two passwords are different.' : null,
  };
}

// ── Security alerts, the System Admin's view (S1) ────────────────────────────────────────────────────────────────────────────────

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  WASNT_ME: "This wasn't me",
  UNCONFIRMED_PHONE: 'Unconfirmed phone',
  WRONG_CODES: '3 wrong codes',
  CHAIN_FAILED: 'Chain check failed',
};

const who = (a: Pick<AlertRow, 'person'>): string => (a.person ? `${a.person.name}, ${a.person.role}` : 'Someone');
const monthName = (key: string | null): string => {
  const m = key && /^\d{4}-(\d{2})$/.exec(key);
  return m ? (MONTHS[Number(m[1]) - 1] ?? 'A') : 'A';
};
const where = (a: Pick<AlertRow, 'deviceLabel' | 'placeLabel' | 'occurredAt'>): string => [a.deviceLabel ?? 'A phone', a.placeLabel, clock(a.occurredAt)].filter(Boolean).join(', ');

/** The exact sentences of 6a S1 (the server's wording rows, repeated here so the panel title and the table agree). */
export function alertTitle(a: AlertRow): string {
  switch (a.kind) {
    case 'WASNT_ME':
      return `${who(a)} pressed This wasn't me for a payslip opening at ${clock(a.occurredAt)}. Every session was signed out. The audit row is open beside this.`;
    case 'UNCONFIRMED_PHONE':
      return `${who(a)}'s ${monthName(a.detail)} payslip was opened on a phone that is not confirmed: ${where(a)}. Nothing is locked. The audit row is open beside this.`;
    case 'WRONG_CODES':
      return `3 wrong codes on ${who(a)}'s payslips. ${where(a)}. Nothing is locked.`;
    case 'CHAIN_FAILED':
      return `The audit chain check found a problem at entry ${a.detail ?? 'unknown'}.`;
  }
}

export const ALERT_COPY = {
  title: 'Security alerts',
  subtitle: 'Account and sign-in events that need a person to look. Nothing here shows an amount.',
  empty: 'No security alerts. A new one shows here and as a badge on the menu.',
  noteLabel: 'What did you do?',
  noteReason: 'Write what you did.',
  clear: 'Clear this alert',
  cleared: 'Cleared. The note is saved in the log.',
  wasntMeFacts: 'Every session was signed out. A new password and a new code are required.',
  openEntry: 'Open the audit entry',
  resetNow: 'Reset the password now',
  startTitle: 'Alerts for unconfirmed phones are not started',
  startLine: 'Until every person has been asked "Is this your phone?" once, an opening on an unconfirmed phone raises no alert. Start alerts when the rollout is done.',
  start: 'Start alerts',
} as const;

export const clearedByLine = (by: { name: string; role: string } | null, at: string | null): string =>
  `Cleared by ${by ? `${by.name}, ${by.role}` : 'another System Admin'}${at ? ` at ${clock(at)}` : ''}.`;

/** The note must have at least three characters (the server's rule). */
export const noteOk = (note: string): boolean => note.trim().length >= 3;
