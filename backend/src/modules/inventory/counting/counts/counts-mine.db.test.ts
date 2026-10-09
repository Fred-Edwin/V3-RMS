/**
 * C31 and C32 reads against the REAL database (opt-in, `RUN_DB_TESTS=1`), inside a rolled-back transaction: another person's
 * counts never appear, a count waiting for review shows whatever the range, the pager and total, an open count is not listed,
 * and today's waste entries are counted for one person only.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { countsRepository } from './counts-repository';

const enabled = process.env['RUN_DB_TESTS'] === '1';
class Rollback extends Error {}

describe.skipIf(!enabled)('My counts and the home against the real database', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('own counts only, the window, waiting always shows, the pager, and the waste count', async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { isHub: true } });
    const siteId = hub.id;
    const location = await prisma.location.findFirstOrThrow({ where: { siteId, type: 'CENTRAL_STORE' } });
    const users = await prisma.user.findMany({ where: { siteId, role: { in: ['STORE_ATTENDANT', 'STORE_MANAGER'] } }, take: 2 });
    const [me, someoneElse] = users;
    if (!me || !someoneElse) throw new Error('The test database needs two Central Store users');
    const item = await prisma.inventoryItem.create({ data: { siteId, name: `Zz mine ${Date.now()}`, type: 'STOCKED', buyUnit: 'bag', usageUnit: 'kg', currentCost: new Prisma.Decimal(100) } });
    const section = await prisma.countSection.create({ data: { siteId, name: `Zz mine ${Date.now()}`, kind: 'MANUAL', position: 999 } });

    try {
      await expect(
        prisma.$transaction(async (tx) => {
          const DAY = 86400_000;
          const stamp = Date.now();
          // A count holds an item once, so the three-line count needs three items (the first is `item`).
          const extraItems = [item];
          for (let i = 2; i <= 3; i += 1) {
            extraItems.push(await tx.inventoryItem.create({ data: { siteId, name: `Zz mine ${stamp}-${i}`, type: 'STOCKED', buyUnit: 'bag', usageUnit: 'kg', currentCost: new Prisma.Decimal(100) } }));
          }
          let n = 0;
          const mk = async (counterId: string, status: 'OPEN' | 'SUBMITTED' | 'APPROVED', daysAgo: number, lines = 1) => {
            n += 1;
            const at = new Date(stamp - daysAgo * DAY - n * 1000);
            return tx.count.create({
              data: {
                siteId,
                locationId: location.id,
                reference: `CNT-ZZM-${stamp}-${n}`,
                counterId,
                status,
                startedAt: at,
                signedAt: status === 'OPEN' ? null : at,
                scopeSections: { create: [{ sectionId: section.id, sectionName: section.name }] },
                lines: {
                  create: Array.from({ length: lines }, (_, i) => ({
                    siteId,
                    inventoryItemId: extraItems[i]?.id ?? item.id,
                    sectionId: section.id,
                    sectionName: section.name,
                    position: i,
                    // Stock figures exist in the database; the response must never carry them.
                    countedQty: new Prisma.Decimal(90),
                    expectedQty: new Prisma.Decimal(100),
                    unitCost: new Prisma.Decimal(100),
                    result: 'EXCEEDS' as const,
                    isOpen: status === 'OPEN',
                  })),
                },
              },
            });
          };

          // The open-count partial unique index allows one OPEN per person, so mine is made last.
          const recentApproved = await mk(me.id, 'APPROVED', 1, 3);
          const recentWaiting = await mk(me.id, 'SUBMITTED', 2);
          const oldWaiting = await mk(me.id, 'SUBMITTED', 100);
          const oldApproved = await mk(me.id, 'APPROVED', 100);
          const theirs = await mk(someoneElse.id, 'APPROVED', 1);
          const theirsWaiting = await mk(someoneElse.id, 'SUBMITTED', 1);

          const window = { signedFrom: new Date(stamp - 30 * DAY) };
          const mineIds = async (filter: Parameters<typeof countsRepository.mineList>[2], paging = { page: 1, pageSize: 100 }) =>
            (await countsRepository.mineList(siteId, me.id, filter, paging, tx)).rows.map((r) => r.id);

          // Own only: another person's counts never appear, waiting or approved.
          const all = await mineIds({ status: 'all', ...window });
          expect(all).not.toContain(theirs.id);
          expect(all).not.toContain(theirsWaiting.id);
          // The default window drops the old approved count and keeps the old one waiting for review.
          expect(all).toContain(recentApproved.id);
          expect(all).toContain(oldWaiting.id);
          expect(all).not.toContain(oldApproved.id);
          // Newest signed first.
          expect(all.indexOf(recentApproved.id)).toBeLessThan(all.indexOf(recentWaiting.id));
          expect(all.indexOf(recentWaiting.id)).toBeLessThan(all.indexOf(oldWaiting.id));
          // No range at all lists the old approved one too.
          expect(await mineIds({ status: 'all' })).toContain(oldApproved.id);

          // The status chips: waiting always shows, approved follows the window.
          const waiting = await mineIds({ status: 'waiting', ...window });
          expect(waiting).toEqual(expect.arrayContaining([recentWaiting.id, oldWaiting.id]));
          expect(waiting).not.toContain(recentApproved.id);
          const approved = await mineIds({ status: 'approved', ...window });
          expect(approved).toContain(recentApproved.id);
          expect(approved).not.toContain(oldWaiting.id);
          expect(approved).not.toContain(oldApproved.id);

          // The row: the item total comes from the lines, the names from the scope.
          const rows = (await countsRepository.mineList(siteId, me.id, { status: 'all', ...window }, { page: 1, pageSize: 100 }, tx)).rows;
          const row = rows.find((r) => r.id === recentApproved.id)!;
          expect(row).toMatchObject({ itemCount: 3, scopeNames: [section.name], status: 'APPROVED' });
          expect(Object.keys(row).filter((k) => ['expectedQty', 'difference', 'result', 'unitCost'].includes(k))).toEqual([]);

          // The pager and the total: one row a page, the total is the same on every page.
          const first = await countsRepository.mineList(siteId, me.id, { status: 'all', ...window }, { page: 1, pageSize: 1 }, tx);
          const second = await countsRepository.mineList(siteId, me.id, { status: 'all', ...window }, { page: 2, pageSize: 1 }, tx);
          expect(first.rows).toHaveLength(1);
          expect(second.rows).toHaveLength(1);
          expect(second.rows[0]!.id).not.toBe(first.rows[0]!.id);
          expect(first.total).toBe(all.length);
          expect(second.total).toBe(all.length);

          // An open count is not "signed": it is on the home, not in the list, and the badge leaves it out.
          const before = await countsRepository.signedCountOf(siteId, me.id, tx);
          const open = await mk(me.id, 'OPEN', 0);
          expect(await mineIds({ status: 'all' })).not.toContain(open.id);
          expect(await countsRepository.signedCountOf(siteId, me.id, tx)).toBe(before);
          expect((await countsRepository.findOpenOf(siteId, me.id, tx))?.id).toBe(open.id);
          expect(before).toBeGreaterThanOrEqual(4);

          // Today's waste entries: this person's only, inside the window only, reversed ones included.
          const batch = await tx.wasteBatch.create({ data: { siteId, userId: me.id, idempotencyKey: `zz-mine-${stamp}` } });
          const waste = (loggedById: string, at: Date, reversed = false) =>
            tx.wasteLog.create({
              data: {
                siteId,
                locationId: location.id,
                inventoryItemId: item.id,
                quantity: new Prisma.Decimal(1),
                reason: 'SPOILAGE',
                unitCost: new Prisma.Decimal(100),
                loggedById,
                createdAt: at,
                batchId: batch.id,
                ...(reversed ? { reversedAt: at, reversedById: loggedById, reversalReason: 'WRONG_ITEM' as const } : {}),
              },
            });
          const dayStart = new Date(stamp - 6 * 3600_000);
          const dayEnd = new Date(stamp + 6 * 3600_000);
          const baseline = await countsRepository.wasteEntriesLogged(siteId, me.id, dayStart, dayEnd, tx);
          await waste(me.id, new Date(stamp - 3600_000));
          await waste(me.id, new Date(stamp - 2 * 3600_000), true);
          await waste(someoneElse.id, new Date(stamp - 3600_000));
          await waste(me.id, new Date(stamp - 20 * 3600_000)); // yesterday, outside
          expect(await countsRepository.wasteEntriesLogged(siteId, me.id, dayStart, dayEnd, tx)).toBe(baseline + 2);
          throw new Rollback('roll back');
        }),
      ).rejects.toBeInstanceOf(Rollback);
    } finally {
      await prisma.countSection.delete({ where: { id: section.id } }).catch(() => undefined);
      await prisma.inventoryItem.delete({ where: { id: item.id } }).catch(() => undefined);
    }
  });
});
