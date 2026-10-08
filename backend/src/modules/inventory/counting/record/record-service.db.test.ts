/**
 * Taking a count against a REAL database (no mocks of the data layer). Opt-in:
 *   cd backend && RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/counting/record/record-service.db.test.ts
 * The service opens its own transactions and commits, so the test builds its own section, items and stock, and removes everything it
 * made afterwards (ledger rows with the dev-only bypass, then the counts, the sections, the items), and puts the PINs and the two
 * reference counters back as found. Pushes are spied on: nothing is sent.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { allowLedgerEditsInThisTransaction } from '../../../../scripts/ledger-dev-bypass';
import { hashPin } from '../../../../utils/password';
import { COUNT_STOCK_FIGURE_KEYS } from '../_shared/counting-contract';
import { recordService } from './record-service';

vi.mock('../_shared/count-notify', () => ({ countNotify: { submitted: vi.fn().mockResolvedValue(undefined), directorAlert: vi.fn().mockResolvedValue(undefined) } }));

const enabled = process.env['RUN_DB_TESTS'] === '1';
const PIN = '4821';

type TestActor = { id: string; role: 'STORE_MANAGER' | 'STORE_ATTENDANT'; siteId: string };
const keysDeep = (value: unknown, found = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, found));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) (found.add(k), keysDeep(v, found));
  return found;
};

describe.skipIf(!enabled)('recordService against the real database', () => {
  let siteId: string;
  let locationId: string;
  let manager: TestActor;
  let attendant: TestActor;
  let peter: TestActor; // a second Attendant made for this test
  let attendantName = '';
  let attendantFirstName = '';
  let sectionA: { id: string; name: string };
  let sectionB: { id: string; name: string };
  let itemIds: string[] = []; // sugar, rice, oil in section A; tea in section B
  const original = new Map<string, string | null>(); // user id -> pin hash before
  let counters: Record<string, number | null> = {};
  let originalSettings: Awaited<ReturnType<typeof prisma.countingThresholds.findUnique>> = null;

  const reference = (prefix: string) => prisma.referenceCounter.findUnique({ where: { siteId_prefix: { siteId, prefix } } });

  const receive = (itemId: string, quantity: number) =>
    prisma.inventoryTransaction.create({ data: { siteId, locationId, inventoryItemId: itemId, type: 'RECEIVE', quantity: new Prisma.Decimal(quantity), unitCost: new Prisma.Decimal(100), reason: 'test stock', userId: manager.id } });

  const lineOf = async (countId: string, itemId: string) => prisma.countLine.findFirstOrThrow({ where: { countId, inventoryItemId: itemId } });

  const wipeCounts = async () => {
    await prisma.$transaction(async (tx) => {
      await allowLedgerEditsInThisTransaction(tx);
      const lines = await tx.countLine.findMany({ where: { inventoryItemId: { in: itemIds } }, select: { id: true, countId: true } });
      await tx.inventoryTransaction.deleteMany({ where: { OR: [{ countLineId: { in: lines.map((l) => l.id) } }, { inventoryItemId: { in: itemIds }, reason: 'test stock' }] } });
      await tx.count.deleteMany({ where: { id: { in: [...new Set(lines.map((l) => l.countId))] } } });
      await tx.countDayOrder.deleteMany({ where: { siteId, userId: { in: [manager.id, attendant.id, peter.id] } } });
    });
  };

  beforeAll(async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { isHub: true } });
    siteId = hub.id;
    locationId = (await prisma.location.findFirstOrThrow({ where: { siteId, type: 'CENTRAL_STORE' } })).id;
    const managerRow = await prisma.user.findFirstOrThrow({ where: { role: 'STORE_MANAGER', siteId } });
    const attendantRow = await prisma.user.findFirstOrThrow({ where: { role: 'STORE_ATTENDANT', siteId } });
    const peterRow = await prisma.user.create({
      data: { name: 'Peter Kariuki', email: `peter-${randomUUID()}@wendo.test`, passwordHash: 'x', role: 'STORE_ATTENDANT', siteId, pinHash: await hashPin(PIN) },
    });
    manager = { id: managerRow.id, role: 'STORE_MANAGER', siteId };
    attendant = { id: attendantRow.id, role: 'STORE_ATTENDANT', siteId };
    attendantName = attendantRow.name;
    attendantFirstName = attendantRow.name.trim().split(/\s+/)[0]!;
    peter = { id: peterRow.id, role: 'STORE_ATTENDANT', siteId };

    for (const u of [managerRow, attendantRow]) {
      original.set(u.id, u.pinHash);
      await prisma.user.update({ where: { id: u.id }, data: { pinHash: await hashPin(PIN) } });
    }
    counters = { CNT: (await reference('CNT'))?.lastNumber ?? null, ADJ: (await reference('ADJ'))?.lastNumber ?? null };

    // The settings the expectations below are written for: KES 500, 5 %, repeat on, Director alert KES 5,000 (put back afterwards).
    originalSettings = await prisma.countingThresholds.findUnique({ where: { siteId } });
    const settings = { reasonRequiredKes: 500, rangePercent: new Prisma.Decimal(5), flagRepeatShortfalls: true, directorAlertKes: 5000 };
    await prisma.countingThresholds.upsert({ where: { siteId }, create: { siteId, ...settings }, update: settings });

    const last = await prisma.countSection.aggregate({ where: { siteId }, _max: { position: true } });
    const base = (last._max.position ?? 0) + 1;
    sectionA = await prisma.countSection.create({ data: { siteId, name: `Zz test A ${randomUUID().slice(0, 8)}`, kind: 'MANUAL', position: base }, select: { id: true, name: true } });
    sectionB = await prisma.countSection.create({ data: { siteId, name: `Zz test B ${randomUUID().slice(0, 8)}`, kind: 'MANUAL', position: base + 1 }, select: { id: true, name: true } });
    const make = async (name: string, section: { id: string }, position: number, cost: number) => {
      const item = await prisma.inventoryItem.create({ data: { siteId, name: `Zz ${name} ${randomUUID().slice(0, 6)}`, type: 'STOCKED', buyUnit: 'bag', usageUnit: 'kg', currentCost: new Prisma.Decimal(cost) }, select: { id: true } });
      await prisma.countSectionItem.create({ data: { siteId, sectionId: section.id, inventoryItemId: item.id, position } });
      return item.id;
    };
    itemIds = [await make('Sugar', sectionA, 0, 183), await make('Rice', sectionA, 1, 100), await make('Oil', sectionA, 2, 100), await make('Tea', sectionB, 0, 100)];
  });

  afterEach(async () => {
    await wipeCounts();
  });

  afterAll(async () => {
    await wipeCounts();
    await prisma.$transaction(async (tx) => {
      await allowLedgerEditsInThisTransaction(tx);
      await tx.inventoryTransaction.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await tx.countSectionItem.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await tx.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
      await tx.countSection.deleteMany({ where: { id: { in: [sectionA.id, sectionB.id] } } });
      await tx.user.deleteMany({ where: { id: peter.id } });
      for (const [id, pinHash] of original) await tx.user.update({ where: { id }, data: { pinHash } });
      if (originalSettings) {
        const { id: _id, siteId: _siteId, createdAt: _createdAt, ...data } = originalSettings;
        await tx.countingThresholds.update({ where: { siteId }, data });
      } else {
        await tx.countingThresholds.deleteMany({ where: { siteId } });
      }
      for (const [prefix, last] of Object.entries(counters)) {
        if (last === null) await tx.referenceCounter.deleteMany({ where: { siteId, prefix } });
        else await tx.referenceCounter.update({ where: { siteId_prefix: { siteId, prefix } }, data: { lastNumber: last } });
      }
    });
    await prisma.$disconnect();
  });

  const startA = (actor: TestActor, key = randomUUID()) => recordService.start(actor as never, { sectionIds: [sectionA.id], idempotencyKey: key });
  const stock = async () => {
    await prisma.inventoryTransaction.createMany({
      data: [itemIds[0]!, itemIds[1]!, itemIds[2]!, itemIds[3]!].map((inventoryItemId, i) => ({
        siteId,
        locationId,
        inventoryItemId,
        type: 'RECEIVE' as const,
        quantity: new Prisma.Decimal([180, 100, 40, 7][i]!),
        unitCost: new Prisma.Decimal(100),
        reason: 'test stock',
        userId: manager.id,
      })),
    });
  };

  it('start: one line per item in shelf order, numbered CNT-year-nnnn, blind for the Attendant; a replayed key returns the same count', async () => {
    const key = randomUUID();
    const first = await startA(attendant, key);
    expect(first.replayed).toBe(false);
    expect(first.detail).toMatchObject({ status: 'OPEN', statusText: 'In progress', scope: 'SECTIONS', sections: [{ id: sectionA.id }], can: { count: true, sign: true } });
    expect(first.detail.reference).toMatch(/^CNT-\d{4}-\d{4}$/);
    expect(first.detail.lines.map((l) => l.position)).toEqual([0, 1, 2]);
    expect(first.detail.lines.map((l) => l.itemId)).toEqual([itemIds[0], itemIds[1], itemIds[2]]);
    expect(first.detail.lines[0]).toMatchObject({ countedQty: null, skipped: false, recheck: 'NONE', sectionName: sectionA.name, lastCountedText: 'Never counted', unitCost: '183.00' });
    const found = keysDeep(first.detail);
    for (const k of COUNT_STOCK_FIGURE_KEYS) expect(found.has(k), k).toBe(false);

    const again = await startA(attendant, key);
    expect(again.replayed).toBe(true);
    expect(again.detail.id).toBe(first.detail.id);
    expect(await prisma.count.count({ where: { siteId, counterId: attendant.id, status: 'OPEN' } })).toBe(1);
  });

  it('one open count per person, and a section in only one open count at a time (with the person named)', async () => {
    await startA(attendant);
    await expect(startA(attendant)).rejects.toMatchObject({ statusCode: 409, code: 'YOU_HAVE_OPEN_COUNT' });
    await expect(startA(peter)).rejects.toMatchObject({ statusCode: 409, code: 'SECTION_BUSY', message: `${attendantFirstName} is counting ${sectionA.name} right now.` });
    // A different section is free, and so is a person with no open count.
    const other = await recordService.start(peter as never, { sectionIds: [sectionB.id], idempotencyKey: randomUUID() });
    expect(other.detail.lines).toHaveLength(1);
  });

  it('two people racing for one section leave exactly one open count (the partial unique indexes decide)', async () => {
    const results = await Promise.allSettled([startA(attendant), startA(peter), startA(manager)]);
    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(2);
    for (const l of lost) expect(['SECTION_BUSY', 'YOU_HAVE_OPEN_COUNT']).toContain((l.reason as { code: string }).code);
    expect(await prisma.countLine.count({ where: { inventoryItemId: itemIds[0]!, isOpen: true } })).toBe(1);
  });

  it('start options show who is busy, the person’s own open count, and the day order', async () => {
    const mine = await startA(attendant);
    const peterSees = await recordService.startOptions(peter as never, {});
    expect(peterSees.sections.find((s) => s.id === sectionA.id)?.busy).toMatchObject({ countId: mine.detail.id, counterName: attendantName });
    expect(peterSees.sections.find((s) => s.id === sectionB.id)?.busy).toBeNull();
    expect(peterSees.can.start).toBe(true);
    const own = await recordService.startOptions(attendant as never, {});
    expect(own.openCount).toMatchObject({ id: mine.detail.id, progressText: '0 of 3 counted' });
    expect(own.can.start).toBe(false);

    const order = await recordService.setSectionOrder(peter as never, { sectionIds: [sectionB.id, sectionA.id] });
    expect(order.appliesTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const ordered = await recordService.startOptions(peter as never, {});
    expect(ordered.order.mode).toBe('TODAY');
    const ids = ordered.sections.map((s) => s.id);
    expect(ids.indexOf(sectionB.id)).toBeLessThan(ids.indexOf(sectionA.id));
    expect(ids.slice(0, 2)).toEqual([sectionB.id, sectionA.id]);
  });

  it('count, check once, recheck, sign: the Attendant’s count is SUBMITTED with expected stock frozen at the sign, nothing posted, and never a figure shown to them', async () => {
    await stock();
    const started = await startA(attendant);
    const id = started.detail.id;
    const [sugar, rice, oil] = await Promise.all(itemIds.slice(0, 3).map((itemId) => lineOf(id, itemId)));

    // Sugar 164 of 180 (outside), Rice 99 of 100 (within), Oil skipped.
    const saved = await recordService.saveLines(attendant as never, id, {
      lines: [
        { lineId: sugar!.id, countedQty: '164', skipped: false },
        { lineId: rice!.id, countedQty: '99', skipped: false },
        { lineId: oil!.id, countedQty: null, skipped: true },
      ],
    });
    expect(saved.progress).toMatchObject({ total: 3, counted: 2, skipped: 1, text: '2 of 3 counted · 1 skipped' });
    expect(saved.lines).toBeUndefined();

    const check = await recordService.check(attendant as never, id, { sectionId: sectionA.id });
    expect(check.items).toEqual([{ lineId: sugar!.id, itemName: expect.stringContaining('Zz Sugar'), unit: 'kg', sectionName: sectionA.name, counted: '164' }]);
    expect(Object.keys(check.items[0]!).sort()).toEqual(['counted', 'itemName', 'lineId', 'sectionName', 'unit']);
    expect((await recordService.check(attendant as never, id, { sectionId: sectionA.id })).items).toEqual([]); // offered once

    await recordService.saveLines(attendant as never, id, { lines: [{ lineId: sugar!.id, countedQty: '165', skipped: false, recheck: 'RECOUNTED' }] });
    const recounted = await lineOf(id, itemIds[0]!);
    expect(recounted).toMatchObject({ recheck: 'RECOUNTED', recheckOffered: true });
    expect(recounted.firstCountedQty?.toString()).toBe('164');
    expect(recounted.countedQty?.toString()).toBe('165');

    // A wrong PIN writes nothing at all.
    const movementsBefore = await prisma.inventoryTransaction.count({ where: { inventoryItemId: { in: itemIds } } });
    await expect(recordService.sign(attendant as never, id, { pin: '0000', idempotencyKey: randomUUID() })).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_PIN' });
    expect(await prisma.count.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'OPEN', signedAt: null });
    expect((await lineOf(id, itemIds[0]!)).isOpen).toBe(true);

    const signKey = randomUUID();
    const signed = await recordService.sign(attendant as never, id, { pin: PIN, idempotencyKey: signKey });
    expect(signed.replayed).toBe(false);
    expect(signed.detail).toMatchObject({ status: 'SUBMITTED', statusText: 'Submitted', selfSigned: false, approvedAt: null, can: { count: false, sign: false } });
    const found = keysDeep(signed.detail);
    for (const k of COUNT_STOCK_FIGURE_KEYS) expect(found.has(k), k).toBe(false);

    const row = await prisma.count.findUniqueOrThrow({ where: { id }, include: { lines: { orderBy: { position: 'asc' } } } });
    expect(row).toMatchObject({ status: 'SUBMITTED', selfSigned: false, approverId: null, rangeKes: 500, directorAlertKes: expect.any(Number), flagRepeat: expect.any(Boolean) });
    expect(row.rangePercent?.toString()).toBe('5');
    expect(row.expectedAsOf).toEqual(row.signedAt);
    expect(row.lines.map((l) => [l.expectedQty?.toString(), l.unitCost?.toString(), l.result, l.isOpen])).toEqual([
      ['180', '183', 'EXCEEDS', false],
      ['100', '100', 'WITHIN_RANGE', false],
      ['40', '100', 'NOT_COUNTED', false],
    ]);
    expect(await prisma.inventoryTransaction.count({ where: { inventoryItemId: { in: itemIds } } })).toBe(movementsBefore); // nothing posted

    // A stock movement AFTER the sign does not change what was frozen.
    await receive(itemIds[0]!, 500);
    expect((await prisma.countLine.findUniqueOrThrow({ where: { id: sugar!.id } })).expectedQty?.toString()).toBe('180');

    // The same key again: the same signed count, replayed. Another key: refused.
    expect(await recordService.sign(attendant as never, id, { pin: PIN, idempotencyKey: signKey })).toMatchObject({ replayed: true });
    await expect(recordService.sign(attendant as never, id, { pin: PIN, idempotencyKey: randomUUID() })).rejects.toMatchObject({ statusCode: 409, code: 'COUNT_NOT_OPEN' });
    await expect(recordService.saveLines(attendant as never, id, { lines: [{ lineId: rice!.id, countedQty: '1', skipped: false }] })).rejects.toMatchObject({ code: 'COUNT_NOT_OPEN' });

    // The section is free again for the next person.
    expect((await startA(peter)).replayed).toBe(false);
  });

  it('a double tap on Sign at the same instant signs once (the count lock decides) and the other tap is a replay', async () => {
    await stock();
    const { detail } = await startA(attendant);
    const sugar = await lineOf(detail.id, itemIds[0]!);
    await recordService.saveLines(attendant as never, detail.id, { lines: [{ lineId: sugar.id, countedQty: '170', skipped: false }] });
    const key = randomUUID();
    const taps = await Promise.all([recordService.sign(attendant as never, detail.id, { pin: PIN, idempotencyKey: key }), recordService.sign(attendant as never, detail.id, { pin: PIN, idempotencyKey: key })]);
    expect(taps.map((t) => t.replayed).sort()).toEqual([false, true]);
    expect(await prisma.count.count({ where: { id: detail.id, status: 'SUBMITTED' } })).toBe(1);
  });

  it('NOTHING_COUNTED: a count with only skips cannot be signed', async () => {
    const { detail } = await startA(attendant);
    const oil = await lineOf(detail.id, itemIds[2]!);
    await recordService.saveLines(attendant as never, detail.id, { lines: [{ lineId: oil.id, countedQty: null, skipped: true }] });
    await expect(recordService.sign(attendant as never, detail.id, { pin: PIN, idempotencyKey: randomUUID() })).rejects.toMatchObject({ statusCode: 422, code: 'NOTHING_COUNTED' });
    expect((await prisma.count.findUniqueOrThrow({ where: { id: detail.id } })).status).toBe('OPEN');
  });

  it('a Manager counting her own: live figures, then Sign applies every non-zero line through the ledger door and flags the outside-range ones', async () => {
    await stock();
    const { detail } = await startA(manager);
    const [sugar, rice, oil] = await Promise.all(itemIds.slice(0, 3).map((itemId) => lineOf(detail.id, itemId)));
    expect(detail.lines[0]).toMatchObject({ expectedQty: '180', result: 'NOT_YET' });

    const saved = await recordService.saveLines(manager as never, detail.id, {
      lines: [
        { lineId: sugar!.id, countedQty: '164', skipped: false },
        { lineId: rice!.id, countedQty: '99', skipped: false },
        { lineId: oil!.id, countedQty: '40', skipped: false },
      ],
    });
    expect(saved.lines).toEqual(
      expect.arrayContaining([
        { lineId: sugar!.id, result: 'EXCEEDS', difference: '-16', differenceValueKes: '-2928.00' },
        { lineId: rice!.id, result: 'WITHIN_RANGE', difference: '-1', differenceValueKes: '-100.00' },
        { lineId: oil!.id, result: 'MATCHES', difference: '0', differenceValueKes: '0.00' },
      ]),
    );
    expect((await recordService.check(manager as never, detail.id, {})).items).toEqual([]);

    const preview = await recordService.signPreview(manager as never, detail.id);
    expect(preview.figures).toMatchObject({ appliedLines: 1, appliedNetKes: '-100.00', netKes: '-3028.00', causesNeeded: [sugar!.id] });

    // No cause for the outside-range line: refused, nothing written.
    const adjBefore = await prisma.inventoryTransaction.count({ where: { inventoryItemId: { in: itemIds }, type: 'ADJUSTMENT' } });
    await expect(recordService.sign(manager as never, detail.id, { pin: PIN, idempotencyKey: randomUUID() })).rejects.toMatchObject({ statusCode: 422, code: 'CAUSE_REQUIRED' });
    expect(await prisma.inventoryTransaction.count({ where: { inventoryItemId: { in: itemIds }, type: 'ADJUSTMENT' } })).toBe(adjBefore);

    const signed = await recordService.sign(manager as never, detail.id, { pin: PIN, idempotencyKey: randomUUID(), causes: [{ lineId: sugar!.id, cause: 'PREP_NOT_LOGGED' }] });
    expect(signed.detail).toMatchObject({ status: 'APPROVED', statusText: 'Signed', selfSigned: true, can: { decide: false, approve: false } });
    expect(signed.detail.approver).toMatchObject({ id: manager.id });

    const posted = await prisma.inventoryTransaction.findMany({ where: { countLineId: { in: [sugar!.id, rice!.id, oil!.id] } }, orderBy: { reference: 'asc' } });
    expect(posted.map((t) => [t.type, t.inventoryItemId, t.quantity.toString(), t.unitCost.toString(), t.userId, t.siteId, t.locationId])).toEqual(
      expect.arrayContaining([
        ['ADJUSTMENT', itemIds[0], '-16', '183', manager.id, siteId, locationId],
        ['ADJUSTMENT', itemIds[1], '-1', '100', manager.id, siteId, locationId],
      ]),
    );
    expect(posted).toHaveLength(2); // nothing for the matched line
    const numbers = posted.map((t) => Number((t.reference ?? '').replace('ADJ-', ''))).sort((a, b) => a - b);
    expect(numbers[1]).toBe(numbers[0]! + 1); // ADJ numbers are gap-free
    expect(posted.every((t) => /^ADJ-\d{4}$/.test(t.reference ?? ''))).toBe(true);

    const lines = await prisma.countLine.findMany({ where: { countId: detail.id }, orderBy: { position: 'asc' } });
    expect(lines.map((l) => [l.decision, l.cause, l.directorFlagged, l.directorAlert, l.decidedById])).toEqual([
      ['WRITE_OFF', 'PREP_NOT_LOGGED', true, false, manager.id],
      ['ACCEPTED', null, false, false, manager.id],
      ['PENDING', null, false, false, null],
    ]);
    expect(signed.detail.lines[0]).toMatchObject({ adjustmentRef: expect.stringMatching(/^ADJ-/), director: { flagged: true } });
    // The stock on hand fell by exactly what was applied.
    const onHand = await prisma.inventoryTransaction.aggregate({ where: { inventoryItemId: itemIds[0]! }, _sum: { quantity: true } });
    expect(onHand._sum.quantity?.toString()).toBe('164');
  });

  it('the all-or-none rule: when the door refuses one line, the whole sign rolls back (the count stays OPEN, nothing posted)', async () => {
    await stock();
    const { detail } = await startA(manager);
    const sugar = await lineOf(detail.id, itemIds[0]!);
    const rice = await lineOf(detail.id, itemIds[1]!);
    await recordService.saveLines(manager as never, detail.id, { lines: [{ lineId: sugar.id, countedQty: '164', skipped: false }, { lineId: rice.id, countedQty: '99', skipped: false }] });
    // A negative item cost makes the door refuse the second line.
    await prisma.inventoryItem.update({ where: { id: itemIds[1]! }, data: { currentCost: new Prisma.Decimal(-1) } });
    try {
      await expect(recordService.sign(manager as never, detail.id, { pin: PIN, idempotencyKey: randomUUID(), causes: [{ lineId: sugar.id, cause: 'LOSS' }] })).rejects.toBeTruthy();
    } finally {
      await prisma.inventoryItem.update({ where: { id: itemIds[1]! }, data: { currentCost: new Prisma.Decimal(100) } });
    }
    expect(await prisma.count.findUniqueOrThrow({ where: { id: detail.id } })).toMatchObject({ status: 'OPEN', signedAt: null });
    expect(await prisma.inventoryTransaction.count({ where: { countLineId: { in: [sugar.id, rice.id] } } })).toBe(0);
    expect((await lineOf(detail.id, itemIds[0]!)).isOpen).toBe(true);
  });

  it('a person who is not the counter cannot touch the count', async () => {
    const { detail } = await startA(attendant);
    await expect(recordService.saveLines(peter as never, detail.id, { lines: [{ lineId: (await lineOf(detail.id, itemIds[0]!)).id, countedQty: '1', skipped: false }] })).rejects.toMatchObject({ statusCode: 404 });
    await expect(recordService.sign(manager as never, detail.id, { pin: PIN, idempotencyKey: randomUUID() })).rejects.toMatchObject({ statusCode: 403, code: 'NOT_YOUR_COUNT' });
  });

  it('an item-scoped recount links back to the line it came from, and refuses a line that was not outside the range', async () => {
    await stock();
    const first = await startA(attendant);
    const sugar = await lineOf(first.detail.id, itemIds[0]!);
    await recordService.saveLines(attendant as never, first.detail.id, { lines: [{ lineId: sugar.id, countedQty: '150', skipped: false }] });
    await recordService.sign(attendant as never, first.detail.id, { pin: PIN, idempotencyKey: randomUUID() });

    const options = await recordService.startOptions(manager as never, { recountLineId: sugar.id });
    expect(options.recount).toMatchObject({ lineId: sugar.id, countReference: first.detail.reference, sectionName: sectionA.name });

    const recount = await recordService.start(manager as never, { recountOfLineId: sugar.id, idempotencyKey: randomUUID() });
    expect(recount.detail).toMatchObject({ scope: 'ITEMS', sections: [], recountOf: { lineId: sugar.id, reference: first.detail.reference } });
    expect(recount.detail.lines.map((l) => l.itemId)).toEqual([itemIds[0]]);

    const riceLine = await lineOf(first.detail.id, itemIds[1]!);
    await expect(recordService.start(peter as never, { recountOfLineId: riceLine.id, idempotencyKey: randomUUID() })).rejects.toMatchObject({ statusCode: 422, code: 'RECOUNT_NOT_ALLOWED' });
  });
});
