/**
 * Block 2, back end C against a REAL database (no mocks of the data layer). Opt-in:
 *   cd backend && RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/dispatch/dispatch.db.test.ts
 * It builds its own branch, departments, users, items, stock, requisition and carriers, and removes everything it made (the ledger
 * is append-only, so its cleanup lifts that lock inside one transaction, as the dev seed scripts do). Use only the lane's own database.
 *
 * Covers: the queue, the pack views (a pending addition's lines are hidden, a department added in Block 1 with no legacy key is
 * visible), save errors, the final sign (one transaction, DSP- numbers, DISPATCH_OUT through the door, leave out, replay, errors), the
 * blind and money rules on the file, the print copies, cancel (linked reversal, replay, already counted), a race for the last unit,
 * the requisition roll-up and the two hand-offs, and the history.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { hashPin } from '../../../utils/password';
import { allowLedgerEditsInThisTransaction } from '../../../scripts/ledger-dev-bypass';
import { departmentLinks } from '../departments/department-links';
import { LOCK_WAIT_MS, takeDbTestLock } from '../_shared/db-test-lock';
import { closeIfComplete } from '../requisitions/requisitions-handoff';
import { dispatchRollUp } from './dispatch-roll-up';
import { carriersService } from './carriers-service';
import { dispatchService } from './dispatch-service';

vi.mock('./dispatch-notify', () => ({ dispatchNotices: { signed: vi.fn(), cancelled: vi.fn(), packed: vi.fn() } }));

const enabled = process.env['RUN_DB_TESTS'] === '1';
const tag = randomUUID().slice(0, 8);
const PIN = '4821';

let releaseDbLock: () => Promise<void> = async () => undefined;
beforeAll(async () => {
  if (enabled) releaseDbLock = await takeDbTestLock();
}, LOCK_WAIT_MS);
afterAll(async () => {
  await releaseDbLock();
});

type A = { id: string; role: 'STORE_ATTENDANT' | 'STORE_MANAGER' | 'MANAGER' | 'DIRECTOR'; siteId: string | null; isDepartmentHead: boolean };

describe.skipIf(!enabled)('Dispatch against the real database', () => {
  let hubId = '';
  let storeLocationId = '';
  let siteId = '';
  let code = '';
  let kitchenId = '';
  let baristaId = '';
  let gardenId = '';
  let milkId = '';
  let creamId = '';
  let attendant: A;
  let storeManager: A;
  let branchManager: A;
  let director: A;
  let carrierId = '';
  let retiredCarrierId = '';
  let requisitionId = '';
  let kitchenLineMilk = '';
  let kitchenLineCream = '';
  let baristaLineMilk = '';
  const userIds: string[] = [];
  const itemIds: string[] = [];
  const siteIds: string[] = [];

  const onHand = async (itemId: string): Promise<string> => {
    const sum = await prisma.inventoryTransaction.aggregate({ where: { locationId: storeLocationId, inventoryItemId: itemId }, _sum: { quantity: true } });
    return (sum._sum.quantity ?? new Prisma.Decimal(0)).toString();
  };
  const sign = (a: A, key: string, over: Record<string, unknown> = {}) =>
    dispatchService.sign(a as never, requisitionId, { carrierId, pin: PIN, idempotencyKey: key, ...over } as never);
  const tick = (a: A, departmentId: string, lines: Array<{ lineId: string; sentQty: string; packedTick: boolean }>) =>
    dispatchService.saveLines(a as never, requisitionId, departmentId, { lines });

  beforeAll(async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { type: 'CENTRAL_STORE', isHub: true }, select: { id: true, companyId: true } });
    hubId = hub.id;
    storeLocationId = (await prisma.location.findFirstOrThrow({ where: { type: 'CENTRAL_STORE' }, select: { id: true } })).id;
    code = `Z${tag.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, 'Q')}Y`.slice(0, 3);
    const branch = await prisma.site.create({ data: { companyId: hub.companyId, type: 'BRANCH', name: `Dispatch test ${tag}`, code, address: 'x', city: 'x', latitude: 0, longitude: 0 } });
    siteId = branch.id;
    siteIds.push(siteId);
    await departmentLinks.provisionBranch({ id: siteId, name: 'x', code });
    const depts = await prisma.department.findMany({ where: { siteId }, select: { id: true, key: true } });
    kitchenId = depts.find((d) => d.key === 'KITCHEN')?.id ?? '';
    baristaId = depts.find((d) => d.key === 'BARISTA')?.id ?? '';
    gardenId = (await prisma.department.create({ data: { siteId, name: `Garden ${tag}`, position: 9 } })).id;

    const pinHash = await hashPin(PIN);
    const user = async (name: string, role: A['role'], site: string | null, extra: Record<string, unknown> = {}): Promise<A> => {
      const u = await prisma.user.create({ data: { name: `${name} ${tag}`, email: `${name}-${tag}@test.invalid`, passwordHash: 'x', pinHash, role, siteId: site, ...extra } });
      userIds.push(u.id);
      return { id: u.id, role, siteId: site, isDepartmentHead: false };
    };
    attendant = await user('att', 'STORE_ATTENDANT', hubId);
    storeManager = await user('sm', 'STORE_MANAGER', hubId);
    branchManager = await user('bm', 'MANAGER', siteId);
    director = await user('dir', 'DIRECTOR', null);

    const item = async (name: string, cost: number): Promise<string> => {
      const i = await prisma.inventoryItem.create({ data: { siteId: hubId, name: `${name} ${tag}`, type: 'STOCKED', buyUnit: 'kg', usageUnit: 'kg', departmentTags: [], currentCost: new Prisma.Decimal(cost) } });
      itemIds.push(i.id);
      return i.id;
    };
    milkId = await item('Milk', 100);
    creamId = await item('Cream', 250);
    for (const [itemId, qty, cost] of [[milkId, 10, 100], [creamId, 4, 250]] as const) {
      await prisma.inventoryTransaction.create({ data: { siteId: hubId, locationId: storeLocationId, inventoryItemId: itemId, type: 'RECEIVE', quantity: new Prisma.Decimal(qty), unitCost: new Prisma.Decimal(cost), userId: storeManager.id } });
    }

    carrierId = (await carriersService.add(storeManager as never, { name: `Van ${tag}`, kind: 'VEHICLE' })).id;
    retiredCarrierId = (await carriersService.add(storeManager as never, { name: `Old van ${tag}`, kind: 'VEHICLE' })).id;
    await carriersService.update(storeManager as never, retiredCarrierId, { active: false });

    const rec = await prisma.requisition.create({
      data: { siteId, type: 'MORNING', reference: `REQ-${code}-9001`, status: 'APPROVED', openedById: branchManager.id, approvedById: branchManager.id, approvedAt: new Date() },
    });
    requisitionId = rec.id;
    const section = (departmentId: string, key: 'KITCHEN' | 'BARISTA' | null) =>
      prisma.requisitionSection.create({ data: { requisitionId, departmentId, departmentTag: key, status: 'SUBMITTED' } });
    const kitchen = await section(kitchenId, 'KITCHEN');
    const barista = await section(baristaId, 'BARISTA');
    const garden = await section(gardenId, null);
    const line = async (sectionId: string, itemId: string, qty: number, extra: Record<string, unknown> = {}) =>
      (await prisma.requisitionLine.create({ data: { requisitionSectionId: sectionId, inventoryItemId: itemId, requestedQty: new Prisma.Decimal(qty), approvedQty: new Prisma.Decimal(qty), ...extra } })).id;
    kitchenLineMilk = await line(kitchen.id, milkId, 5);
    kitchenLineCream = await line(kitchen.id, creamId, 2);
    baristaLineMilk = await line(barista.id, milkId, 3);
    await line(garden.id, creamId, 1);
    // A pending addition's line is not packed yet; an approved one is.
    const addition = await prisma.requisitionAddition.create({ data: { requisitionId, departmentId: kitchenId, addedById: branchManager.id, sentPinSignedAt: new Date() } });
    await line(kitchen.id, milkId, 1, { additionId: addition.id, approvedQty: null });
  }, 60_000);

  afterAll(async () => {
    if (!enabled) return;
    await prisma.$transaction(async (tx) => {
      await allowLedgerEditsInThisTransaction(tx);
      const dispatches = await tx.dispatch.findMany({ where: { toSiteId: siteId }, select: { id: true, lines: { select: { id: true } } } });
      const lineIds = dispatches.flatMap((d) => d.lines.map((l) => l.id));
      await tx.$executeRaw`UPDATE inventory_transactions SET reverses_transaction_id = NULL WHERE dispatch_line_id = ANY(${lineIds}::text[])`;
      await tx.inventoryTransaction.deleteMany({ where: { OR: [{ dispatchLineId: { in: lineIds } }, { inventoryItemId: { in: itemIds } }] } });
      await tx.dispatchEvent.deleteMany({ where: { dispatchId: { in: dispatches.map((d) => d.id) } } });
      await tx.dispatchLine.deleteMany({ where: { dispatchId: { in: dispatches.map((d) => d.id) } } });
      await tx.dispatch.deleteMany({ where: { toSiteId: siteId } });
      await tx.carrier.deleteMany({ where: { siteId: hubId, name: { contains: tag } } });
      await tx.requisitionLine.deleteMany({ where: { section: { requisitionId } } });
      await tx.requisitionAddition.deleteMany({ where: { requisitionId } });
      await tx.requisitionSection.deleteMany({ where: { requisitionId } });
      await tx.requisition.deleteMany({ where: { id: requisitionId } });
      await tx.referenceCounter.deleteMany({ where: { siteId: { in: siteIds } } });
      await tx.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
      await tx.department.deleteMany({ where: { siteId } });
      await tx.site.deleteMany({ where: { id: { in: siteIds } } });
    });
    await prisma.$disconnect();
  });

  it('P1: the queue lists the requisition with every department that has lines, the pending addition not counted, oldest first', async () => {
    const queue = await dispatchService.queue(attendant as never);
    const card = queue.cards.find((c) => c.requisitionId === requisitionId);
    expect(card?.reference).toBe(`REQ-${code}-9001`);
    expect(card?.departments.map((d) => [d.departmentName.replace(` ${tag}`, ''), d.lineCount, d.state])).toEqual([
      ['Kitchen', 2, 'TO_PACK'], // the pending addition's line is not packed yet
      ['Barista', 1, 'TO_PACK'],
      ['Garden', 1, 'TO_PACK'], // a department added in Block 1 has no legacy key and is still packed
    ]);
    expect(queue.branchesToPack).toBeGreaterThanOrEqual(1);
  });

  it('P2: opening a department creates its dispatch, pre-filled with the requested quantity (or what the store holds), with on hand and no money', async () => {
    const dept = await dispatchService.getDepartment(attendant as never, requisitionId, kitchenId);
    expect(dept.position).toEqual({ index: 1, total: 3 });
    expect(dept.lines.map((l) => [l.requestedQty, l.sentQty, l.onHand, l.packedTick, l.short])).toEqual(
      expect.arrayContaining([['5', '5', '10', false, false], ['2', '2', '4', false, false]]),
    );
    expect(JSON.stringify(dept)).not.toMatch(/cost|value|price|kes/i);
    expect(dept.nextDepartmentId).toBe(baristaId);
    expect(await prisma.dispatch.count({ where: { requisitionId, departmentId: kitchenId } })).toBe(1);
    // A second look does not create a second dispatch.
    await dispatchService.getDepartment(attendant as never, requisitionId, kitchenId);
    expect(await prisma.dispatch.count({ where: { requisitionId, departmentId: kitchenId } })).toBe(1);
  });

  it('P3: more than requested is OVER_REQUESTED; a ticked line above the store is STOCK_CHANGED; nothing is saved on an error', async () => {
    await expect(tick(attendant, kitchenId, [{ lineId: kitchenLineMilk, sentQty: '6', packedTick: true }])).rejects.toMatchObject({ code: 'OVER_REQUESTED', statusCode: 422 });
    await expect(tick(attendant, kitchenId, [{ lineId: randomUUID(), sentQty: '1', packedTick: true }])).rejects.toMatchObject({ statusCode: 404 });
    const line = await prisma.dispatchLine.findFirstOrThrow({ where: { requisitionLineId: kitchenLineMilk } });
    expect(line.packedTick).toBe(false);
  });

  it('P3: saving ticks moves the dispatch to PACKING and a shortfall sets the short flag; a short line is normal', async () => {
    const saved = await tick(attendant, kitchenId, [{ lineId: kitchenLineMilk, sentQty: '4', packedTick: true }]);
    expect(saved.state).toBe('PACKING');
    expect(saved.packedCount).toBe(1);
    expect(saved.lines.find((l) => l.lineId === kitchenLineMilk)).toMatchObject({ sentQty: '4', short: true, packedTick: true });
    expect((await prisma.dispatch.findFirstOrThrow({ where: { requisitionId, departmentId: kitchenId } })).status).toBe('PACKING');
  });

  it('P4: the review lists every department still to pack, what is short, the carriers and the signer; only a ticked department can be left out', async () => {
    await tick(attendant, kitchenId, [{ lineId: kitchenLineCream, sentQty: '2', packedTick: true }]);
    const review = await dispatchService.review(attendant as never, requisitionId);
    const kitchen = review.departments.find((d) => d.departmentId === kitchenId);
    expect(kitchen).toMatchObject({ allTicked: true, canLeaveOut: true, shortCount: 1, lineCount: 2 });
    expect(kitchen?.shortLines).toEqual([expect.objectContaining({ requestedQty: '5', sentQty: '4' })]);
    expect(review.departments.find((d) => d.departmentId === baristaId)).toMatchObject({ allTicked: false, canLeaveOut: false });
    expect(review.carriers.map((c) => c.id)).toEqual([carrierId]); // the retired carrier is not offered
    expect(review.canSign).toBe(true);
    expect(review.signedBy.id).toBe(attendant.id);
  });

  it('P5 errors: a department not left out with an unticked line is NOT_ALL_PACKED; a wrong PIN is INVALID_PIN; a retired carrier is CARRIER_INACTIVE; leaving everything out is NOTHING_TO_SEND', async () => {
    await expect(sign(attendant, `k-all-${tag}`)).rejects.toMatchObject({ code: 'NOT_ALL_PACKED', statusCode: 409, details: { departmentIds: expect.arrayContaining([baristaId, gardenId]) } });
    await expect(sign(attendant, `k-pin-${tag}`, { pin: '0000', leaveOut: [baristaId, gardenId] })).rejects.toMatchObject({ code: 'INVALID_PIN', statusCode: 401 });
    await expect(sign(attendant, `k-car-${tag}`, { carrierId: retiredCarrierId, leaveOut: [baristaId, gardenId] })).rejects.toMatchObject({ code: 'CARRIER_INACTIVE' });
    await expect(sign(attendant, `k-none-${tag}`, { leaveOut: [kitchenId, baristaId, gardenId] })).rejects.toMatchObject({ code: 'NOTHING_TO_SEND' });
    expect(await prisma.inventoryTransaction.count({ where: { dispatchLine: { dispatch: { requisitionId } }, type: 'DISPATCH_OUT' } })).toBe(0); // nothing was written
    expect(await prisma.dispatch.count({ where: { requisitionId, reference: { not: null } } })).toBe(0);
  });

  it('P5: the final sign numbers the shipped department, posts DISPATCH_OUT through the door at the frozen cost, and leaves the others in To pack', async () => {
    const milkBefore = await onHand(milkId);
    const result = await sign(attendant, `k-sign-${tag}`, { leaveOut: [baristaId, gardenId] });
    expect(result.replayed).toBe(false);
    expect(result.dispatches).toEqual([expect.objectContaining({ reference: `DSP-${code}-0001`, departmentId: kitchenId, lineCount: 2, shortCount: 1 })]);
    expect(result.leftOut.map((d) => d.id).sort()).toEqual([baristaId, gardenId].sort());
    expect(result).toMatchObject({ sentDepartments: 1, totalDepartments: 3, lineCount: 2, shortCount: 1 });
    expect(JSON.stringify(result)).not.toMatch(/cost|value|price|kes/i);

    // The ledger: one negative DISPATCH_OUT per sent line, at the cost frozen now, each linked to its dispatch line.
    expect(await onHand(milkId)).toBe(new Prisma.Decimal(milkBefore).minus(4).toString());
    const outs = await prisma.inventoryTransaction.findMany({ where: { dispatchLine: { dispatch: { requisitionId } }, type: 'DISPATCH_OUT' }, select: { quantity: true, unitCost: true, siteId: true, locationId: true } });
    expect(outs.map((o) => o.quantity.toString()).sort()).toEqual(['-2', '-4']);
    expect(outs.every((o) => o.siteId === hubId && o.locationId === storeLocationId)).toBe(true);
    const frozen = await prisma.dispatchLine.findMany({ where: { dispatch: { requisitionId, departmentId: kitchenId } }, select: { unitCostAtDispatch: true } });
    expect(frozen.map((l) => l.unitCostAtDispatch?.toString()).sort()).toEqual(['100', '250']);
    expect(await prisma.dispatchEvent.count({ where: { type: 'SIGNED_AND_SENT', dispatch: { requisitionId } } })).toBe(1);

    // The others are still to pack; the department just sent is not.
    const card = (await dispatchService.queue(attendant as never)).cards.find((c) => c.requisitionId === requisitionId);
    expect(card?.departments.map((d) => d.departmentId).sort()).toEqual([baristaId, gardenId].sort());
    await expect(dispatchService.getDepartment(attendant as never, requisitionId, kitchenId)).rejects.toMatchObject({ code: 'ALREADY_SIGNED' });
    await expect(tick(attendant, kitchenId, [{ lineId: kitchenLineMilk, sentQty: '5', packedTick: true }])).rejects.toMatchObject({ code: 'ALREADY_SIGNED' });
  });

  it('P5: a repeated key returns the first result and writes nothing twice', async () => {
    const before = await prisma.inventoryTransaction.count({ where: { dispatchLine: { dispatch: { requisitionId } } } });
    const again = await sign(attendant, `k-sign-${tag}`, { leaveOut: [baristaId, gardenId] });
    expect(again.replayed).toBe(true);
    expect(again.dispatches[0]?.reference).toBe(`DSP-${code}-0001`);
    expect(await prisma.inventoryTransaction.count({ where: { dispatchLine: { dispatch: { requisitionId } } } })).toBe(before);
    expect((await prisma.referenceCounter.findUniqueOrThrow({ where: { siteId_prefix: { siteId, prefix: 'DSP' } } })).lastNumber).toBe(1);
  });

  it('P6 blind rule: the Branch Manager gets no sent figure, gap, short count or value before the department counts; the store sees them', async () => {
    const id = (await prisma.dispatch.findFirstOrThrow({ where: { requisitionId, departmentId: kitchenId } })).id;
    const branchSide = await dispatchService.getFile(branchManager as never, id);
    expect(branchSide.sentVisible).toBe(false);
    expect(branchSide.items.every((i) => !('sentQty' in i) && !('gapQty' in i) && !('valueKes' in i))).toBe(true);
    expect(branchSide).toMatchObject({ shortCount: 0, stage: 'ON_THE_WAY' });
    expect('valueKes' in branchSide).toBe(false);
    expect(branchSide.items.map((i) => i.requestedQty).sort()).toEqual(['2', '5']);

    const store = await dispatchService.getFile(storeManager as never, id);
    expect(store.sentVisible).toBe(true);
    expect(store.items.find((i) => i.requestedQty === '5')).toMatchObject({ sentQty: '4', countedQty: null });
    expect(store.shortCount).toBe(1);
    expect(store.reference).toBe(`DSP-${code}-0001`);
    expect(store.carrier.id).toBe(carrierId);
    expect(store.tracker.map((s) => [s.key, s.state])).toEqual([['APPROVED', 'DONE'], ['PACKED', 'DONE'], ['ON_THE_WAY', 'DONE'], ['COUNTED', 'CURRENT'], ['CLOSED', 'TODO']]);
    expect(store.can).toMatchObject({ print: true, cancel: true });
    expect(store.activity.map((e) => e.type)).toEqual(['SIGNED_AND_SENT']);
    expect(store.siblings).toEqual([]); // the other departments have no dispatch signed (cancelled/unsigned ones are not siblings of a file)
  });

  it('P6 money: only a holder of requisitions.see_value sees cost and value; the Attendant never does', async () => {
    const id = (await prisma.dispatch.findFirstOrThrow({ where: { requisitionId, departmentId: kitchenId } })).id;
    const attendantView = await dispatchService.getFile(attendant as never, id);
    expect(JSON.stringify(attendantView)).not.toMatch(/valueKes|unitCostKes|lossValueKes/);
    const manager = await dispatchService.getFile(storeManager as never, id);
    const directorView = await dispatchService.getFile(director as never, id);
    for (const view of [manager, directorView]) {
      if ('valueKes' in view) expect(view.valueKes).toBe('900.00'); // 4 × 100 + 2 × 250
    }
  });

  it('P6 scope: the Branch Manager of another branch finds nothing; an Attendant who did not pack it finds nothing', async () => {
    const id = (await prisma.dispatch.findFirstOrThrow({ where: { requisitionId, departmentId: kitchenId } })).id;
    const strangerBranch = await prisma.user.create({ data: { name: `x ${tag}`, email: `x-${tag}@test.invalid`, passwordHash: 'x', role: 'MANAGER', siteId: hubId } });
    userIds.push(strangerBranch.id);
    await expect(dispatchService.getFile({ id: strangerBranch.id, role: 'MANAGER', siteId: hubId } as never, id)).rejects.toMatchObject({ statusCode: 404 });
    const otherAttendant = await prisma.user.create({ data: { name: `att2 ${tag}`, email: `att2-${tag}@test.invalid`, passwordHash: 'x', role: 'STORE_ATTENDANT', siteId: hubId } });
    userIds.push(otherAttendant.id);
    await expect(dispatchService.getFile({ id: otherAttendant.id, role: 'STORE_ATTENDANT', siteId: hubId } as never, id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('P7: the store copy has quantities, the branch copy has none, and the blind branch side may not print the store copy before the count', async () => {
    const id = (await prisma.dispatch.findFirstOrThrow({ where: { requisitionId, departmentId: kitchenId } })).id;
    const store = await dispatchService.print(attendant as never, id, 'store');
    expect(store).toMatchObject({ copy: 'store', voided: false, cancelledAt: null, reference: `DSP-${code}-0001` });
    expect(store.lines.map((l) => 'sentQty' in l && l.sentQty).sort()).toEqual(['2', '4']);
    const branch = await dispatchService.print(branchManager as never, id, 'branch');
    expect(branch.copy).toBe('branch');
    expect(JSON.stringify(branch.lines)).not.toMatch(/Qty/);
    await expect(dispatchService.print(branchManager as never, id, 'store')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('the requisition roll-up: the dispatches of the file, "n of m sent" and "n counted", and the DSP- number on the print cover', async () => {
    const rollUp = await dispatchRollUp.forRequisition(requisitionId);
    expect(rollUp.tracker).toMatchObject({ total: 3, sent: 1, counted: 0 });
    expect(rollUp.dispatches.find((d) => d.departmentId === kitchenId)).toMatchObject({ reference: `DSP-${code}-0001`, status: 'ON_THE_WAY', derivedState: 'ON_THE_WAY', lineCount: 2 });
    expect(rollUp.dispatches.find((d) => d.departmentId === baristaId)).toMatchObject({ reference: null, signedAt: null, carrierName: null });
    expect((await dispatchRollUp.referencesOf(requisitionId)).get(kitchenId)).toBe(`DSP-${code}-0001`);
  });

  it('P9: the Attendant\'s On the way tab lists it; Done is empty; the counts add up', async () => {
    const mine = await dispatchService.mine(attendant as never, { tab: 'on-the-way', page: 1, pageSize: 50 } as never);
    expect(mine.rows.some((r) => r.reference === `DSP-${code}-0001`)).toBe(true);
    expect(mine.rows.find((r) => r.reference === `DSP-${code}-0001`)).toMatchObject({ lineCount: 2, result: null, stage: 'ON_THE_WAY' });
    expect(mine.tabCounts['on-the-way']).toBeGreaterThanOrEqual(1);
    const done = await dispatchService.mine(attendant as never, { tab: 'done', page: 1, pageSize: 50 } as never);
    expect(done.rows.some((r) => r.reference === `DSP-${code}-0001`)).toBe(false);
  });

  it('P5: two Attendants racing for the last stock: one ships, the other gets STOCK_CHANGED, and the store never goes negative', async () => {
    // Barista wants 3 milk; leave the store with only 2 after another department took the rest.
    const milkNow = new Prisma.Decimal(await onHand(milkId));
    await prisma.inventoryTransaction.create({ data: { siteId: hubId, locationId: storeLocationId, inventoryItemId: milkId, type: 'WASTE', quantity: milkNow.minus(2).negated(), unitCost: new Prisma.Decimal(100), userId: storeManager.id } });
    await dispatchService.getDepartment(attendant as never, requisitionId, baristaId);
    await tick(attendant, baristaId, [{ lineId: baristaLineMilk, sentQty: '2', packedTick: true }]); // 2 of 3, what the store holds
    await dispatchService.getDepartment(attendant as never, requisitionId, gardenId);
    const gardenLine = (await prisma.requisitionLine.findFirstOrThrow({ where: { section: { requisitionId, departmentId: gardenId } } })).id;
    await tick(attendant, gardenId, [{ lineId: gardenLine, sentQty: '1', packedTick: true }]);
    const results = await Promise.allSettled([sign(attendant, `k-race-a-${tag}`, { leaveOut: [gardenId] }), sign(storeManager, `k-race-b-${tag}`, { leaveOut: [gardenId] })]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(lost.reason).toMatchObject({ statusCode: 409 }); // the loser finds the department already signed or short of stock
    expect(Number(await onHand(milkId))).toBeGreaterThanOrEqual(0);
    expect((await prisma.referenceCounter.findUniqueOrThrow({ where: { siteId_prefix: { siteId, prefix: 'DSP' } } })).lastNumber).toBe(2); // gap-free: 0001, 0002
  });

  it('P5 STOCK_CHANGED: stock that fell under a ticked line flags the lines and writes nothing', async () => {
    await dispatchService.getDepartment(attendant as never, requisitionId, gardenId);
    const creamNow = new Prisma.Decimal(await onHand(creamId));
    await prisma.inventoryTransaction.create({ data: { siteId: hubId, locationId: storeLocationId, inventoryItemId: creamId, type: 'WASTE', quantity: creamNow.negated(), unitCost: new Prisma.Decimal(250), userId: storeManager.id } });
    const before = await prisma.dispatch.count({ where: { requisitionId, reference: { not: null } } });
    const gardenLine = (await prisma.requisitionLine.findFirstOrThrow({ where: { section: { requisitionId, departmentId: gardenId } } })).id;
    await expect(sign(attendant, `k-stock-${tag}`)).rejects.toMatchObject({ code: 'STOCK_CHANGED', statusCode: 409, details: { lineIds: [gardenLine] } });
    expect(await prisma.dispatch.count({ where: { requisitionId, reference: { not: null } } })).toBe(before);
    // Put the cream back for the cancel tests.
    await prisma.inventoryTransaction.create({ data: { siteId: hubId, locationId: storeLocationId, inventoryItemId: creamId, type: 'RECEIVE', quantity: new Prisma.Decimal(5), unitCost: new Prisma.Decimal(250), userId: storeManager.id } });
  });

  it('P8 cancel: a reason and PIN are required; stock goes back by a linked reversal; the note is voided and kept; the lines return to the queue with ticks reset', async () => {
    const dispatch = await prisma.dispatch.findFirstOrThrow({ where: { requisitionId, departmentId: kitchenId, status: 'ON_THE_WAY' }, include: { lines: true } });
    const milkBefore = await onHand(milkId);
    await expect(dispatchService.cancel(attendant as never, dispatch.id, { reason: 'Packed the wrong lines', pin: PIN, idempotencyKey: `c-att-${tag}` })).rejects.toMatchObject({ statusCode: 403 });
    await expect(dispatchService.cancel(storeManager as never, dispatch.id, { reason: 'Packed the wrong lines', pin: '0000', idempotencyKey: `c-bad-${tag}` })).rejects.toMatchObject({ code: 'INVALID_PIN' });
    const result = await dispatchService.cancel(storeManager as never, dispatch.id, { reason: 'Packed the wrong lines — milk was the wrong tin', pin: PIN, idempotencyKey: `c-${tag}` });
    expect(result).toMatchObject({ id: dispatch.id, status: 'CANCELLED', linesReturnedToQueue: 2, replayed: false });
    // The reversing rows are new, positive, linked to the originals; the originals stay.
    const rows = await prisma.inventoryTransaction.findMany({ where: { dispatchLineId: { in: dispatch.lines.map((l) => l.id) } }, orderBy: { createdAt: 'asc' } });
    expect(rows).toHaveLength(4);
    const originals = rows.filter((r) => r.reversesTransactionId === null);
    const reversals = rows.filter((r) => r.reversesTransactionId !== null);
    expect(reversals.map((r) => r.reversesTransactionId).sort()).toEqual(originals.map((r) => r.id).sort());
    expect(reversals.every((r) => r.quantity.greaterThan(0) && r.type === 'DISPATCH_OUT')).toBe(true);
    expect(await onHand(milkId)).toBe(new Prisma.Decimal(milkBefore).plus(4).toString());
    expect(Number(await onHand(creamId))).toBeGreaterThanOrEqual(2);
    // The voided note is kept; the file shows who cancelled and why.
    const file = await dispatchService.getFile(storeManager as never, dispatch.id);
    expect(file).toMatchObject({ status: 'CANCELLED', stage: 'CANCELLED', cancelled: { reason: 'Packed the wrong lines — milk was the wrong tin' } });
    expect(file.documents.every((d) => d.voided)).toBe(true);
    expect(file.activity.map((e) => e.type)).toEqual(['SIGNED_AND_SENT', 'CANCELLED']);
    const print = await dispatchService.print(storeManager as never, dispatch.id, 'branch');
    expect(print).toMatchObject({ voided: true, cancelledAt: expect.any(String) });
    // The department is back in the queue with ticks reset, as a fresh dispatch.
    const fresh = await dispatchService.getDepartment(attendant as never, requisitionId, kitchenId);
    expect(fresh.packedCount).toBe(0);
    expect(fresh.state).toBe('TO_PACK');
    expect(await prisma.dispatch.count({ where: { requisitionId, departmentId: kitchenId } })).toBe(2);
  });

  it('P8: a repeated key returns the first result; a second cancel is DISPATCH_CANCELLED; the other dispatches are untouched', async () => {
    const cancelled = await prisma.dispatch.findFirstOrThrow({ where: { requisitionId, departmentId: kitchenId, status: 'CANCELLED' } });
    const again = await dispatchService.cancel(storeManager as never, cancelled.id, { reason: 'Packed the wrong lines — milk was the wrong tin', pin: PIN, idempotencyKey: `c-${tag}` });
    expect(again.replayed).toBe(true);
    await expect(dispatchService.cancel(storeManager as never, cancelled.id, { reason: 'Other — again', pin: PIN, idempotencyKey: `c2-${tag}` })).rejects.toMatchObject({ code: 'DISPATCH_CANCELLED' });
    expect((await prisma.dispatch.findFirstOrThrow({ where: { requisitionId, departmentId: baristaId, status: { not: 'CANCELLED' } } })).status).toBe('ON_THE_WAY');
  });

  it('P8: once the department has counted, a cancel is DISPATCH_ALREADY_COUNTED; an unsigned dispatch is NOT_SIGNED', async () => {
    const barista = await prisma.dispatch.findFirstOrThrow({ where: { requisitionId, departmentId: baristaId, status: 'ON_THE_WAY' } });
    await prisma.dispatch.update({ where: { id: barista.id }, data: { status: 'CONFIRMED', countedAt: new Date(), countedById: branchManager.id } });
    await expect(dispatchService.cancel(storeManager as never, barista.id, { reason: 'Vehicle did not leave', pin: PIN, idempotencyKey: `c3-${tag}` })).rejects.toMatchObject({ code: 'DISPATCH_ALREADY_COUNTED' });
    const unsigned = await prisma.dispatch.findFirstOrThrow({ where: { requisitionId, departmentId: kitchenId, status: { in: ['TO_PACK', 'PACKING'] } } });
    await expect(dispatchService.cancel(storeManager as never, unsigned.id, { reason: 'Vehicle did not leave', pin: PIN, idempotencyKey: `c4-${tag}` })).rejects.toMatchObject({ code: 'NOT_SIGNED' });
    await expect(dispatchService.getFile(storeManager as never, unsigned.id)).rejects.toMatchObject({ code: 'NOT_SIGNED' });
  });

  it('after the count the blind rule lifts for the branch side and the Done tab shows the result', async () => {
    const barista = await prisma.dispatch.findFirstOrThrow({ where: { requisitionId, departmentId: baristaId, status: 'CONFIRMED' } });
    const file = await dispatchService.getFile(branchManager as never, barista.id);
    expect(file.sentVisible).toBe(true);
    expect(file.items[0]).toHaveProperty('sentQty');
    // Either Attendant-level signer won the race above, so read as the Store Manager, who sees every dispatch.
    const done = await dispatchService.mine(storeManager as never, { tab: 'done', page: 1, pageSize: 50 } as never);
    expect(done.rows.find((r) => r.id === barista.id)).toMatchObject({ result: 'CONFIRMED' });
    expect(done.rows.some((r) => r.result === 'CANCELLED')).toBe(true);
  });

  it('closeIfComplete: a counted dispatch with no gap closes, and the requisition closes only when every department has', async () => {
    expect(await closeIfComplete(requisitionId)).toBeUndefined();
    expect((await prisma.dispatch.findFirstOrThrow({ where: { requisitionId, departmentId: baristaId, status: { not: 'CANCELLED' } } })).status).toBe('CLOSED');
    expect((await prisma.requisition.findUniqueOrThrow({ where: { id: requisitionId } })).status).toBe('APPROVED'); // Kitchen and Garden are not done
  });

  it('carriers: add, rename, retire, restore; a name already taken (any case) is CARRIER_NAME_TAKEN; the month count follows signed dispatches', async () => {
    await expect(carriersService.add(storeManager as never, { name: `VAN ${tag}`, kind: 'PERSON' })).rejects.toMatchObject({ code: 'CARRIER_NAME_TAKEN', statusCode: 409 });
    const added = await carriersService.add(storeManager as never, { name: `Courier ${tag}`, kind: 'COMPANY' });
    const renamed = await carriersService.update(storeManager as never, added.id, { name: `Courier Co ${tag}` });
    expect(renamed.name).toBe(`Courier Co ${tag}`);
    await expect(carriersService.update(storeManager as never, added.id, { name: `Van ${tag}` })).rejects.toMatchObject({ code: 'CARRIER_NAME_TAKEN' });
    expect((await carriersService.update(storeManager as never, added.id, { active: false })).active).toBe(false);
    expect((await carriersService.update(storeManager as never, added.id, { active: true })).retiredAt).toBeNull();
    const list = await carriersService.list(director as never, { status: 'all' });
    const van = list.carriers.find((c) => c.id === carrierId);
    expect(van?.deliveriesThisMonth).toBeGreaterThanOrEqual(1);
    expect(list.can.manage).toBe(false); // the Director reads only
  });
});
