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
import { ValidationError } from '../../../../utils/errors';
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

  // The database trigger from migration 20261004120000_ledger_append_only_trigger.
  describe('append-only trigger', () => {
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
