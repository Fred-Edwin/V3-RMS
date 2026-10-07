/**
 * The door against a REAL database (no mocks): posts a movement, reads on-hand back, and proves it
 * rolls back with the caller's transaction. Existing Inventory tests mock Prisma, and a mocked test
 * once hid a raw-SQL bug, so this one does not.
 *
 * Opt-in, because CI has no database. Run it in a lane (which has a seeded database):
 *   cd <lane>/backend && RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/stock/ledger/ledger-door.db.test.ts
 * Every write happens inside a transaction that is rolled back at the end, so the database is left as found.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { ConflictError, ValidationError } from '../../../../utils/errors';
import { stockRepository } from '../stock-repository';
import { postStockMovement } from './ledger-door';
import { allowLedgerEditsInThisTransaction } from '../../../../scripts/ledger-dev-bypass';

const enabled = process.env['RUN_DB_TESTS'] === '1';

/** Thrown on purpose to roll the transaction back after the assertions. */
class Rollback extends Error {}

const inRolledBackTx = async (work: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> => {
  await expect(
    prisma.$transaction(async (tx) => {
      await work(tx);
      throw new Rollback('roll back');
    }),
  ).rejects.toBeInstanceOf(Rollback);
};

describe.skipIf(!enabled)('postStockMovement against the real database', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const fixtures = async () => {
    const location = await prisma.location.findFirstOrThrow({ where: { type: 'CENTRAL_STORE' } });
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { deletedAt: null } });
    const user = await prisma.user.findFirstOrThrow({ where: { role: 'STORE_MANAGER' } });
    return { location, item, user };
  };

  const newWasteLog = (tx: Prisma.TransactionClient, f: Awaited<ReturnType<typeof fixtures>>) =>
    tx.wasteLog.create({
      data: {
        siteId: f.location.siteId,
        locationId: f.location.id,
        inventoryItemId: f.item.id,
        quantity: new Prisma.Decimal(3),
        reason: 'SPOILAGE',
        unitCost: new Prisma.Decimal(90),
        loggedById: f.user.id,
      },
    });

  it('posts a WASTE movement, on-hand drops by exactly that amount, and the row is shaped as the old writer shaped it', async () => {
    const f = await fixtures();
    await inRolledBackTx(async (tx) => {
      const before = await stockRepository.onHandForItem(f.location.siteId, f.location.id, f.item.id, tx);
      const log = await newWasteLog(tx, f);

      const row = await postStockMovement(tx, {
        type: 'WASTE',
        locationId: f.location.id,
        inventoryItemId: f.item.id,
        quantity: new Prisma.Decimal(3),
        unitCost: new Prisma.Decimal(90),
        reason: 'SPOILAGE',
        userId: f.user.id,
        links: { wasteLogId: log.id },
      });

      const after = await stockRepository.onHandForItem(f.location.siteId, f.location.id, f.item.id, tx);
      expect(after.toString()).toBe(before.minus(3).toString());

      // Same fields the pre-door waste writer set: site = location's site, negative quantity, cost, reason, link, user.
      expect(row).toMatchObject({
        siteId: f.location.siteId,
        locationId: f.location.id,
        inventoryItemId: f.item.id,
        type: 'WASTE',
        reason: 'SPOILAGE',
        wasteLogId: log.id,
        userId: f.user.id,
        reference: null,
        reversesTransactionId: null,
      });
      expect(row.quantity.toString()).toBe('-3');
      expect(row.unitCost.toString()).toBe('90');
    });
  });

  it('rolls back with the caller: after the transaction aborts there is no ledger row', async () => {
    const f = await fixtures();
    let wasteLogId = '';
    const rowsBefore = await prisma.inventoryTransaction.count();
    await inRolledBackTx(async (tx) => {
      const log = await newWasteLog(tx, f);
      wasteLogId = log.id;
      await postStockMovement(tx, {
        type: 'WASTE',
        locationId: f.location.id,
        inventoryItemId: f.item.id,
        quantity: new Prisma.Decimal(1),
        unitCost: new Prisma.Decimal(90),
        userId: f.user.id,
        links: { wasteLogId: log.id },
      });
    });
    expect(await prisma.inventoryTransaction.count({ where: { wasteLogId } })).toBe(0);
    expect(await prisma.inventoryTransaction.count()).toBe(rowsBefore);
  });

  it('rejects a link to a document that does not exist (nothing is written)', async () => {
    const f = await fixtures();
    await expect(
      prisma.$transaction((tx) =>
        postStockMovement(tx, {
          type: 'WASTE',
          locationId: f.location.id,
          inventoryItemId: f.item.id,
          quantity: new Prisma.Decimal(1),
          unitCost: new Prisma.Decimal(90),
          userId: f.user.id,
          links: { wasteLogId: '00000000-0000-4000-8000-000000000000' },
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a link to a document that belongs to another site', async () => {
    const f = await fixtures();
    const branch = await prisma.location.findFirst({ where: { type: 'BRANCH_DEPARTMENT' } });
    if (!branch) return; // the lane database has no branch department to cross over to
    await inRolledBackTx(async (tx) => {
      const log = await newWasteLog(tx, f); // a hub waste log...
      await expect(
        postStockMovement(tx, {
          type: 'WASTE',
          locationId: branch.id, // ...posted at a branch department
          inventoryItemId: f.item.id,
          quantity: new Prisma.Decimal(1),
          unitCost: new Prisma.Decimal(90),
          userId: f.user.id,
          links: { wasteLogId: log.id },
        }),
      ).rejects.toThrow(/another site/);
    });
  });

  it('reverses a prep run: consume and produce rows net to zero per item, and a second reversal is refused', async () => {
    const f = await fixtures();
    const [input, output] = await prisma.inventoryItem.findMany({ where: { deletedAt: null }, take: 2, orderBy: { id: 'asc' } });
    if (!input || !output) return; // needs two live items
    await inRolledBackTx(async (tx) => {
      const run = await tx.prepRun.create({
        data: {
          siteId: f.location.siteId,
          outputItemId: output.id,
          actualYield: new Prisma.Decimal(38),
          outputUnitCost: new Prisma.Decimal(10),
          totalInputCost: new Prisma.Decimal(380),
          locationId: f.location.id,
          createdById: f.user.id,
        },
      });
      const post = (type: 'PREP_CONSUME' | 'PREP_PRODUCE', itemId: string, quantity: number, reverses?: string) =>
        postStockMovement(tx, {
          type,
          locationId: f.location.id,
          inventoryItemId: itemId,
          quantity: new Prisma.Decimal(quantity),
          unitCost: new Prisma.Decimal(10),
          userId: f.user.id,
          links: { prepRecordId: run.id },
          ...(reverses ? { reversesTransactionId: reverses } : {}),
        });
      const onHand = (itemId: string) => stockRepository.onHandForItem(f.location.siteId, f.location.id, itemId, tx);

      const inBefore = await onHand(input.id);
      const outBefore = await onHand(output.id);
      const consume = await post('PREP_CONSUME', input.id, 10);
      const produce = await post('PREP_PRODUCE', output.id, 38);
      expect((await onHand(input.id)).toString()).toBe(inBefore.minus(10).toString());
      expect((await onHand(output.id)).toString()).toBe(outBefore.plus(38).toString());

      const undoConsume = await post('PREP_CONSUME', input.id, 10, consume.id);
      const undoProduce = await post('PREP_PRODUCE', output.id, 38, produce.id);
      expect(undoConsume.quantity.toString()).toBe('10');
      expect(undoProduce.quantity.toString()).toBe('-38');
      expect(undoConsume.reversesTransactionId).toBe(consume.id);
      expect((await onHand(input.id)).toString()).toBe(inBefore.toString());
      expect((await onHand(output.id)).toString()).toBe(outBefore.toString());

      await expect(post('PREP_CONSUME', input.id, 10, consume.id)).rejects.toBeInstanceOf(ConflictError);
      await expect(post('PREP_CONSUME', input.id, 10, undoConsume.id)).rejects.toThrow(/cannot be reversed/);
    });
  });

  /** An OPEN count with one line on the hub, inside `tx` (the Counting rebuild, migration 20261008100000). */
  const newCountLine = async (tx: Prisma.TransactionClient, f: Awaited<ReturnType<typeof fixtures>>) => {
    const count = await tx.count.create({
      data: {
        siteId: f.location.siteId,
        locationId: f.location.id,
        reference: `CNT-TEST-${Date.now()}`,
        counterId: f.user.id,
      },
    });
    return tx.countLine.create({
      data: { siteId: f.location.siteId, countId: count.id, inventoryItemId: f.item.id, position: 0 },
    });
  };

  it('posts a count-line adjustment: signed quantity, ADJ number, countLineId set, on the count’s site', async () => {
    const f = await fixtures();
    await inRolledBackTx(async (tx) => {
      const line = await newCountLine(tx, f);
      const before = await stockRepository.onHandForItem(f.location.siteId, f.location.id, f.item.id, tx);
      const row = await postStockMovement(tx, {
        type: 'ADJUSTMENT',
        locationId: f.location.id,
        inventoryItemId: f.item.id,
        quantity: new Prisma.Decimal('-2.5'),
        unitCost: new Prisma.Decimal(90),
        reason: 'Prep use not logged',
        userId: f.user.id,
        links: { countLineId: line.id },
      });
      expect(row.countLineId).toBe(line.id);
      expect(row.siteId).toBe(f.location.siteId);
      expect(row.quantity.toString()).toBe('-2.5');
      expect(row.reference).toMatch(/^ADJ-\d{4}$/);
      const after = await stockRepository.onHandForItem(f.location.siteId, f.location.id, f.item.id, tx);
      expect(after.toString()).toBe(before.minus('2.5').toString());
    });
  });

  it('refuses a count line from another site (findLinkOwnerSites reads countLineId)', async () => {
    const f = await fixtures();
    const branch = await prisma.location.findFirst({ where: { type: 'BRANCH_DEPARTMENT' } });
    if (!branch) return;
    await inRolledBackTx(async (tx) => {
      const line = await newCountLine(tx, f);
      await expect(
        postStockMovement(tx, {
          type: 'ADJUSTMENT',
          locationId: branch.id,
          inventoryItemId: f.item.id,
          quantity: new Prisma.Decimal(1),
          unitCost: new Prisma.Decimal(90),
          userId: f.user.id,
          links: { countLineId: line.id },
        }),
      ).rejects.toThrow(/another site/);
    });
  });

  it('reverses a waste row: the stock nets back exactly and a second reversal is refused', async () => {
    const f = await fixtures();
    await inRolledBackTx(async (tx) => {
      const log = await newWasteLog(tx, f);
      const post = (reverses?: string) =>
        postStockMovement(tx, {
          type: 'WASTE',
          locationId: f.location.id,
          inventoryItemId: f.item.id,
          quantity: new Prisma.Decimal(3),
          unitCost: new Prisma.Decimal(90),
          userId: f.user.id,
          links: { wasteLogId: log.id },
          ...(reverses ? { reversesTransactionId: reverses } : {}),
        });
      const onHand = () => stockRepository.onHandForItem(f.location.siteId, f.location.id, f.item.id, tx);
      const start = await onHand();
      const original = await post();
      expect((await onHand()).toString()).toBe(start.minus(3).toString());
      const undo = await post(original.id);
      expect(undo.type).toBe('WASTE');
      expect(undo.quantity.toString()).toBe('3');
      expect(undo.reversesTransactionId).toBe(original.id);
      expect((await onHand()).toString()).toBe(start.toString());
      await expect(post(original.id)).rejects.toBeInstanceOf(ConflictError);
      await expect(post(undo.id)).rejects.toThrow(/cannot be reversed/);
    });
  });

  // The database trigger from migration 20261004120000_ledger_append_only_trigger.
  describe('append-only trigger', () => {
    it('refuses to delete a count line a ledger row points at (the FK would null the link)', async () => {
      const f = await fixtures();
      await expect(
        prisma.$transaction(async (tx) => {
          const line = await newCountLine(tx, f);
          await postStockMovement(tx, {
            type: 'ADJUSTMENT',
            locationId: f.location.id,
            inventoryItemId: f.item.id,
            quantity: new Prisma.Decimal(1),
            unitCost: new Prisma.Decimal(90),
            userId: f.user.id,
            links: { countLineId: line.id },
          });
          await tx.countLine.delete({ where: { id: line.id } });
        }),
      ).rejects.toThrow(/append-only/);
    });

    /** Posts one WASTE row inside `tx` and hands back what the forbidden operations need. */
    const postOne = async (tx: Prisma.TransactionClient) => {
      const f = await fixtures();
      const log = await newWasteLog(tx, f);
      const row = await postStockMovement(tx, {
        type: 'WASTE',
        locationId: f.location.id,
        inventoryItemId: f.item.id,
        quantity: new Prisma.Decimal(1),
        unitCost: new Prisma.Decimal(90),
        userId: f.user.id,
        links: { wasteLogId: log.id },
      });
      return { row, log };
    };

    it('refuses to UPDATE a ledger row', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          const { row } = await postOne(tx);
          await tx.inventoryTransaction.update({ where: { id: row.id }, data: { quantity: new Prisma.Decimal(-999) } });
        }),
      ).rejects.toThrow(/append-only/);
    });

    it('refuses to DELETE a ledger row', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          const { row } = await postOne(tx);
          await tx.inventoryTransaction.delete({ where: { id: row.id } });
        }),
      ).rejects.toThrow(/append-only/);
    });

    it('refuses to delete a source document a ledger row points at (the FK would null the link)', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          const { log } = await postOne(tx);
          await tx.wasteLog.delete({ where: { id: log.id } });
        }),
      ).rejects.toThrow(/append-only/);
    });

    it('lets a seed script lift the lock for its own transaction only', async () => {
      await inRolledBackTx(async (tx) => {
        const { row } = await postOne(tx);
        await allowLedgerEditsInThisTransaction(tx);
        await tx.inventoryTransaction.update({ where: { id: row.id }, data: { reason: 'edited by a seed script' } });
        await tx.inventoryTransaction.delete({ where: { id: row.id } });
        expect(await tx.inventoryTransaction.count({ where: { id: row.id } })).toBe(0);
      });
      // The lock is back on the next transaction.
      await expect(
        prisma.$transaction(async (tx) => {
          const { row } = await postOne(tx);
          await tx.inventoryTransaction.delete({ where: { id: row.id } });
        }),
      ).rejects.toThrow(/append-only/);
    });
  });
});
