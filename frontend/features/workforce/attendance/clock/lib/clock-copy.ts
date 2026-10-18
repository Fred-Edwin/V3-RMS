import type { ChoiceOption } from '../../../_shared';
import type { Leftover } from '../../_shared/types/attendance-types';

/** The words of the staff phone (Paper Chapter 6). Reason codes are the ones the server stores (`attendance.constants.ts`). */

export const EARLY_LEAVE_OPTIONS: readonly ChoiceOption[] = [
  { value: 'SENT_HOME', label: 'Sent home by my manager' },
  { value: 'UNWELL', label: 'Unwell' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'OTHER', label: 'Other' },
];

export const STAY_ON_OPTIONS: readonly ChoiceOption[] = [
  { value: 'BUSY', label: 'Busy, customers waiting' },
  { value: 'COVERING', label: 'Covering a colleague' },
  { value: 'CLOSING', label: 'Closing or clean-up tasks' },
  { value: 'MANAGER_ASKED', label: 'My manager asked me to' },
];

export const STAY_ON_ESTIMATES: readonly ChoiceOption[] = [
  { value: '15', label: 'About 15 min' },
  { value: '30', label: 'About 30 min' },
  { value: '60', label: 'About 1 hour' },
];

export const CLOCK_COPY = {
  locationNote: (site: string): string => `Your phone checks you are at ${site}.`,
  undoTitle: (kind: 'IN' | 'OUT', at: string): string => (kind === 'IN' ? `Clocked in at ${at}` : `Clocked out at ${at}`),
  undoNote: 'Tapped by mistake? Undo removes it and nothing is recorded. After two minutes, ask your manager.',
  headsUpTitle: (end: string): string => `Your shift ends at ${end}`,
  headsUpBody: (minutes: number): string => `In ${minutes} minutes your phone will ask you to finish or stay on. Wrap up what you are doing.`,
  noSignalTitle: (kind: 'IN' | 'OUT', at: string): string => `Saved on this phone: clocked ${kind === 'IN' ? 'in' : 'out'} ${at}`,
  noSignalBody: 'There is no signal here. Your tap is kept with the exact time, and it is sent the moment you are online. You do not need to tap again.',
  notSaved: 'This phone could not keep your tap. Try again when you have a signal, or tell your manager.',
  closedTitle: (at: string): string => `Your shift was closed at ${at}`,
  closedBody: 'You did not answer the end-of-shift question within 15 minutes, so the shift was closed at its end and marked for your manager to check. If you worked longer, ask your manager to put it right.',
  switchedOff: 'Your branch still uses the old clock.',
} as const;

/** The box on the shift-end prompt: what is left in the person's own job. Information only; it never stops anyone finishing. */
export function leftoverWords(item: Leftover): { title: string; detail: string; handOver?: { label: string; href: string } } {
  if (item.kind === 'OPEN_TABLES') {
    const n = item.items.length;
    const lines = item.items.map((o) => `${o.table ? `Table ${o.table}` : `Order ${o.orderNumber}`} · KES ${o.unpaid.toLocaleString('en-KE')} unpaid.`);
    return { title: `${n} open ${n === 1 ? 'table is' : 'tables are'} yours`, detail: `${lines.join(' ')} Hand ${n === 1 ? 'it' : 'them'} over before you go.`, handOver: { label: 'Hand over tables', href: '/app/orders' } };
  }
  if (item.kind === 'OPEN_TICKETS') {
    const n = item.items.length;
    const stations = Array.from(new Set(item.items.map((t) => t.station.toLowerCase()))).join(' and ');
    return { title: `${n} ${n === 1 ? 'ticket' : 'tickets'} still open`, detail: `At the ${stations} station. Pass ${n === 1 ? 'it' : 'them'} to the next person.` };
  }
  const n = item.items.length;
  const to = item.items[0]?.toSiteName;
  return { title: `${n} ${n === 1 ? 'dispatch' : 'dispatches'} not yet handed over`, detail: `${to ? `${to} is waiting for ${n === 1 ? 'it' : 'them'}. ` : ''}Hand ${n === 1 ? 'it' : 'them'} over or tell the Store Manager.` };
}
