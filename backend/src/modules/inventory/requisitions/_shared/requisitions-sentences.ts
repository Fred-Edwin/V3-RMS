import { CYCLE_TEXT, type EventType, type RequisitionCycle } from './requisitions-contract';

/**
 * The plain-word sentence of one `RequisitionEvent` (contract §4 R4 and §8). The file's Activity tab (R4) and the Audit log's
 * REQUISITIONS source word events with this one function, so the two can never drift apart.
 *
 * Rules: titles and department names, never an account, a PIN or a number that is not on the record. A signed action says
 * "signed with PIN" (the fact, never the PIN). The actor is NOT in the sentence: the screens draw "who" beside it.
 */
export const ON_BEHALF_REASON = 'On behalf of the head';

export interface SentenceEvent {
  type: EventType;
  fromValue: string | null;
  toValue: string | null;
  reason: string | null;
}

export interface SentenceContext {
  reference: string;
  /** The department of the event's section, when it has one. */
  departmentName: string | null;
  /** The line of a quantity change. */
  line: { itemName: string; unit: string } | null;
}

const lines = (n: number): string => `${n} ${n === 1 ? 'line' : 'lines'}`;
const trim = (v: string): string => (v.includes('.') ? v.replace(/\.?0+$/, '') : v);
const quantity = (v: string, unit: string | null): string => `${trim(v)}${unit ? ` ${unit}` : ''}`;
const onBehalf = (e: SentenceEvent): boolean => e.reason === ON_BEHALF_REASON;

const cycleOf = (value: string | null): string => (value && value in CYCLE_TEXT ? CYCLE_TEXT[value as RequisitionCycle] : value ?? '');

/** Whether the sentence names the requisition, so a screen can draw its reference as a record link. */
export const NAMES_REQUISITION: readonly EventType[] = ['STARTED', 'APPROVED', 'CANCELLED'];

export const sentenceOf = (e: SentenceEvent, c: SentenceContext): string => {
  const dept = c.departmentName ?? 'a department';
  switch (e.type) {
    case 'STARTED':
      return `Started ${c.reference}${e.toValue ? ` · ${cycleOf(e.toValue)}` : ''}`;
    case 'LINE_CHANGED':
      return onBehalf(e)
        ? `Filled ${dept}'s list on behalf of its head${e.toValue ? ` · ${e.toValue}` : ''}`
        : `Changed ${dept}'s list${e.toValue ? ` · ${e.toValue}` : ''}`;
    case 'SENT':
      return `Sent ${dept}'s list${onBehalf(e) ? ' on behalf of its head' : ''} · signed with PIN`;
    case 'RECALLED':
      return `Took ${dept}'s list back to draft`;
    case 'QUANTITY_CHANGED': {
      const what = c.line ? `${c.line.itemName}` : 'a line';
      const unit = c.line?.unit ?? null;
      const move = e.fromValue !== null && e.toValue !== null ? ` from ${quantity(e.fromValue, unit)} to ${quantity(e.toValue, unit)}` : '';
      return `Changed ${what}${c.departmentName ? ` in ${c.departmentName}` : ''}${move}${e.reason ? ` · ${e.reason}` : ''}`;
    }
    case 'SKIPPED':
      return `Sent without ${dept}'s list`;
    case 'NUDGED':
      return `Nudged ${dept}`;
    case 'URGENT_SET':
      return `Marked Urgent${e.toValue ? ` · ${e.toValue}` : ''}`;
    case 'URGENT_CLEARED':
      return 'Cleared Urgent';
    case 'APPROVED': {
      const n = e.fromValue !== null && /^\d+$/.test(e.fromValue) ? ` · ${lines(Number(e.fromValue))}` : '';
      return `Approved ${c.reference}${n} · signed with PIN`;
    }
    case 'CANCELLED':
      return `Cancelled ${c.reference}${e.reason ? ` · ${e.reason}` : ''}`;
    case 'ADDITION_ADDED':
      return `Added ${e.toValue ?? 'lines'} to ${dept}'s list after approval · signed with PIN`;
    case 'ADDITION_APPROVED':
      return `Approved ${dept}'s added lines · signed with PIN`;
  }
};
