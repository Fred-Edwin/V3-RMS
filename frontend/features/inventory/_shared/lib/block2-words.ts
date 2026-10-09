import { ApiError } from '@/types/api';
import type { DeliveryResult, DispatchDoneResult, DispatchStage } from '../../dispatch/_shared/types/dispatch-contract';

/**
 * The phone wording of Block 2 (dispatch, deliveries), from Paper chapter 12 "D22 States and wording", Paper D1 to D12, N1 to N3,
 * and Dispatch Amendment 1 row 11 and 15. The back end sends facts and codes only; every title and line is written here.
 * Titles, not names; a name shows only where a record states who did something ("Name · Title").
 */

/** "bacon" from "Bacon, collar", "milk" from "Milk 1L": the first word, lower-cased, with no trailing comma or full stop, for "the 2 milk are held". */
export const itemWord = (itemName: string): string => (itemName.trim().split(/\s+/)[0] ?? itemName).replace(/[,.;:]+$/, '').toLowerCase();

/** What the count summary calls the lines that differ: "2 short", "1 extra", or "1 short · 1 extra" when both kinds are there. */
export const differenceText = (directions: ReadonlyArray<'SHORT' | 'EXTRA'>): string => {
  const short = directions.filter((d) => d === 'SHORT').length;
  const extra = directions.length - short;
  return [short > 0 ? `${short} short` : '', extra > 0 ? `${extra} extra` : ''].filter(Boolean).join(' · ');
};

// --- Errors (D22, "Print, and cancel when it is allowed", plus the phone report) ----------------------------------------------

export const BLOCK2_ERROR_COPY: Record<string, string> = {
  INVALID_PIN: 'That PIN is not right. Try again.',
  NOT_ALL_PACKED: 'Every department needs to be ticked first, or left out.',
  NOTHING_TO_SEND: 'Leave at least one department in.',
  CARRIER_INACTIVE: 'That carrier is no longer on the list. Choose another.',
  ALREADY_SIGNED: 'This was already signed and sent.',
  STOCK_CHANGED: 'Stock changed while you were packing. Check the lines marked and sign again.',
  OVER_REQUESTED: 'You cannot send more than was asked for.',
  REQUISITION_NOT_APPROVED: 'This requisition is not approved yet.',
  NOT_SIGNED: 'This delivery has not been signed yet.',
  DISPATCH_ALREADY_COUNTED: 'The branch has already counted this delivery, so it cannot be cancelled. Any gap is now a discrepancy.',
  DISPATCH_CANCELLED: 'The store cancelled this delivery.',
  NOT_YOUR_DEPARTMENT: 'That delivery belongs to another department.',
  NOT_COUNTED: 'Count every line before you sign.',
  RECOUNT_USED: 'Your second count is final.',
  REASON_REQUIRED: 'Pick a reason for each line that still differs.',
  PHOTO_TOO_LARGE: 'That photo is over 5 MB.',
  TOO_MANY_PHOTOS: 'You can add up to 3 photos.',
  PHOTO_TYPE_NOT_ALLOWED: 'Use a JPEG, PNG or WebP photo.',
  COUNT_AGAIN_PENDING: 'Count the flagged lines again to go on.',
  LINE_NOT_DIFFERENT: 'That line matches, so it needs no reason.',
  NOT_ON_THE_WAY: 'This delivery is not on the way.',
  ON_BEHALF_NOT_ALLOWED: 'Only the Branch Manager can confirm for a department.',
};

export const OFFLINE_COUNT_MESSAGE = 'No connection. Your counts are kept; try again when you are back online.';
export const OFFLINE_PACK_MESSAGE = 'No connection. Your ticks are kept; try again when you are back online.';
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Try again.';
export const NO_ACCESS_MESSAGE = "You don't have access.";

/** "Pastry Department Head already confirmed this delivery at 3:35 pm." when the server says who and when; else the plain line. */
const alreadyConfirmed = (details: unknown): string => {
  if (details && typeof details === 'object') {
    const d = details as { confirmedByTitle?: unknown; confirmedAtText?: unknown };
    if (typeof d.confirmedByTitle === 'string' && typeof d.confirmedAtText === 'string') return `${d.confirmedByTitle} already confirmed this delivery at ${d.confirmedAtText}.`;
  }
  return 'This delivery was already confirmed.';
};

export interface ErrorWords {
  offline: string;
}

/** The words for whatever a call threw: a known code gets its line, a lost connection the offline line, anything else the generic one. */
export function block2ErrorMessage(err: unknown, words: ErrorWords = { offline: OFFLINE_COUNT_MESSAGE }): string {
  if (err instanceof ApiError) {
    if (err.code === 'ALREADY_CONFIRMED') return alreadyConfirmed(err.details);
    const known = BLOCK2_ERROR_COPY[err.code];
    if (known) return known;
    if (err.statusCode === 401) return 'Your session ended. Sign in again, then try again.';
    if (err.statusCode === 403) return NO_ACCESS_MESSAGE;
    return GENERIC_ERROR_MESSAGE;
  }
  if (err instanceof TypeError) return words.offline;
  return GENERIC_ERROR_MESSAGE;
}

export const errorCodeOf = (err: unknown): string | null => (err instanceof ApiError ? err.code : null);

/** The line numbers STOCK_CHANGED and NOT_ALL_PACKED hand back (`details.lineIds`, `details.departmentIds`). */
export function detailIds(err: unknown, key: 'lineIds' | 'departmentIds'): string[] {
  if (!(err instanceof ApiError) || !err.details || typeof err.details !== 'object') return [];
  const value = (err.details as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

// --- Chips (D22 "The word on every state") ------------------------------------------------------------------------------------

export type ChipTone = 'neutral' | 'success' | 'warning' | 'info' | 'error';
export interface ChipSpec {
  text: string;
  tone: ChipTone;
  /** A dot in front means someone has to act. */
  dot?: boolean;
}

/** An Attendant's dispatch row on the On the way tab (N2). */
export function onTheWayRowChip(stage: DispatchStage): ChipSpec {
  switch (stage) {
    case 'CONFIRMED':
    case 'CLOSED':
      return { text: 'Counted', tone: 'success' };
    case 'GAP_HELD':
      return { text: 'Gap found', tone: 'warning' };
    case 'WAITING_FOR_BRANCH':
      return { text: 'Waiting for the branch', tone: 'warning', dot: true };
    case 'CANCELLED':
      return { text: 'Cancelled', tone: 'neutral' };
    default:
      return { text: 'On the way', tone: 'info' };
  }
}

/** An Attendant's row on the Done tab (G3). */
export function doneRowChip(result: DispatchDoneResult | null): ChipSpec {
  switch (result) {
    case 'GAP_FOUND':
      return { text: 'Gap found', tone: 'warning' };
    case 'GAP_SETTLED':
      return { text: 'Gap settled', tone: 'neutral' };
    case 'CANCELLED':
      return { text: 'Cancelled', tone: 'neutral' };
    default:
      return { text: 'Confirmed', tone: 'success' };
  }
}

/** The chip on a department's delivery card and file (D7, N3). `arrivedText` is "3:28 pm" once someone opened it. */
export function deliveryChip(stage: DispatchStage, arrivedText: string | null): ChipSpec {
  switch (stage) {
    case 'WAITING_FOR_BRANCH':
      return { text: 'Waiting for the branch', tone: 'warning', dot: true };
    case 'CONFIRMED':
    case 'GAP_HELD':
    case 'CLOSED':
      return { text: 'Counted', tone: 'success' };
    case 'CANCELLED':
      return { text: 'Cancelled', tone: 'neutral' };
    default:
      return arrivedText ? { text: `Arrived · ${arrivedText}`, tone: 'info' } : { text: 'On the way', tone: 'info' };
  }
}

/** The result chip of "My deliveries" (G2). */
export function resultChip(result: DeliveryResult | null, gapCount: number | null): ChipSpec | null {
  if (!result) return null;
  if (result === 'MATCHED') return { text: 'All matched', tone: 'success' };
  const n = gapCount ?? 1;
  const gaps = n === 1 ? '1 gap' : `${n} gaps`;
  return result === 'GAP_OPEN' ? { text: `${gaps} · open`, tone: 'warning' } : { text: `${gaps} · resolved`, tone: 'neutral' };
}

// --- Empty lines (D22 "What every list says when there is nothing to show") -------------------------------------------------------

export const EMPTY_COPY = {
  toPack: { title: 'Nothing to pack', line: 'Approved requisitions appear here.' },
  onTheWay: { title: 'Nothing is on the way', line: 'Deliveries you have signed and sent show here until the branch counts them.' },
  done: { title: 'Nothing done in this range', line: 'Counted and cancelled dispatches show here.' },
  deliveriesWaiting: { title: 'No delivery is waiting', line: 'When the store sends one, it shows here.' },
  myDeliveries: { title: 'No deliveries in this range', line: 'Try a longer date range or another result.' },
} as const;

/** "Name · Title" in a fact box, "Name, Title" inside a tracker line (owner, 9 Oct 2026: files and notes show names). */
export const personDot = (p: { name: string; roleLabel: string }): string => `${p.name} · ${p.roleLabel}`;
export const personComma = (p: { name: string; roleLabel: string }): string => `${p.name}, ${p.roleLabel}`;

export const couldNotLoad =(list: string): string => `Could not load ${list}. Try again.`;
export const LOADING_LINE = 'Loading';
