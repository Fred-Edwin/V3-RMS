import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { mapPrismaError } from '../../../../utils/prisma-errors';
import { actorCan, requireHubActor, requireHubReader } from '../../_shared/central-store-access';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { assertValidInputs } from '../record/record-logic';
import { assess, loadItems, toInputs, yieldLabel } from '../record/record-service';
import { recordRepository } from '../record/record-repository';
import { FIX_WINDOW_HOURS } from '../_shared/prep-constants';
import { prepRunRepository, type PrepRunRow } from '../_shared/prep-run-repository';
import { serializeRunDetail } from '../_shared/prep-run-serializer';
import { fixRepository } from './fix-repository';
import type { CancelRequest, CorrectRequest } from './fix-validators';
import type { CancelPreviewItem, CorrectOutcome } from './fix.types';

type Actor = NonNullable<Request['user']>;
type Tx = Prisma.TransactionClient;

const D = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);
const WINDOW_MS = FIX_WINDOW_HOURS * 60 * 60 * 1000;

const notOpen = (): ConflictError => new ConflictError('This run was already corrected or cancelled', 'RUN_NOT_OPEN');

/**
 * The window rule (a service rule, not a capability): without `prep.fix_any` a caller may fix only their own run and only within
 * FIX_WINDOW_HOURS of recording it. Otherwise 403 PREP_RUN_LOCKED, "Ask the Store Manager".
 */
export const assertCanFix = (run: Pick<PrepRunRow, 'createdById' | 'createdAt'>, actor: Pick<Actor, 'id' | 'role'>, now: Date): void => {
  if (actorCan(actor, 'prep.fix_any')) return;
  if (run.createdById === actor.id && now.getTime() - run.createdAt.getTime() <= WINDOW_MS) return;
  throw new ForbiddenError('Ask the Store Manager', 'PREP_RUN_LOCKED');
};

/** One reversing row for every ledger row of the run that is still standing: the original's type, the opposite sign. */
const reverseRun = async (tx: Tx, siteId: string, run: PrepRunRow, actor: Actor): Promise<void> => {
  const rows = await prepRunRepository.findReversibleRows(siteId, run.id, tx);
  for (const row of rows) {
    await postStockMovement(tx, {
      type: row.type,
      locationId: row.locationId,
      inventoryItemId: row.inventoryItemId,
      quantity: row.quantity.abs(),
      unitCost: row.unitCost,
      userId: actor.id,
      links: { prepRecordId: run.id },
      reversesTransactionId: row.id,
    });
  }
};

export const fixService = {
  /** #11 Correct a run: undo it with reversing rows, record the replacement, all in one transaction. 200 when the key was already used. */
  correct: async (actor: Actor, runId: string, body: CorrectRequest): Promise<CorrectOutcome> => {
    const siteId = await requireHubActor(actor);

    const replay = async (client: typeof prisma | Tx = prisma): Promise<CorrectOutcome | null> => {
      const existing = await prepRunRepository.findByIdempotencyKey(siteId, actor.id, body.idempotencyKey, client);
      return existing ? { run: serializeRunDetail(existing, actor), replayed: true } : null;
    };
    const already = await replay();
    if (already) return already;

    const old = await prepRunRepository.findById(siteId, runId);
    if (!old) throw new NotFoundError('Prep run not found');
    assertCanFix(old, actor, new Date());
    if (old.status !== 'RECORDED') throw notOpen();

    const inputs = toInputs(body.inputs);
    const made = D(body.made);
    assertValidInputs(old.outputItemId, inputs, made);
    const location = await recordRepository.findCentralStore(siteId);
    if (!location) throw new NotFoundError('No Central Store is configured');
    const { output, byId } = await loadItems(siteId, old.outputItemId, inputs);

    try {
      const outcome = await prisma.$transaction(async (tx) => {
        // A second fixer of the same run waits here, then finds it closed.
        const locked = await prepRunRepository.lockForFix(tx, siteId, runId);
        if (!locked) throw new NotFoundError('Prep run not found');
        if (locked.status !== 'RECORDED') {
          const won = await prepRunRepository.findByIdempotencyKey(siteId, actor.id, body.idempotencyKey, tx);
          if (won) return { run: won, replayed: true };
          throw notOpen();
        }

        const now = new Date();
        // The output's cost moves only when the run being fixed is the newest RECORDED one of that output. Asked before it is closed.
        const isLatest = (await prepRunRepository.latestRecordedRunId(siteId, output.id, tx)) === locked.id;
        const closed = await prepRunRepository.closeRun(tx, siteId, locked.id, { status: 'CORRECTED', closedById: actor.id, closedAt: now });
        if (!closed) throw notOpen();
        await reverseRun(tx, siteId, locked, actor);

        // Judged as if the old run had never happened: its stock is back and it no longer counts as a past run.
        const a = await assess({ siteId, locationId: location.id, output, byId, inputs, made, now, client: tx });
        const originalCosts = new Map(locked.inputLines.map((line) => [line.inputItemId, line.unitCostAtRunTime]));
        const lines = a.lines.map((line) => {
          const unitCost = originalCosts.get(line.itemId) ?? line.unitCost;
          return { ...line, unitCost, lineCost: line.quantity.times(unitCost).toDecimalPlaces(2) };
        });
        const totalInputCost = lines.reduce((sum, line) => sum.plus(line.lineCost), D(0)).toDecimalPlaces(2);
        const outputUnitCost = totalInputCost.dividedBy(made).toDecimalPlaces(4);
        const tier = a.judgement?.tier ?? null;
        const reference = await referenceCounterRepository.nextReference(tx, siteId, 'PREP');

        const created = await prepRunRepository.createReplacement(tx, {
          siteId,
          reference,
          idempotencyKey: body.idempotencyKey,
          outputItemId: output.id,
          actualYield: made,
          outputUnitCost,
          totalInputCost,
          yieldVarianceLabel: yieldLabel(a.judgement),
          notifiedStoreManager: tier === 'NOTIFY',
          expectedYield: a.basis.amount,
          expectedSource: a.basis.source,
          recipeVersionId: a.basis.recipeVersionId,
          stockFlag: a.stockFlag,
          // Anyone who cannot review (an Attendant) sends their own correction to the manager; a manager's goes only if it is off.
          needsLook: !actorCan(actor, 'prep.review') || (tier !== null && tier !== 'ON_TARGET') || a.stockFlag,
          yieldReason: body.yieldReason ?? null,
          reasonNote: body.reasonNote ?? null,
          locationId: location.id,
          createdById: actor.id,
          replacesRunId: locked.id,
          correctionReason: body.reason,
          lines: lines.map((line) => ({ inputItemId: line.itemId, quantity: line.quantity, unitCostAtRunTime: line.unitCost, lineCost: line.lineCost, onHandAtRunTime: line.onHand })),
        });

        for (const line of lines) {
          await postStockMovement(tx, {
            type: 'PREP_CONSUME',
            locationId: location.id,
            inventoryItemId: line.itemId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            userId: actor.id,
            links: { prepRecordId: created.id },
          });
        }
        await postStockMovement(tx, {
          type: 'PREP_PRODUCE',
          locationId: location.id,
          inventoryItemId: output.id,
          quantity: made,
          unitCost: outputUnitCost,
          userId: actor.id,
          links: { prepRecordId: created.id },
        });
        if (isLatest) await prepRunRepository.setItemCurrentCost(tx, siteId, output.id, outputUnitCost);
        return { run: created, replayed: false };
      });
      return { run: serializeRunDetail(outcome.run, actor), replayed: outcome.replayed };
    } catch (error) {
      // Two taps with one key racing past the check above: the unique index decided, so return the run that won.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const won = await replay();
        if (won) return won;
      }
      return mapPrismaError(error);
    }
  },

  /** #12 Cancel a run: the same reversing rows, status CANCELLED, nothing deleted, stock may go below zero, output cost untouched. */
  cancel: async (actor: Actor, runId: string, body: CancelRequest): Promise<ReturnType<typeof serializeRunDetail>> => {
    const siteId = await requireHubActor(actor);
    const run = await prepRunRepository.findById(siteId, runId);
    if (!run) throw new NotFoundError('Prep run not found');
    assertCanFix(run, actor, new Date());
    if (run.status !== 'RECORDED') throw notOpen();

    try {
      const cancelled = await prisma.$transaction(async (tx) => {
        const locked = await prepRunRepository.lockForFix(tx, siteId, runId);
        if (!locked) throw new NotFoundError('Prep run not found');
        if (locked.status !== 'RECORDED') throw notOpen();
        const closed = await prepRunRepository.closeRun(tx, siteId, locked.id, {
          status: 'CANCELLED',
          closedById: actor.id,
          closedAt: new Date(),
          cancelReason: body.reason,
          reasonNote: body.reasonNote ?? null,
        });
        if (!closed) throw notOpen();
        await reverseRun(tx, siteId, locked, actor);
        const after = await prepRunRepository.findById(siteId, runId, tx);
        if (!after) throw new NotFoundError('Prep run not found');
        return after;
      });
      return serializeRunDetail(cancelled, actor);
    } catch (error) {
      return mapPrismaError(error);
    }
  },

  /** #13 What cancelling would do to stock, item by item, so the manager sees "this takes stock below zero" before confirming. */
  cancelPreview: async (actor: Actor, runId: string): Promise<{ items: CancelPreviewItem[] }> => {
    const siteId = await requireHubReader(actor);
    const run = await prepRunRepository.findById(siteId, runId);
    if (!run) throw new NotFoundError('Prep run not found');
    if (run.status !== 'RECORDED') throw notOpen();
    const location = await recordRepository.findCentralStore(siteId);
    if (!location) throw new NotFoundError('No Central Store is configured');

    const net = await fixRepository.netEffectByItem(siteId, run.id);
    const facts = [
      ...run.inputLines.map((line) => ({ itemId: line.inputItemId, itemName: line.inputItem.name, unit: line.inputItem.usageUnit })),
      { itemId: run.outputItemId, itemName: run.outputItem.name, unit: run.outputItem.usageUnit },
    ];
    const onHand = await recordRepository.onHandByItem(siteId, location.id, facts.map((f) => f.itemId));
    return {
      items: facts.map((fact) => {
        const now = onHand.get(fact.itemId) ?? D(0);
        // Undoing a row adds its opposite: the inputs come back, the output goes out.
        const after = now.minus(net.get(fact.itemId) ?? D(0));
        return { ...fact, onHandNow: now.toFixed(), onHandAfter: after.toFixed(), belowZero: after.isNegative() };
      }),
    };
  },
};
