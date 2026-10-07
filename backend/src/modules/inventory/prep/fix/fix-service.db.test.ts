/**
 * Fix a slip against a REAL database (no mocks). Opt-in, like the record and ledger-door db tests:
 *   cd backend && RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/prep/fix/fix-service.db.test.ts
 * Recording and fixing commit (the services open their own transactions), so each test cleans up after itself: ledger rows are
 * removed with the dev-only bypass, the runs, the counter and the output item's cost are put back as found.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { allowLedgerEditsInThisTransaction } from '../../../../scripts/ledger-dev-bypass';
import { stockRepository } from '../../stock/stock-repository';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { recordService } from '../record/record-service';
import { fixService } from './fix-service';

const enabled = process.env['RUN_DB_TESTS'] === '1';

describe.skipIf(!enabled)('fixService against the real database', () => {
  let actor: { id: string; role: 'STORE_MANAGER'; siteId: string };
  let locationId: string;
  let output: { id: string; currentCost: Prisma.Decimal };
  let inputs: { id: string; currentCost: Prisma.Decimal }[];
  let counterBefore: number | null;
  const createdRunIds: string[] = [];

  beforeAll(async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { role: 'STORE_MANAGER' } });
    actor = { id: user.id, role: 'STORE_MANAGER', siteId: user.siteId as string };
    const location = await prisma.location.findFirstOrThrow({ where: { siteId: actor.siteId, type: 'CENTRAL_STORE' } });
    locationId = location.id;
    output = await prisma.inventoryItem.findFirstOrThrow({ where: { siteId: actor.siteId, type: 'PREPPED', deletedAt: null }, select: { id: true, currentCost: true } });
    inputs = await prisma.inventoryItem.findMany({ where: { siteId: actor.siteId, type: 'RAW_INGREDIENT', deletedAt: null }, take: 2, select: { id: true, currentCost: true } });
    const counter = await prisma.referenceCounter.findUnique({ where: { siteId_prefix: { siteId: actor.siteId, prefix: 'PREP' } } });
    counterBefore = counter?.lastNumber ?? null;
  });

  afterEach(async () => {
    // Runs made by a correction are not known to the test: find them through the runs we do know.
    const replacements = await prisma.prepRun.findMany({ where: { replacesRunId: { in: createdRunIds } }, select: { id: true } });
    const ids = [...createdRunIds, ...replacements.map((r) => r.id)];
    await prisma.$transaction(async (tx) => {
      await allowLedgerEditsInThisTransaction(tx);
      await tx.inventoryTransaction.deleteMany({ where: { prepRecordId: { in: ids } } });
      await tx.prepRun.deleteMany({ where: { id: { in: ids } } });
      await tx.inventoryItem.update({ where: { id: output.id }, data: { currentCost: output.currentCost } });
      for (const input of inputs) await tx.inventoryItem.update({ where: { id: input.id }, data: { currentCost: input.currentCost } });
      if (counterBefore === null) await tx.referenceCounter.deleteMany({ where: { siteId: actor.siteId, prefix: 'PREP' } });
      else await tx.referenceCounter.update({ where: { siteId_prefix: { siteId: actor.siteId, prefix: 'PREP' } }, data: { lastNumber: counterBefore } });
    });
    createdRunIds.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const lines = (a = '2', b = '3') => [{ itemId: inputs[0]!.id, quantity: a }, { itemId: inputs[1]!.id, quantity: b }];
  const onHand = () => Promise.all([...inputs, output].map((i) => stockRepository.onHandForItem(actor.siteId, locationId, i.id)));
  const recordOne = async () => {
    const { run } = await recordService.record(actor as never, { idempotencyKey: randomUUID(), outputItemId: output.id, inputs: lines(), made: '10' });
    createdRunIds.push(run.id);
    return run;
  };
  const correctBody = (made = '12', key = randomUUID()) => ({ idempotencyKey: key, inputs: lines('2', '4'), made, reason: 'WRONG_QUANTITY' as const });

  it('correct then cancel nets every item exactly back to where it started', async () => {
    const before = await onHand();
    const original = await recordOne();
    const { run: corrected } = await fixService.correct(actor as never, original.id, correctBody());
    expect(corrected.replaces?.id).toBe(original.id);
    const cancelled = await fixService.cancel(actor as never, corrected.id, { reason: 'ENTERED_TWICE' });
    expect(cancelled.status).toBe('CANCELLED');
    const after = await onHand();
    after.forEach((value, i) => expect(value.toString()).toBe(before[i]!.toString()));
  });

  it('writes one reversing row per original: same type, opposite sign, linked, on the right site', async () => {
    const original = await recordOne();
    const originalRows = await prisma.inventoryTransaction.findMany({ where: { prepRecordId: original.id } });
    await fixService.correct(actor as never, original.id, correctBody());

    const rows = await prisma.inventoryTransaction.findMany({ where: { prepRecordId: original.id } });
    const reversals = rows.filter((r) => r.reversesTransactionId !== null);
    expect(reversals).toHaveLength(originalRows.length);
    for (const row of originalRows) {
      const reversal = reversals.find((r) => r.reversesTransactionId === row.id)!;
      expect(reversal.type).toBe(row.type);
      expect(reversal.quantity.plus(row.quantity).isZero()).toBe(true);
    }
    expect(rows.every((r) => r.siteId === actor.siteId)).toBe(true);
    const old = await prisma.prepRun.findUniqueOrThrow({ where: { id: original.id } });
    expect(old.status).toBe('CORRECTED');
    expect(old.closedById).toBe(actor.id);
  });

  it('two concurrent corrects of one run leave exactly one new run', async () => {
    const original = await recordOne();
    const results = await Promise.allSettled([
      fixService.correct(actor as never, original.id, correctBody('12')),
      fixService.correct(actor as never, original.id, correctBody('13')),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(lost.reason).toMatchObject({ statusCode: 409, code: 'RUN_NOT_OPEN' });
    expect(await prisma.prepRun.count({ where: { replacesRunId: original.id } })).toBe(1);
    // The old run was reversed once, not twice.
    expect(await prisma.inventoryTransaction.count({ where: { prepRecordId: original.id, reversesTransactionId: { not: null } } })).toBe(3);
  });

  it('a replayed key makes one new run and returns it the second time', async () => {
    const original = await recordOne();
    const body = correctBody('12', randomUUID());
    const first = await fixService.correct(actor as never, original.id, body);
    const second = await fixService.correct(actor as never, original.id, body);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.run.id).toBe(first.run.id);
    expect(await prisma.prepRun.count({ where: { replacesRunId: original.id } })).toBe(1);
  });

  it('refuses a second reversal: a repeat cancel is RUN_NOT_OPEN and the door will not reverse a row twice', async () => {
    const original = await recordOne();
    await fixService.cancel(actor as never, original.id, { reason: 'NEVER_MADE' });
    await expect(fixService.cancel(actor as never, original.id, { reason: 'NEVER_MADE' })).rejects.toMatchObject({ code: 'RUN_NOT_OPEN' });

    const first = await prisma.inventoryTransaction.findFirstOrThrow({ where: { prepRecordId: original.id, reversesTransactionId: null } });
    await expect(
      prisma.$transaction((tx) =>
        postStockMovement(tx, {
          type: first.type,
          locationId: first.locationId,
          inventoryItemId: first.inventoryItemId,
          quantity: first.quantity.abs(),
          unitCost: first.unitCost,
          userId: actor.id,
          links: { prepRecordId: original.id },
          reversesTransactionId: first.id,
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("moves the output's cost on a correction of the latest run, and a cancel leaves it where it was", async () => {
    // Known costs, so the unit cost can differ between the two runs (afterEach puts the real ones back).
    await prisma.inventoryItem.update({ where: { id: inputs[0]!.id }, data: { currentCost: 100 } });
    await prisma.inventoryItem.update({ where: { id: inputs[1]!.id }, data: { currentCost: 50 } });
    const original = await recordOne();
    const afterRecord = (await prisma.inventoryItem.findUniqueOrThrow({ where: { id: output.id } })).currentCost;
    const { run: corrected } = await fixService.correct(actor as never, original.id, correctBody('20'));
    const afterCorrect = (await prisma.inventoryItem.findUniqueOrThrow({ where: { id: output.id } })).currentCost;
    expect(afterCorrect.toString()).toBe(corrected.outputUnitCost);
    expect(afterCorrect.equals(afterRecord)).toBe(false);

    await fixService.cancel(actor as never, corrected.id, { reason: 'ENTERED_TWICE' });
    const afterCancel = (await prisma.inventoryItem.findUniqueOrThrow({ where: { id: output.id } })).currentCost;
    expect(afterCancel.toString()).toBe(afterCorrect.toString());
  });

  it('previews the effect of a cancel without writing', async () => {
    const original = await recordOne();
    const rowsBefore = await prisma.inventoryTransaction.count({ where: { prepRecordId: original.id } });
    const { items } = await fixService.cancelPreview(actor as never, original.id);
    expect(items.map((i) => i.itemId)).toEqual([inputs[0]!.id, inputs[1]!.id, output.id]);
    const out = items.find((i) => i.itemId === output.id)!;
    expect(new Prisma.Decimal(out.onHandNow).minus(out.onHandAfter).toString()).toBe('10');
    expect(await prisma.inventoryTransaction.count({ where: { prepRecordId: original.id } })).toBe(rowsBefore);
  });
});
