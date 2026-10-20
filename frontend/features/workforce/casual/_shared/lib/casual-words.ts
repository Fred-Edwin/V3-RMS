import type { SheetStatus } from '../types/casual-types';

/** Words and numbers for the casual-pay screens. Days are Nairobi calendar days ('YYYY-MM-DD'). */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const parts = (day: string): [number, number, number] => {
  const [y, m, d] = day.split('-').map(Number);
  return [y ?? 0, m ?? 1, d ?? 1];
};

/** "12 Oct". */
export function dayMonth(day: string): string {
  const [, m, d] = parts(day.slice(0, 10));
  return `${d} ${MONTHS[m - 1] ?? ''}`;
}
/** "Monday 19 October". */
export function dayLong(day: string): string {
  const [y, m, d] = parts(day);
  const monthName = new Date(Date.UTC(y, m - 1, d)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${monthName}`;
}
/** "Mon 19 Oct". */
export function dayShort(day: string): string {
  const [y, m, d] = parts(day);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]?.slice(0, 3)} ${d} ${MONTHS[m - 1] ?? ''}`;
}
/** "1,800" from "1800.00". */
export function kes(value: string): string {
  const [whole = '0', cents = '00'] = value.split('.');
  const grouped = whole.replace(/-/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${whole.startsWith('-') ? '−' : ''}${grouped}${/^0*$/.test(cents) ? '' : `.${cents}`}`;
}
/** "14:40" in Nairobi from an instant. */
export function clockOf(instant: string): string {
  return new Date(Date.parse(instant) + 3 * 3600_000).toISOString().slice(11, 16);
}

export const STATUS_WORDS: Record<SheetStatus, string> = {
  NONE: '',
  DRAFT: 'Draft',
  SENT: 'Sent to the Branch Manager, waiting',
  SENT_BACK: 'Sent back',
  APPROVED: 'Approved',
  VOID: 'Void',
};

export const CASUAL_COPY = {
  screen: 'Casuals',
  footer: 'Casuals have no login. You record their times, and each one signs on your screen when they are paid.',
  empty: { title: 'No casuals recorded for today.', line: 'Add the people who worked and their times.' },
  noRate: (department: string) => `No daily rate for ${department}. Ask the Director.`,
  sendNeedsOne: 'Add at least one casual.',
  sendAfter: (name: string, time: string) => `${name}’s time ends at ${time}. You can send after that.`,
  saved: 'Saved on this phone, not sent yet',
  offlineSend: 'No signal. Send when you are back online.',
} as const;
