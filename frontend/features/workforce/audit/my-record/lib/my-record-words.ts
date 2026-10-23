import type { RecordChip, RecordItem } from '../types/my-record-types';

export const RECORD_COPY = {
  screen: 'Activity on my record',
  kicker: 'MY RECORD',
  subtitle: 'done to your file this month. Amounts are never shown.',
  subtitleRange: 'done to your file in this period. Amounts are never shown.',
  empty: 'Nothing has been done to your file this month.',
  emptyRange: 'Nothing has been done to your file in this period.',
  nothingFound: 'Nothing matches. Choose another group or other dates.',
  error: 'We could not load your record.',
  errorLine: 'Nothing was changed.',
  notMeNote: 'If this was not you, we sign out every device, you choose a new password, and the System Admin is told straight away.',
  whatHappened: 'What happened',
  by: 'By',
  when: 'When',
  thanks: 'Thank you. Noted.',
  meButton: 'That was me',
  notMeButton: 'This wasn’t me',
  confirmTitle: 'Sign out every phone and computer?',
  confirmLine: 'You will choose a new password and a new code. The System Admin is told straight away.',
  confirmYes: 'Yes, this wasn’t me',
  confirmNo: 'Cancel',
  answeredMe: 'You said this was you.',
  answeredNotMe: 'You said this was not you. Every phone was signed out and the System Admin was told.',
  failed: 'We could not save that. Nothing was changed. Check your signal and try again.',
} as const;

export const CHIPS: readonly { value: RecordChip; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pay', label: 'Pay' },
  { value: 'time', label: 'Time' },
  { value: 'leave', label: 'Leave' },
  { value: 'file', label: 'File' },
  { value: 'conduct', label: 'Conduct' },
  { value: 'signins', label: 'Sign-ins' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso: string): { day: string; d: number; m: number; clock: string } {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const v = Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { day: `${v.year}-${String(v.month).padStart(2, '0')}-${String(v.day).padStart(2, '0')}`, d: Number(v.day), m: Number(v.month), clock: `${v.hour}:${v.minute}` };
}

/** The card's mono time: "Today 10:02", "Yesterday 16:40", "12 Oct 09:15" (Nairobi). */
export function timeWords(iso: string, now: Date): string {
  const at = parts(iso);
  const today = parts(now.toISOString()).day;
  const yesterday = parts(new Date(now.getTime() - 86_400_000).toISOString()).day;
  if (at.day === today) return `Today ${at.clock}`;
  if (at.day === yesterday) return `Yesterday ${at.clock}`;
  return `${at.d} ${MONTHS[at.m - 1]} ${at.clock}`;
}

/** The mono "Showing 6 of 23" line under the list. */
export const showing = (shown: number, total: number): string => (total === 0 ? '' : `Showing ${shown} of ${total}`);

/** The big figure: "23 entries". */
export const entriesWord = (total: number): string => `${total} ${total === 1 ? 'entry' : 'entries'}`;

/** Spoken name of a card: "{title}, {line}, {time}, needs your answer". */
export function cardSpeech(item: RecordItem, now: Date): string {
  return `${item.title}, ${item.line}, ${timeWords(item.occurredAt, now)}${item.needsAnswer ? ', needs your answer' : ''}`;
}

/** The first and last day of the Nairobi month that holds `now`. */
export function thisMonth(now: Date): { from: string; to: string } {
  const today = parts(now.toISOString()).day;
  return { from: `${today.slice(0, 8)}01`, to: today };
}
