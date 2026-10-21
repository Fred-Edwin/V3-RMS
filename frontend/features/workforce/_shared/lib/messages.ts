import { ApiError } from '@/types/api';

/**
 * The one table of "when things go wrong" words (6b M1, Paper Chapter 16 step 4 and the States kit). The server answers a stable `code`
 * and the screen looks up the words here, so every screen says the same thing the same way. Nobody is signed out automatically for
 * inactivity and nobody is ever locked out for wrong codes: a wrong code pauses, it never locks.
 *
 * `messageFor(code, vars)` returns the line to show, or null when the code is not in the table (the caller then shows the server's own
 * message, never a made-up one). Pure and tested; the test also checks the codes the server declares are all here.
 */
export interface MessageVars {
  /** Seconds to wait (a pause, never a lock). */
  waitSeconds?: number;
  name?: string;
  role?: string;
  /** "10:42" or "Mon 19 Oct". */
  time?: string;
  date?: string;
  month?: string;
  site?: string;
  version?: number;
}

type Words = (v: MessageVars) => string;

const wait = (v: MessageVars): string => `Wait ${v.waitSeconds ?? 2} seconds, then try again.`;
const person = (v: MessageVars): string => `${v.name ?? 'Someone'}${v.role ? `, ${v.role}` : ''}`;

export const MESSAGES: Record<string, Words> = {
  // A wrong payslip code: the box says it; from the 5th the button waits.
  CODE_WRONG: () => 'That code is not right. Try again.',
  CODE_SLOWED: wait,
  // A wrong signing PIN (approve, publish, pay): nothing is approved; from the 5th an answer waits.
  PIN_INVALID: () => 'That PIN is not right. Try again.',
  PIN_SLOWED: wait,
  PIN_NOT_SET: () => 'Set your signing PIN first.',
  // Two people change the same thing: the card has the full story; this is the one line.
  CHANGED_UNDERNEATH: () => 'Someone else changed this first. Nothing was overwritten.',
  PEOPLE_CANNOT_BE_PAID: (v) => `${person(v)} has no pay profile and is left out of ${v.month ?? 'this month'}.`,
  MONTH_NOT_CALCULABLE: (v) => `Payroll waits for ${v.site ?? 'a site'}. The month is not calculated until every site has approved.`,
  MONTH_LOCKED: (v) => `This month is locked. It was marked as paid on ${v.date ?? 'an earlier date'}. Nothing can change.`,
  BANK_FILE_CHANGED: (v) => `Version ${v.version ?? 2} saved. The bank file you downloaded on ${v.date ?? 'an earlier date'} is marked void. Download the new file.`,
  PERIOD_APPROVED: () => 'This month is approved. Tell HR.',
  // Already done by someone else.
  ALREADY_DECIDED: (v) => `Decided by ${v.role ?? 'someone else'}${v.time ? ` at ${v.time}` : ''}. Check it again.`,
  ALREADY_APPROVED: (v) => `Decided by ${v.role ?? 'someone else'}${v.time ? ` at ${v.time}` : ''}. Check it again.`,
  ALREADY_CLEARED: (v) => `Cleared by ${person(v)}${v.time ? ` at ${v.time}` : ''}.`,
  RATE_LIMITED: () => 'Too many tries. Wait a moment, then try again.',
  // The server ended the sign-in (never for inactivity).
  SESSION_ENDED: () => 'Please sign in again.',
  PHONE_REMOVED: () => 'This phone was removed. Sign in again.',
  PASSWORD_RESET_REQUIRED: () => 'Choose a new password to come back in.',
};

/** The second line some messages carry. */
export const MESSAGE_SECOND_LINES: Record<string, Words> = {
  MONTH_LOCKED: () => "Changes to a paid month go through support, or into next month's payroll.",
};

/** Situations with no server code: the phone knows them itself (Chapter 16 steps 1 and 2). */
export const SITUATIONS = {
  noSignalClockIn: { strip: 'No signal. You can still clock in.', saved: (at: string) => `Clock-in at ${at}`, keep: 'It will be sent by itself when the signal comes back. You do not need to do anything. Keep the app installed.', sent: (at: string) => `Sent. Your clock-in at ${at} is recorded.` },
  codeRecorded: { kicker: 'RECORDED, NOT LOCKED', title: '3 wrong codes were recorded', line: "Nothing is locked, and the payslips stay private. This phone, the time and the person signed in are recorded, and the payslip's owner has been told.", again: 'Try the code again', forgot: 'If you forgot your code, ask HR to reset it. Every attempt is written in Activity on my record.' },
  shiftClosed: (weekday: string, at: string) => `Your ${weekday} shift was closed at ${at}. Your manager has been asked to check.`,
  tooMany: 'Too many tries. Wait a moment, then try again.',
} as const;

export function messageFor(code: string, vars: MessageVars = {}): string | null {
  const words = MESSAGES[code];
  return words ? words(vars) : null;
}

/** The second line of a message, when it has one. */
export function secondLineFor(code: string, vars: MessageVars = {}): string | null {
  const words = MESSAGE_SECOND_LINES[code];
  return words ? words(vars) : null;
}

/** How the page answers a failure, from its HTTP status and code: a conflict card, a "not in your menu" card, a fault card, or a line. */
export type FailureKind = 'conflict' | 'not-in-menu' | 'fault' | 'sign-in' | 'line';

export function failureKind(status: number, code: string): FailureKind {
  if (code === 'CHANGED_UNDERNEATH') return 'conflict';
  if (code === 'SESSION_ENDED') return 'sign-in';
  if (status === 404) return 'not-in-menu';
  if (status >= 500) return 'fault';
  return 'line';
}

/** The seconds to wait, from a refused answer (`details.waitSeconds`). 0 when the answer carries none. */
export function waitSecondsOf(err: unknown): number {
  if (!(err instanceof ApiError)) return 0;
  const details = err.details;
  if (details && typeof details === 'object' && 'waitSeconds' in details) {
    const n = Number((details as { waitSeconds: unknown }).waitSeconds);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 120) : 0;
  }
  return 0;
}

/** The line for a failed call: the table when the code is in it (with the wait filled in), else the server's own message, else the fallback. */
export function lineForError(err: unknown, fallback: string, vars: MessageVars = {}): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.statusCode === 429 && !MESSAGES[err.code]) return messageFor('RATE_LIMITED') ?? fallback;
  return messageFor(err.code, { waitSeconds: waitSecondsOf(err), ...vars }) ?? (err.message || fallback);
}
