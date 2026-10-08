import type { Request } from 'express';
import type { CountStatus } from '@prisma/client';
import { actorCan } from '../../_shared/central-store-access';
import { blindnessOf } from '../../_shared/blind-rule';
import { countNotOpenError, countNotSubmittedError } from './count-errors';
import type { CountDetail, LineResult } from './counting-contract';

type Actor = NonNullable<Request['user']>;

/**
 * The count state machine (contract §5) and every `can{}` flag on a count, in one place:
 *
 *   OPEN ──sign (Attendant)──▶ SUBMITTED ──approve──▶ APPROVED
 *     └────────sign (Manager, counts.resolve)────────────▲        (selfSigned: the adjustments post on this transition)
 *
 * There is no way back and no cancel: a signed count is never edited (a wrong line is counted again).
 */
export const COUNT_TRANSITIONS: Record<CountStatus, readonly CountStatus[]> = {
  OPEN: ['SUBMITTED', 'APPROVED'],
  SUBMITTED: ['APPROVED'],
  APPROVED: [],
};

export const canTransition = (from: CountStatus, to: CountStatus): boolean => COUNT_TRANSITIONS[from].includes(to);

export const assertOpen = (status: CountStatus): void => {
  if (status !== 'OPEN') throw countNotOpenError();
};

export const assertSubmitted = (status: CountStatus): void => {
  if (status !== 'SUBMITTED') throw countNotSubmittedError();
};

/** What the caller may do with counts, from the one capability table (never a role check). */
export type CountCaps = {
  /** counts.read: every count, with figures. */
  read: boolean;
  /** counts.record: start, count and sign their own. */
  record: boolean;
  /** counts.resolve: decide lines, approve, and (signing their own) apply everything. */
  resolve: boolean;
  /** Blind to expected stock, differences and the Manager's judgement (no restock.read). */
  blind: boolean;
  /** Sees item costs (catalog.see_costs). */
  costs: boolean;
};

export const capsOf = (actor: Pick<Actor, 'role'>): CountCaps => {
  const blindness = blindnessOf(actor);
  return {
    read: actorCan(actor, 'counts.read'),
    record: actorCan(actor, 'counts.record'),
    resolve: actorCan(actor, 'counts.resolve'),
    blind: blindness.stockFigures,
    costs: !blindness.itemCosts,
  };
};

/** "In progress", "Waiting for you" (to the one who can approve), "Submitted", "Approved", "Signed" (the Manager's own). */
export const statusTextFor = (count: { status: CountStatus; selfSigned: boolean }, caps: Pick<CountCaps, 'resolve'>): string => {
  if (count.status === 'OPEN') return 'In progress';
  if (count.status === 'SUBMITTED') return caps.resolve ? 'Waiting for you' : 'Submitted';
  return count.selfSigned ? 'Signed' : 'Approved';
};

export type CountCanInput = {
  status: CountStatus;
  /** The caller is the person who started the count. */
  isCounter: boolean;
  caps: CountCaps;
  /** Outside-range lines still without a decision (SUBMITTED counts). */
  toDecide: number;
};

export const countCan = (input: CountCanInput): CountDetail['can'] => {
  const { status, isCounter, caps, toDecide } = input;
  const counting = status === 'OPEN' && isCounter && caps.record;
  const deciding = status === 'SUBMITTED' && caps.resolve;
  return {
    count: counting,
    sign: counting,
    decide: deciding,
    approve: deciding && toDecide === 0,
    print: caps.read && status !== 'OPEN',
  };
};

export type LineCanInput = { status: CountStatus; result: LineResult | null; caps: CountCaps };

/**
 * Per line: `decide` for the Manager on a SUBMITTED count (an outside-range line takes a cause, a movement or a recount; a
 * within-range line is accepted); `countAgain` on a signed count's outside-range line. A blind caller never gets `countAgain`,
 * because the flag itself would tell them which lines exceed.
 */
export const lineCan = (input: LineCanInput): { decide: boolean; countAgain: boolean } => {
  const { status, result, caps } = input;
  const judged = result === 'EXCEEDS' || result === 'WITHIN_RANGE';
  return {
    decide: status === 'SUBMITTED' && caps.resolve && judged,
    countAgain: (status === 'SUBMITTED' || status === 'APPROVED') && caps.record && !caps.blind && result === 'EXCEEDS',
  };
};

export type TrackerInput = {
  status: CountStatus;
  signedAt: Date | null;
  approvedAt: Date | null;
  /** When the last number was saved (the "Counted" step). */
  countedAt: Date | null;
  /** Every outside-range line has a decision. A blind caller is never told, so it only reads true once APPROVED. */
  checked: boolean;
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** Counted → Submitted → Checked → Approved ("Checked" = the Manager decided every outside-range line, owner default N7). */
export const trackerFor = (input: TrackerInput): CountDetail['tracker'] => {
  const { status, checked } = input;
  const signed = status !== 'OPEN';
  const approved = status === 'APPROVED';
  const isChecked = approved || (signed && checked);
  const step = (key: CountDetail['tracker']['steps'][number]['key'], done: boolean, current: boolean, at: Date | null) => ({
    key,
    state: done ? ('DONE' as const) : current ? ('CURRENT' as const) : ('TODO' as const),
    at: done ? iso(at) : null,
  });
  return {
    steps: [
      step('COUNTED', signed, !signed, input.countedAt),
      step('SUBMITTED', signed, false, input.signedAt),
      step('CHECKED', isChecked, signed && !isChecked, approved ? input.approvedAt : null),
      step('APPROVED', approved, isChecked && !approved, input.approvedAt),
    ],
  };
};
