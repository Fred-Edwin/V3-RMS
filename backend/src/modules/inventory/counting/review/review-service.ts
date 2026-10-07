import type { Request } from 'express';
import { prisma } from '../../../../config/database';
import { NotFoundError, ValidationError } from '../../../../utils/errors';
import { requireHubActor } from '../../_shared/central-store-access';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { countError } from '../_shared/count-errors';
import { approvedWith, isApproveKey } from '../_shared/count-idempotency';
import { readCountDetail } from '../_shared/count-detail-reader';
import { countNotify } from '../_shared/count-notify';
import { countPin } from '../_shared/count-pin';
import { assertSubmitted } from '../_shared/count-state';
import type { CountRecord } from '../_shared/count-record-repository';
import type { ApprovePreview } from '../_shared/counting-contract';
import { alertingLines, buildApprovePreview, postingLines } from './review-preview';
import { reviewRepository, type DecisionData } from './review-repository';
import type { ApproveInput, ApproveOutcome, CountDetail, DecisionInput, SeenInput, SeenResult } from './review.types';

type Actor = NonNullable<Request['user']>;

const loadCount = async (siteId: string, countId: string): Promise<CountRecord> => {
  const count = await reviewRepository.findById(siteId, countId);
  if (!count) throw new NotFoundError('Count not found', 'COUNT_NOT_FOUND');
  return count;
};

/** Outside-range lines still waiting for a decision. */
const undecidedLines = (count: Pick<CountRecord, 'lines'>): string[] => count.lines.filter((l) => l.result === 'EXCEEDS' && l.decision === 'PENDING').map((l) => l.id);

/**
 * Which lines a decision applies to, and whether each may take it: only an outside-range line takes a write-off, a logged movement
 * or a recount request; only a within-range line is accepted; "Clear" takes any judged line's decision back.
 */
const targetsOf = (count: CountRecord, input: DecisionInput): string[] => {
  const kind = input.decision.kind;
  const byId = new Map(count.lines.map((l) => [l.id, l]));

  if (input.group) {
    if (kind !== 'ACCEPTED' && kind !== 'CLEAR') throw new ValidationError('"Accept all within range" can only accept or clear.');
    return count.lines.filter((l) => l.result === 'WITHIN_RANGE' && (kind === 'CLEAR' ? l.decision !== 'PENDING' : l.decision === 'PENDING')).map((l) => l.id);
  }

  const lineIds = [...new Set(input.lineIds ?? [])];
  for (const id of lineIds) {
    const line = byId.get(id);
    if (!line) throw new ValidationError('A line does not belong to this count.');
    const outside = line.result === 'EXCEEDS';
    const within = line.result === 'WITHIN_RANGE';
    if (kind === 'CLEAR') {
      if (!outside && !within) throw new ValidationError(`${line.inventoryItem.name} has no decision to take back.`);
    } else if (kind === 'ACCEPTED') {
      if (!within) throw new ValidationError(`${line.inventoryItem.name} is outside the range, so it cannot just be accepted.`);
    } else if (!outside) {
      throw new ValidationError(`${line.inventoryItem.name} is within the range, so it only needs to be accepted.`);
    }
  }
  return lineIds;
};

const dataOf = (input: DecisionInput, actorId: string, now: Date): DecisionData => {
  const d = input.decision;
  switch (d.kind) {
    case 'CLEAR':
      return { decision: 'PENDING' };
    case 'WRITE_OFF':
      return { decision: 'WRITE_OFF', cause: d.cause, causeNote: d.note?.trim() ? d.note.trim() : null, decidedById: actorId, decidedAt: now };
    case 'MOVEMENT_LOGGED':
      return { decision: 'MOVEMENT_LOGGED', movementKind: d.movementKind, decidedById: actorId, decidedAt: now };
    case 'RECOUNT_ASKED':
    case 'ACCEPTED':
      return { decision: d.kind, decidedById: actorId, decidedAt: now };
  }
};

export const reviewService = {
  /**
   * C27: decide one line, several lines (one cause for all) or the within-range group. Only a SUBMITTED count. All or none: a bad
   * line refuses the lot. "Log a missing movement" and "Ask for a recount" write nothing to stock; they only say what was decided.
   */
  decide: async (actor: Actor, countId: string, input: DecisionInput, now: Date = new Date()): Promise<CountDetail> => {
    const siteId = await requireHubActor(actor);
    const before = await loadCount(siteId, countId);
    assertSubmitted(before.status);
    targetsOf(before, input); // refuse a bad request before taking the lock

    await prisma.$transaction(async (tx) => {
      await reviewRepository.lockCount(tx, siteId, countId);
      const count = await reviewRepository.findById(siteId, countId, tx);
      if (!count) throw new NotFoundError('Count not found', 'COUNT_NOT_FOUND');
      assertSubmitted(count.status);
      const lineIds = targetsOf(count, input);
      if (lineIds.length > 0) await reviewRepository.decideLines(tx, siteId, countId, lineIds, dataOf(input, actor.id, now));
    });
    return readCountDetail(actor, siteId, await loadCount(siteId, countId), now);
  },

  /** C28: what approving will write, line by line, before the Manager signs. */
  approvePreview: async (actor: Actor, countId: string): Promise<ApprovePreview> => {
    const siteId = await requireHubActor(actor);
    const count = await loadCount(siteId, countId);
    assertSubmitted(count.status);
    return buildApprovePreview(count);
  },

  /**
   * C29: approve with the Manager's own PIN. One transaction under a lock on the count: every outside-range line must be decided
   * (`LINES_UNDECIDED`); one `ADJUSTMENT` posts through the ledger door per non-zero written-off or accepted line, each linked to its
   * count line; lines at or above the alert amount are flagged to the Director. All the adjustments or none. A retried key is a
   * replay. A wrong PIN writes nothing.
   */
  approve: async (actor: Actor, countId: string, input: ApproveInput, now: Date = new Date()): Promise<ApproveOutcome> => {
    const siteId = await requireHubActor(actor);
    const before = await loadCount(siteId, countId);
    if (before.status === 'APPROVED' && isApproveKey(before.idempotencyKey, input.idempotencyKey)) {
      return { detail: await readCountDetail(actor, siteId, before, now), replayed: true };
    }
    assertSubmitted(before.status);
    const waiting = undecidedLines(before);
    if (waiting.length > 0) throw countError('LINES_UNDECIDED', 'Decide every item outside the range before you approve.', { lineIds: waiting });

    const holder = await countPin.verifyOwn(actor, input.pin);

    const outcome = await prisma.$transaction(async (tx) => {
      await reviewRepository.lockCount(tx, siteId, countId);
      const count = await reviewRepository.findById(siteId, countId, tx);
      if (!count) throw new NotFoundError('Count not found', 'COUNT_NOT_FOUND');
      if (count.status === 'APPROVED' && isApproveKey(count.idempotencyKey, input.idempotencyKey)) return { replay: true as const, record: count };
      assertSubmitted(count.status);
      const stillWaiting = undecidedLines(count);
      if (stillWaiting.length > 0) throw countError('LINES_UNDECIDED', 'Decide every item outside the range before you approve.', { lineIds: stillWaiting });

      for (const p of postingLines(count)) {
        await postStockMovement(tx, {
          type: 'ADJUSTMENT',
          locationId: count.locationId,
          inventoryItemId: p.line.inventoryItemId,
          quantity: p.difference,
          unitCost: p.line.unitCost!,
          reason: p.reason,
          userId: actor.id,
          links: { countLineId: p.line.id },
        });
      }
      const alerting = alertingLines(count);
      await reviewRepository.flagForDirector(tx, siteId, countId, alerting.map((a) => a.line.id));
      await reviewRepository.markApproved(tx, countId, { approverId: actor.id, approvedAt: now, idempotencyKey: approvedWith(count.idempotencyKey, input.idempotencyKey), lastSavedAt: count.updatedAt });

      return {
        replay: false as const,
        record: (await reviewRepository.findById(siteId, countId, tx))!,
        alertLines: alerting.map((a) => ({ itemName: a.line.inventoryItem.name, valueKes: Number(a.value.toString()) })),
        alertKes: count.directorAlertKes,
      };
    });

    if (outcome.replay) return { detail: await readCountDetail(actor, siteId, outcome.record, now), replayed: true };

    // After the commit, fire and forget: a push must never fail or hold up an approval.
    void countNotify.directorAlert({ countId, reference: outcome.record.reference, signerName: holder.name, alertKes: outcome.alertKes ?? 0, lines: outcome.alertLines }, now);
    return { detail: await readCountDetail(actor, siteId, outcome.record, now), replayed: false };
  },

  /** C30: "Mark seen" on lines flagged to the Director. Only flagged lines, only once; the count of lines marked now comes back. */
  markSeen: async (actor: Actor, input: SeenInput, now: Date = new Date()): Promise<SeenResult> => {
    const siteId = await requireHubActor(actor);
    return { seen: await reviewRepository.markSeen(siteId, [...new Set(input.lineIds)], actor.id, now) };
  },
};
