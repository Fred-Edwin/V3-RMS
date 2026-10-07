/**
 * Reviewing a count against a REAL database (opt-in, `RUN_DB_TESTS=1`): an Attendant's count is submitted, the Manager decides,
 * approves with her PIN, and exactly the right adjustments post. Builds its own section and items and removes them (and the ledger
 * rows, with the dev bypass), puts PINs, settings and counters back.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { allowLedgerEditsInThisTransaction } from '../../../../scripts/ledger-dev-bypass';
import { hashPin } from '../../../../utils/password';
import { recordService } from '../record/record-service';
import { reviewService } from './review-service';

vi.mock('../_shared/count-notify', () => ({ countNotify: { submitted: vi.fn().mockResolvedValue(undefined), directorAlert: vi.fn().mockResolvedValue(undefined) } }));

const enabled = process.env['RUN_DB_TESTS'] === '1';
const PIN = '4821';

describe.skipIf(!enabled)('reviewService against the real database', () => {
  let siteId: string;
  let locationId: string;
  let manager: { id: string; role: 'STORE_MANAGER'; siteId: string };
  let attendant: { id: string; role: 'STORE_ATTENDANT'; siteId: string };
  let director: { id: string; role: 'DIRECTOR'; siteId: string };
  let sectionId: string;
  let itemIds: string[] = [];
  const pins = new Map<string, string | null>();
  let settings: Awaited<ReturnType<typeof prisma.countingThresholds.findUnique>> = null;
  let counters: Record<string, number | null> = {};

  beforeAll(async () => {
    siteId = (await prisma.site.findFirstOrThrow({ where: { isHub: true } })).id;
    locationId = (await prisma.location.findFirstOrThrow({ where: { siteId, type: 'CENTRAL_STORE' } })).id;
    const rows = {
      m: await prisma.user.findFirstOrThrow({ where: { role: 'STORE_MANAGER', siteId } }),
      a: await prisma.user.findFirstOrThrow({ where: { role: 'STORE_ATTENDANT', siteId } }),
      d: await prisma.user.findFirstOrThrow({ where: { role: 'DIRECTOR' } }),
    };
    manager = { id: rows.m.id, role: 'STORE_MANAGER', siteId };
    attendant = { id: rows.a.id, role: 'STORE_ATTENDANT', siteId };
    director = { id: rows.d.id, role: 'DIRECTOR', siteId };
    for (const u of [rows.m, rows.a]) {
      pins.set(u.id, u.pinHash);
      await prisma.user.update({ where: { id: u.id }, data: { pinHash: await hashPin(PIN) } });
    }
    const ref = async (prefix: string) => (await prisma.referenceCounter.findUnique({ where: { siteId_prefix: { siteId, prefix } } }))?.lastNumber ?? null;
    counters = { CNT: await ref('CNT'), ADJ: await ref('ADJ') };
    settings = await prisma.countingThresholds.findUnique({ where: { siteId } });
    const s = { reasonRequiredKes: 500, rangePercent: new Prisma.Decimal(5), flagRepeatShortfalls: true, directorAlertKes: 2800 };
    await prisma.countingThresholds.upsert({ where: { siteId }, create: { siteId, ...s }, update: s });

    const last = await prisma.countSection.aggregate({ where: { siteId }, _max: { position: true } });
    sectionId = (await prisma.countSection.create({ data: { siteId, name: `Zz review ${randomUUID().slice(0, 8)}`, kind: 'MANUAL', position: (last._max.position ?? 0) + 1 } })).id;
    const make = async (name: string, position: number, cost: number, onHand: number) => {
      const item = await prisma.inventoryItem.create({ data: { siteId, name: `Zz ${name} ${randomUUID().slice(0, 6)}`, type: 'STOCKED', buyUnit: 'bag', usageUnit: 'kg', currentCost: new Prisma.Decimal(cost) } });
      await prisma.countSectionItem.create({ data: { siteId, sectionId, inventoryItemId: item.id, position } });
      await prisma.inventoryTransaction.create({ data: { siteId, locationId, inventoryItemId: item.id, type: 'RECEIVE', quantity: new Prisma.Decimal(onHand), unitCost: new Prisma.Decimal(cost), reason: 'test stock', userId: manager.id } });
      return item.id;
    };
    itemIds = [await make('Sugar', 0, 183, 180), await make('Rice', 1, 100, 100), await make('Oil', 2, 100, 40), await make('Tea', 3, 100, 7)];
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await allowLedgerEditsInThisTransaction(tx);
      const lines = await tx.countLine.findMany({ where: { inventoryItemId: { in: itemIds } }, select: { id: true, countId: true } });
      await tx.inventoryTransaction.deleteMany({ where: { OR: [{ countLineId: { in: lines.map((l) => l.id) } }, { inventoryItemId: { in: itemIds } }] } });
      await tx.count.deleteMany({ where: { id: { in: [...new Set(lines.map((l) => l.countId))] } } });
      await tx.countSectionItem.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await tx.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
      await tx.countSection.deleteMany({ where: { id: sectionId } });
      for (const [id, pinHash] of pins) await tx.user.update({ where: { id }, data: { pinHash } });
      if (settings) {
        const { id: _i, siteId: _s, createdAt: _c, ...data } = settings;
        await tx.countingThresholds.update({ where: { siteId }, data });
      } else await tx.countingThresholds.deleteMany({ where: { siteId } });
      for (const [prefix, last] of Object.entries(counters)) {
        if (last === null) await tx.referenceCounter.deleteMany({ where: { siteId, prefix } });
        else await tx.referenceCounter.update({ where: { siteId_prefix: { siteId, prefix } }, data: { lastNumber: last } });
      }
    });
    await prisma.$disconnect();
  });

  it('submit, decide, approve: one ADJUSTMENT per posting line with count_line_id, gap-free ADJ numbers, nothing for the rest, wrong PIN writes nothing', async () => {
    // The Attendant counts Sugar 164 of 180 (outside, KES 2,928), Rice 99 of 100 (within), Oil 40 of 40 (matches), Tea skipped.
    const { detail } = await recordService.start(attendant as never, { sectionIds: [sectionId], idempotencyKey: randomUUID() });
    const id = detail.id;
    const line = (n: number) => prisma.countLine.findFirstOrThrow({ where: { countId: id, inventoryItemId: itemIds[n]! } });
    const [sugar, rice, oil, tea] = await Promise.all([0, 1, 2, 3].map(line));
    await recordService.saveLines(attendant as never, id, {
      lines: [
        { lineId: sugar!.id, countedQty: '164', skipped: false },
        { lineId: rice!.id, countedQty: '99', skipped: false },
        { lineId: oil!.id, countedQty: '40', skipped: false },
        { lineId: tea!.id, countedQty: null, skipped: true },
      ],
    });
    await recordService.sign(attendant as never, id, { pin: PIN, idempotencyKey: randomUUID() });

    // The Manager sees the figures; the outside-range line carries the story and is waiting for a decision.
    const asManager = await reviewService.approvePreview(manager as never, id);
    expect(asManager).toMatchObject({ adjustments: 0, notCountedNote: expect.stringContaining('was not counted') });
    const undecided = await reviewService.approve(manager as never, id, { pin: PIN, idempotencyKey: randomUUID() }).catch((e) => e);
    expect(undecided).toMatchObject({ statusCode: 422, code: 'LINES_UNDECIDED' });

    await reviewService.decide(manager as never, id, { group: 'WITHIN_RANGE', decision: { kind: 'ACCEPTED' } });
    await reviewService.decide(manager as never, id, { lineIds: [sugar!.id], decision: { kind: 'WRITE_OFF', cause: 'PREP_NOT_LOGGED' } });
    const preview = await reviewService.approvePreview(manager as never, id);
    expect(preview).toMatchObject({ adjustments: 2, netKes: '-3028.00', withinRange: { count: 1, netKes: '-100.00' } });
    expect(preview.directorNote).toMatch(/^Director is alerted/);

    const countRows = () => prisma.inventoryTransaction.count({ where: { countLineId: { in: [sugar!.id, rice!.id, oil!.id, tea!.id] } } });
    await expect(reviewService.approve(manager as never, id, { pin: '0000', idempotencyKey: randomUUID() })).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_PIN' });
    expect(await countRows()).toBe(0);
    expect((await prisma.count.findUniqueOrThrow({ where: { id } })).status).toBe('SUBMITTED');

    const key = randomUUID();
    const done = await reviewService.approve(manager as never, id, { pin: PIN, idempotencyKey: key });
    expect(done.replayed).toBe(false);
    expect(done.detail).toMatchObject({ status: 'APPROVED', statusText: 'Approved', selfSigned: false, approver: { id: manager.id } });

    const posted = await prisma.inventoryTransaction.findMany({ where: { countLineId: { not: null }, inventoryItemId: { in: itemIds } }, orderBy: { reference: 'asc' } });
    expect(posted.map((t) => [t.type, t.inventoryItemId, t.quantity.toString(), t.userId, t.siteId, t.countLineId])).toEqual(
      expect.arrayContaining([
        ['ADJUSTMENT', itemIds[0], '-16', manager.id, siteId, sugar!.id],
        ['ADJUSTMENT', itemIds[1], '-1', manager.id, siteId, rice!.id],
      ]),
    );
    expect(posted).toHaveLength(2);
    const nums = posted.map((t) => Number(t.reference!.replace('ADJ-', ''))).sort((a, b) => a - b);
    expect(nums[1]).toBe(nums[0]! + 1);

    // The alert amount (KES 2,800) was reached by Sugar: it is flagged to the Director, who can read and mark it seen once.
    expect((await prisma.countLine.findUniqueOrThrow({ where: { id: sugar!.id } })).directorFlagged).toBe(true);
    expect((await prisma.countLine.findUniqueOrThrow({ where: { id: rice!.id } })).directorFlagged).toBe(false);
    expect(await reviewService.markSeen(director as never, { lineIds: [sugar!.id, rice!.id] })).toEqual({ seen: 1 });
    expect(await reviewService.markSeen(director as never, { lineIds: [sugar!.id] })).toEqual({ seen: 0 });
    expect(await prisma.countLine.findUniqueOrThrow({ where: { id: sugar!.id } })).toMatchObject({ directorSeenById: director.id });

    expect(await reviewService.approve(manager as never, id, { pin: PIN, idempotencyKey: key })).toMatchObject({ replayed: true });
    expect(await countRows()).toBe(2);
    await expect(reviewService.decide(manager as never, id, { lineIds: [sugar!.id], decision: { kind: 'CLEAR' } })).rejects.toMatchObject({ code: 'COUNT_NOT_SUBMITTED' });
  });
});
