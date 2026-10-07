/**
 * Record a run against a REAL database (no mocks). Opt-in, like the ledger door's db test:
 *   cd backend && RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/prep/record/record-service.db.test.ts
 * Recording commits (the service opens its own transaction), so each test cleans up after itself: ledger rows are removed with the
 * dev-only bypass, the runs, the counter and the output item's cost are put back as found.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { allowLedgerEditsInThisTransaction } from '../../../../scripts/ledger-dev-bypass';
import { stockRepository } from '../../stock/_shared/stock-repository';
import { recordService } from './record-service';

const enabled = process.env['RUN_DB_TESTS'] === '1';

describe.skipIf(!enabled)('recordService against the real database', () => {
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
    await prisma.$transaction(async (tx) => {
      await allowLedgerEditsInThisTransaction(tx);
      await tx.inventoryTransaction.deleteMany({ where: { prepRecordId: { in: createdRunIds } } });
      await tx.prepRun.deleteMany({ where: { id: { in: createdRunIds } } });
      await tx.inventoryItem.update({ where: { id: output.id }, data: { currentCost: output.currentCost } });
      if (counterBefore === null) await tx.referenceCounter.deleteMany({ where: { siteId: actor.siteId, prefix: 'PREP' } });
      else await tx.referenceCounter.update({ where: { siteId_prefix: { siteId: actor.siteId, prefix: 'PREP' } }, data: { lastNumber: counterBefore } });
    });
    createdRunIds.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const body = (key: string, made = '10') => ({
    idempotencyKey: key,
    outputItemId: output.id,
    inputs: [{ itemId: inputs[0]!.id, quantity: '2' }, { itemId: inputs[1]!.id, quantity: '3' }],
    made,
  });

  it('writes N+1 ledger rows with the right signs and the sums match', async () => {
    const before = await Promise.all([...inputs, output].map((i) => stockRepository.onHandForItem(actor.siteId, locationId, i.id)));
    const { run, replayed } = await recordService.record(actor as never, body(randomUUID()));
    createdRunIds.push(run.id);
    expect(replayed).toBe(false);

    const rows = await prisma.inventoryTransaction.findMany({ where: { prepRecordId: run.id } });
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.type === 'PREP_CONSUME').every((r) => r.quantity.isNegative())).toBe(true);
    expect(rows.find((r) => r.type === 'PREP_PRODUCE')?.quantity.toString()).toBe('10');
    expect(rows.every((r) => r.siteId === actor.siteId)).toBe(true);

    const after = await Promise.all([...inputs, output].map((i) => stockRepository.onHandForItem(actor.siteId, locationId, i.id)));
    expect(before[0]!.minus(after[0]!).toString()).toBe('2');
    expect(before[1]!.minus(after[1]!).toString()).toBe('3');
    expect(after[2]!.minus(before[2]!).toString()).toBe('10');

    const stored = await prisma.prepRun.findUniqueOrThrow({ where: { id: run.id }, include: { inputLines: true } });
    expect(stored.inputLines.every((l) => l.onHandAtRunTime !== null)).toBe(true);
    expect(stored.siteId).toBe(actor.siteId);
  });

  it('a replayed key records one run', async () => {
    const key = randomUUID();
    const first = await recordService.record(actor as never, body(key));
    createdRunIds.push(first.run.id);
    const again = await recordService.record(actor as never, body(key));
    expect(again.replayed).toBe(true);
    expect(again.run.id).toBe(first.run.id);
    expect(await prisma.prepRun.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it('two taps at once record one run', async () => {
    const key = randomUUID();
    const [a, b] = await Promise.all([recordService.record(actor as never, body(key)), recordService.record(actor as never, body(key))]);
    createdRunIds.push(a.run.id);
    expect(a.run.id).toBe(b.run.id);
    expect(await prisma.prepRun.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it('numbers runs gap-free per site', async () => {
    const one = await recordService.record(actor as never, body(randomUUID()));
    const two = await recordService.record(actor as never, body(randomUUID(), '11'));
    createdRunIds.push(one.run.id, two.run.id);
    const n = (ref: string) => Number(ref.replace('PREP-', ''));
    expect(n(two.run.reference) - n(one.run.reference)).toBe(1);
  });
});
