/**
 * The Counts and Print reads against the REAL database (opt-in, `RUN_DB_TESTS=1`): the raw SQL runs and answers the right shapes
 * with a signed count, a flagged line and a three-counts-running shortfall made inside a rolled-back transaction.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { buildRecordPrint } from '../_shared/count-view';
import { printService } from '../print/print-service';
import { countsRepository } from './counts-repository';

const enabled = process.env['RUN_DB_TESTS'] === '1';
class Rollback extends Error {}

describe.skipIf(!enabled)('counts reads against the real database', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('list, chips, summary facts, flagged, repeat shortfalls and last counts all run; a three-run shortfall shows up', async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { isHub: true } });
    const siteId = hub.id;
    const location = await prisma.location.findFirstOrThrow({ where: { siteId, type: 'CENTRAL_STORE' } });
    const user = await prisma.user.findFirstOrThrow({ where: { role: 'STORE_MANAGER', siteId } });
    const item = await prisma.inventoryItem.create({ data: { siteId, name: `Zz counts ${Date.now()}`, type: 'STOCKED', buyUnit: 'bag', usageUnit: 'kg', currentCost: new Prisma.Decimal(100) } });
    const section = await prisma.countSection.create({ data: { siteId, name: `Zz counts ${Date.now()}`, kind: 'MANUAL', position: 999 } });
    await prisma.countSectionItem.create({ data: { siteId, sectionId: section.id, inventoryItemId: item.id, position: 0 } });

    try {
      await expect(
        prisma.$transaction(async (tx) => {
          let first = '';
          for (let n = 1; n <= 3; n += 1) {
            const signedAt = new Date(Date.now() - (4 - n) * 3600_000);
            const count = await tx.count.create({
              data: {
                siteId,
                locationId: location.id,
                reference: `CNT-ZZ-${Date.now()}-${n}`,
                counterId: user.id,
                status: 'SUBMITTED',
                startedAt: signedAt,
                signedAt,
                scopeSections: { create: [{ sectionId: section.id, sectionName: section.name }] },
              },
            });
            if (n === 1) first = count.id;
            await tx.countLine.create({
              data: {
                siteId,
                countId: count.id,
                inventoryItemId: item.id,
                sectionId: section.id,
                sectionName: section.name,
                position: 0,
                countedQty: new Prisma.Decimal(90),
                expectedQty: new Prisma.Decimal(100),
                unitCost: new Prisma.Decimal(100),
                result: 'EXCEEDS',
                shortStreak: n,
                isOpen: false,
                directorFlagged: n === 3,
                directorAlert: n === 3,
              },
            });
          }

          const list = await countsRepository.list(siteId, { status: 'waiting', search: section.name }, { page: 1, pageSize: 25 }, tx);
          expect(list.total).toBe(3);
          expect(list.rows[0]).toMatchObject({ status: 'SUBMITTED', scopeNames: [section.name], itemsCounted: 1, itemsTotal: 1, exceeds: 1, within: 0 });
          expect((await countsRepository.list(siteId, { status: 'approved' }, { page: 1, pageSize: 25 }, tx)).rows.map((r) => r.reference).join()).not.toContain('CNT-ZZ');
          expect((await countsRepository.list(siteId, { status: 'all', search: item.name }, { page: 1, pageSize: 25 }, tx)).total).toBe(3); // search finds a count by its item

          // A count waiting for approval always shows, whatever the range; an old approved one does not (owner decision, 8 Oct 2026).
          const longAgo = new Date(Date.now() - 100 * 86400_000);
          const mk = (status: 'SUBMITTED' | 'APPROVED', tag: string) =>
            tx.count.create({ data: { siteId, locationId: location.id, reference: `CNT-ZZ-OLD-${tag}-${Date.now()}`, counterId: user.id, status, startedAt: longAgo, signedAt: longAgo } });
          const oldWaiting = await mk('SUBMITTED', 'W');
          const oldApproved = await mk('APPROVED', 'A');
          const window = { startedFrom: new Date(Date.now() - 30 * 86400_000), startedBefore: new Date(Date.now() + 86400_000) };
          const inWindow = await countsRepository.list(siteId, { status: 'all', ...window }, { page: 1, pageSize: 100 }, tx);
          expect(inWindow.rows.map((r) => r.id)).toContain(oldWaiting.id);
          expect(inWindow.rows.map((r) => r.id)).not.toContain(oldApproved.id);
          const waitingOnly = await countsRepository.list(siteId, { status: 'waiting', ...window }, { page: 1, pageSize: 100 }, tx);
          expect(waitingOnly.rows.map((r) => r.id)).toContain(oldWaiting.id);
          expect((await countsRepository.list(siteId, { status: 'approved', ...window }, { page: 1, pageSize: 100 }, tx)).rows.map((r) => r.id)).not.toContain(oldApproved.id);
          // Rows, total and chips are one rule, so they add up: the "All" chip is the total, and the chips split it.
          const windowChips = await countsRepository.chipCounts(siteId, tx, window);
          expect(windowChips.all).toBe(inWindow.total);
          expect(windowChips.waiting + windowChips.inProgress + windowChips.approved).toBe(windowChips.all);
          expect(windowChips.waiting).toBe(waitingOnly.total);
          // A search still narrows the always-shown waiting counts.
          expect((await countsRepository.list(siteId, { status: 'all', search: 'no-such-count-zz', ...window }, { page: 1, pageSize: 100 }, tx)).total).toBe(0);

          // The date range cuts on when the count started, for the rows and the chips alike.
          const future = { startedFrom: new Date(Date.now() + 86400_000) };
          expect((await countsRepository.list(siteId, { status: 'all', ...future }, { page: 1, pageSize: 25 }, tx)).rows.every((r) => r.status === 'SUBMITTED')).toBe(true);
          expect((await countsRepository.chipCounts(siteId, tx, future)).approved).toBe(0);
          expect((await countsRepository.list(siteId, { status: 'all', startedBefore: new Date(Date.now() - 86400_000 * 365 * 10) }, { page: 1, pageSize: 100 }, tx)).rows.every((r) => r.status === 'SUBMITTED')).toBe(true);

          const chips = await countsRepository.chipCounts(siteId, tx);
          expect(chips.waiting).toBeGreaterThanOrEqual(3);
          const facts = await countsRepository.summaryFacts(siteId, new Date(Date.now() - 7 * 86400_000), tx);
          expect(facts.waiting.count).toBeGreaterThanOrEqual(3);
          expect(facts.exceeded.lines).toBeGreaterThanOrEqual(3);
          expect(facts.exceeded.netKes.lessThanOrEqualTo(new Prisma.Decimal(-3000))).toBe(true);
          expect(facts.flaggedUnseen).toBeGreaterThanOrEqual(1);
          expect(facts.repeatShortfalls).toBeGreaterThanOrEqual(1);

          const flagged = await countsRepository.flagged(siteId, { page: 1, pageSize: 100 }, tx);
          const mine = flagged.rows.find((r) => r.itemName === item.name)!;
          expect(mine).toMatchObject({ alert: true, seenAt: null, unit: 'kg' });
          expect(mine.countedQty.toString()).toBe('90');

          const repeat = await countsRepository.repeatItems(siteId, { skip: 0, take: 100 }, tx);
          expect(repeat.rows.find((r) => r.itemId === item.id)).toMatchObject({ shortRuns: 3, sectionName: section.name, unit: 'kg' });
          const history = await countsRepository.lastCountsOf(siteId, [item.id], tx);
          expect(history.map((h) => h.difference.toString())).toEqual(['-10', '-10', '-10']);
          expect(history[0]!.at.getTime()).toBeGreaterThan(history[2]!.at.getTime()); // newest first

          // The printed record of a signed count runs, and a count still open has none.
          const record = await countsRepository.findById(siteId, first, tx);
          const printed = buildRecordPrint(record!, new Date());
          expect(printed).toMatchObject({ counted: 1, total: 1, differences: 1, netValueKes: '-1000.00' });
          expect(printed.rows[0]).toMatchObject({ expected: '100', counted: '90', difference: '-10', valueKes: '-1000.00', decisionText: 'Not decided' });
          throw new Rollback('roll back');
        }),
      ).rejects.toBeInstanceOf(Rollback);
    } finally {
      await prisma.countSectionItem.deleteMany({ where: { inventoryItemId: item.id } });
      await prisma.countSection.delete({ where: { id: section.id } });
      await prisma.inventoryItem.delete({ where: { id: item.id } });
    }
  });

  it('the blank sheet lists every section with items and nothing else', async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { isHub: true } });
    const user = await prisma.user.findFirstOrThrow({ where: { role: 'STORE_ATTENDANT', siteId: hub.id } });
    const sheet = await printService.blankSheet({ id: user.id, role: 'STORE_ATTENDANT', siteId: hub.id } as never);
    expect(sheet.sections.length).toBeGreaterThan(0);
    expect(sheet.sections.every((s) => s.items.length > 0)).toBe(true);
    expect(sheet.sections[0]!.detail).toMatch(/^Section 1 of \d+/);
    expect(Object.keys(sheet.sections[0]!.items[0]!).sort()).toEqual(['name', 'unit']);
  });
});
