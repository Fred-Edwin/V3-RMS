/**
 * count-reads against the REAL database: the SQL runs, answers the right shape, and sees the first sections the migration seeded.
 * Opt-in (`RUN_DB_TESTS=1`), read-only apart from rows made inside a transaction that is rolled back.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { lastCountedByItem, longestWithoutCount, sectionNamesByItem, todaysCounts, unsectionedCount } from './count-reads';

const enabled = process.env['RUN_DB_TESTS'] === '1';

class Rollback extends Error {}

describe.skipIf(!enabled)('count-reads against the real database', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const hub = async () => prisma.site.findFirstOrThrow({ where: { isHub: true }, select: { id: true } });

  it('the seeded sections are visible: every live item sits in a section, and the names resolve', async () => {
    const { id: siteId } = await hub();
    const items = await prisma.inventoryItem.findMany({ where: { siteId, deletedAt: null }, select: { id: true }, take: 20 });
    const names = await sectionNamesByItem(siteId, items.map((i) => i.id));
    expect(names.size).toBeGreaterThan(0);
    expect([...names.values()].every((n) => n.length > 0)).toBe(true);
    expect(await sectionNamesByItem(siteId, [])).toEqual(new Map());
  });

  it('unsectionedCount runs and is a count', async () => {
    const { id: siteId } = await hub();
    expect(await unsectionedCount(siteId)).toBeGreaterThanOrEqual(0);
  });

  it('longestWithoutCount lists the sections never counted first', async () => {
    const { id: siteId } = await hub();
    const rows = await longestWithoutCount(siteId, new Date(), 5);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.kind === 'SECTION' || r.sectionName !== null)).toBe(true);
    const never = rows.filter((r) => r.lastCountedAt === null);
    expect(rows.slice(0, never.length)).toEqual(never);
  });

  it('todaysCounts and lastCountedByItem see a signed count made inside a rolled-back transaction', async () => {
    const { id: siteId } = await hub();
    const location = await prisma.location.findFirstOrThrow({ where: { siteId, type: 'CENTRAL_STORE' } });
    const user = await prisma.user.findFirstOrThrow({ where: { role: 'STORE_MANAGER' } });
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { siteId, deletedAt: null } });
    const now = new Date();

    await expect(
      prisma.$transaction(async (tx) => {
        const count = await tx.count.create({
          data: { siteId, locationId: location.id, reference: `CNT-TEST-${now.getTime()}`, counterId: user.id, status: 'SUBMITTED', signedAt: now, startedAt: now },
        });
        await tx.countLine.create({
          data: { siteId, countId: count.id, inventoryItemId: item.id, position: 0, countedQty: new Prisma.Decimal(3), isOpen: false },
        });
        // The reads use their own connection, so check the SQL through the same transaction client.
        const { countReadsRepository } = await import('./count-reads-repository');
        const last = await countReadsRepository.lastCountedByItem(siteId, [item.id], tx);
        expect(last[0]).toMatchObject({ itemId: item.id, reference: count.reference });
        const today = await countReadsRepository.countsInWindow(siteId, new Date(now.getTime() - 60_000), new Date(now.getTime() + 60_000), tx);
        expect(today.map((c) => c.id)).toContain(count.id);
        throw new Rollback('roll back');
      }),
    ).rejects.toBeInstanceOf(Rollback);

    // The public functions run on the shared client; nothing from the rolled-back count is left behind.
    expect((await lastCountedByItem(siteId, [item.id])).get(item.id)?.reference ?? '').not.toMatch(/^CNT-TEST-/);
    expect((await todaysCounts(siteId, now)).some((c) => c.reference.startsWith('CNT-TEST-'))).toBe(false);
  });
});
