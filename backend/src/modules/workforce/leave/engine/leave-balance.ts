import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { TONE_AMBER_BELOW, TONE_RED_BELOW } from '../leave.constants';
import type { BarTone, CountedApplication, LedgerLine } from '../leave.types';
import { takenAndBooked } from './leave-days';

export interface BalanceInput {
  year: number;
  today: NairobiDate;
  /** Days the rules grant for the year as of the day asked (`entitlementFor`). */
  entitlement: number;
  /** The year's ledger lines for this person and type. */
  ledger: readonly LedgerLine[];
  /** Approved applications of the new system for this person and type (carried legacy rows never count again, L4). */
  approved: readonly CountedApplication[];
}

export interface BalanceFigures {
  credited: number;
  taken: number;
  booked: number;
  /** Credited minus taken minus booked, never shown below zero. Waiting requests are not subtracted (L11). */
  left: number;
  /** The same figure without the floor: negative when a rules change or an adjustment left the person over-booked. */
  raw: number;
}

/** The balance of one type in one year (spec section 3). Whole days only. */
export function balanceOf(input: BalanceInput): BalanceFigures {
  const fromLedger = input.ledger.reduce((sum, line) => sum + line.days, 0);
  const credited = Math.max(0, Math.floor(input.entitlement) + fromLedger);
  const { taken, booked } = takenAndBooked(input.approved, input.year, input.today);
  const raw = credited - taken - booked;
  return { credited, taken, booked, left: Math.max(0, raw), raw };
}

/**
 * The bar colour on the cards, fixed in code (spec section 3): left over the full year's figure. A type without a limit or with a
 * zero yearly figure shows no bar.
 */
export function toneOf(left: number, perYear: number | null): BarTone {
  if (perYear === null || perYear <= 0) return 'NONE';
  const share = left / perYear;
  if (share >= TONE_AMBER_BELOW) return 'GREEN';
  if (share >= TONE_RED_BELOW) return 'AMBER';
  return 'RED';
}

/** What the person could still take off the balance, and what an unpaid tail would have to cover. */
export function shortfallOf(daysAsked: number, left: number): number {
  return Math.max(0, daysAsked - left);
}
