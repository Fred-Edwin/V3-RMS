import { Prisma, type CountCause, type CountRecheck } from '@prisma/client';
import { ValidationError } from '../../../../utils/errors';
import { isDirectorAlert, judgeLine, shortStreak } from '../../_shared/variance-calc';
import type { CountLineRecord } from '../_shared/count-record-repository';
import type { CountSettingsInForce } from '../_shared/count-settings';
import { CAUSE_TEXT } from '../_shared/counting-contract';
import type { LineFreeze, SectionRow } from './record-repository';

const ZERO = new Prisma.Decimal(0);
const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);

// --- Section order (C8) ---------------------------------------------------------

/**
 * The sections in the order to show: this person's own order for today when they set one (sections added since are appended in the
 * Manager's shelf order; ids that no longer exist are ignored), else the Manager's shelf order.
 */
export const orderedSections = (shelf: readonly SectionRow[], today: readonly string[] | null): SectionRow[] => {
  if (!today || today.length === 0) return [...shelf];
  const byId = new Map(shelf.map((s) => [s.id, s]));
  const own = today.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const ownIds = new Set(own.map((s) => s.id));
  return [...own, ...shelf.filter((s) => !ownIds.has(s.id))];
};

// --- Saving a number (C10) ------------------------------------------------------

export type SaveLine = { countedQty: string | null; skipped: boolean; recheck?: 'RECOUNTED' | 'KEPT' | undefined };
export type SavedLine = { countedQty: Prisma.Decimal | null; skipped: boolean; recheck?: CountRecheck; firstCountedQty?: Prisma.Decimal | null };

/**
 * What one saved line becomes. Last write wins. Typing a number clears Skip, Skip clears the number, and sending neither puts the
 * line back to untouched. The section-end recheck (offered once per line) is `RECOUNTED` (a new number, the first one kept in
 * `firstCountedQty`) or `KEPT` ("Continue as counted": the number stays as it is).
 */
export const applySave = (line: Pick<CountLineRecord, 'countedQty' | 'skipped' | 'recheck' | 'recheckOffered' | 'firstCountedQty'>, input: SaveLine): SavedLine => {
  const typed = input.countedQty !== null ? D(input.countedQty) : null;

  if (input.recheck) {
    // Offered once, answered once: a line that was never offered, or already answered, cannot be rechecked.
    if (!line.recheckOffered || line.recheck !== 'NONE') throw new ValidationError('That item was not offered for a recount, so it cannot be rechecked.');
    if (input.recheck === 'KEPT') return { countedQty: line.countedQty, skipped: line.skipped, recheck: 'KEPT' };
    if (typed === null) throw new ValidationError('A recount needs the new number.');
    return { countedQty: typed, skipped: false, recheck: 'RECOUNTED', firstCountedQty: line.firstCountedQty ?? line.countedQty };
  }

  if (typed !== null) return { countedQty: typed, skipped: false };
  return { countedQty: null, skipped: input.skipped };
};

// --- Freezing at the sign (C13) -------------------------------------------------

export type SelfSignCause = { cause: CountCause; note: string | null };

export type FreezeMode =
  /** An Attendant signs: the count is SUBMITTED and waits for the Manager. */
  | { kind: 'SUBMIT' }
  /** A Manager signs her own count: every non-zero line applies now, and she names a cause for each outside-range line. */
  | { kind: 'SELF_SIGN'; actorId: string; causes: ReadonlyMap<string, SelfSignCause> };

export type LinePlan = {
  lineId: string;
  itemId: string;
  itemName: string;
  freeze: LineFreeze;
  /** The adjustment to post (quantity is the signed difference), when this line writes one. */
  post: { quantity: Prisma.Decimal; unitCost: Prisma.Decimal; reason: string } | null;
  /** Signed KES value, when the line is at or above the Director alert amount. */
  alertValueKes: number | null;
  /** True when the line is outside the range and flagged to the Director. */
  flagged: boolean;
};

export type FreezePlan = { plans: LinePlan[]; missingCauses: string[] };

/** The reason written on a count adjustment: the cause words, with the note after them for "Other". */
export const adjustmentReason = (cause: CountCause, note: string | null): string => (note ? `${CAUSE_TEXT[cause]}: ${note}` : CAUSE_TEXT[cause]);

/**
 * The moment figures are frozen (contract §5.3): for each line, expected = the ledger on-hand at the sign, cost = the item's cost,
 * the judged result against the settings in force, and the repeat-shortfall streak. A Manager's own sign also decides every
 * non-zero line (outside the range: written off with her cause; within the range: accepted), flags the outside-range lines and
 * raises the Director alert. Pure: the service posts the plan.
 */
export const planFreeze = (args: {
  lines: readonly CountLineRecord[];
  onHand: ReadonlyMap<string, Prisma.Decimal>;
  settings: CountSettingsInForce;
  recentDifferences: ReadonlyMap<string, readonly Prisma.Decimal[]>;
  mode: FreezeMode;
  signedAt: Date;
}): FreezePlan => {
  const { settings, mode, signedAt } = args;
  const plans: LinePlan[] = [];
  const missingCauses: string[] = [];

  for (const line of args.lines) {
    const expected = args.onHand.get(line.inventoryItemId) ?? ZERO;
    const unitCost = line.inventoryItem.currentCost;
    const base = { lineId: line.id, itemId: line.inventoryItemId, itemName: line.inventoryItem.name };
    const judged = judgeLine({ counted: line.countedQty, expected, unitCost, rangeKes: settings.rangeKes, rangePercent: settings.rangePercent });

    if (judged.result === 'NOT_COUNTED' || !judged.difference || !judged.value) {
      plans.push({ ...base, freeze: { expectedQty: expected, unitCost, result: 'NOT_COUNTED', shortStreak: 0 }, post: null, alertValueKes: null, flagged: false });
      continue;
    }

    const streak = judged.difference.isNegative() ? shortStreak([judged.difference, ...(args.recentDifferences.get(line.inventoryItemId) ?? [])], settings.flagRepeat) : 0;
    const alerting = isDirectorAlert(judged.difference, unitCost, settings.directorAlertKes);
    const freeze: LineFreeze = { expectedQty: expected, unitCost, result: judged.result, shortStreak: streak };
    let post: LinePlan['post'] = null;
    let flagged = false;

    if (mode.kind === 'SELF_SIGN' && !judged.difference.isZero()) {
      if (judged.result === 'EXCEEDS') {
        const chosen = mode.causes.get(line.id);
        if (!chosen || (chosen.cause === 'OTHER' && !chosen.note)) missingCauses.push(line.id);
        else {
          Object.assign(freeze, { decision: 'WRITE_OFF', cause: chosen.cause, causeNote: chosen.note, decidedById: mode.actorId, decidedAt: signedAt });
          post = { quantity: judged.difference, unitCost, reason: adjustmentReason(chosen.cause, chosen.note) };
          flagged = true;
        }
      } else if (judged.result === 'WITHIN_RANGE') {
        Object.assign(freeze, { decision: 'ACCEPTED', decidedById: mode.actorId, decidedAt: signedAt });
        post = { quantity: judged.difference, unitCost, reason: 'Within range · accepted' };
      }
      if (alerting) freeze.directorAlert = true;
      if (flagged || alerting) freeze.directorFlagged = true;
    }

    plans.push({ ...base, freeze, post, alertValueKes: mode.kind === 'SELF_SIGN' && alerting ? Number(judged.value.toString()) : null, flagged: mode.kind === 'SELF_SIGN' && (flagged || alerting) });
  }
  return { plans, missingCauses };
};
