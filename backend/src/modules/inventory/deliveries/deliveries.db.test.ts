/**
 * Block 2, back end D against a REAL database (no mocks of the data layer). Opt-in:
 *   cd backend && RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/deliveries/deliveries.db.test.ts
 * It builds its own branch, departments, users, items, stock, requisition, carrier and signed dispatches, and removes everything it
 * made (the ledger is append-only, so its cleanup lifts that lock inside one transaction, as the dev seed scripts do). Use only the
 * lane's own database, and run it on its own (one file at a time).
 *
 * Covers: the blind count (V1 to V4: arrivedAt, saves, the two checks, RECOUNT_USED, photos and their limits), the confirm (V5, V6:
 * DISPATCH_IN of the counted quantity, one DSC- per differing line, idempotent replay, the two-signature race, on behalf), findings
 * and their reversal through the ledger door (Q1 to Q5: balanced, linked, money gated), the Audit log sources, and the two jobs.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { hashPin } from '../../../utils/password';
import { allowLedgerEditsInThisTransaction } from '../../../scripts/ledger-dev-bypass';
import { createWaitingNotifier } from '../../../jobs/inventory-delivery-jobs';
import { LOCK_WAIT_MS, takeDbTestLock } from '../_shared/db-test-lock';
import { auditLogService } from '../audit-log/audit-log-service';
import { departmentLinks } from '../departments/department-links';
import { discrepanciesRepository } from '../discrepancies/discrepancies-repository';
import { discrepanciesService } from '../discrepancies/discrepancies-service';
import { deliveriesRepository } from './deliveries-repository';
import { deliveriesService } from './deliveries-service';

vi.mock('./deliveries-notify', async (importOriginal) => {
  const original = await importOriginal<typeof import('./deliveries-notify')>();
  return { ...original, branchNotices: { confirmed: vi.fn(), waiting: vi.fn(), arrived: vi.fn() } };
});
vi.mock('../discrepancies/discrepancies-notify', () => ({ discrepancyNotices: { recorded: vi.fn(), reversed: vi.fn(), reminder: vi.fn() } }));
vi.mock('../dispatch/dispatch-notify', () => ({ dispatchNotices: { signed: vi.fn(), cancelled: vi.fn(), packed: vi.fn() } }));

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

type Role = 'STORE_MANAGER' | 'MANAGER' | 'DIRECTOR' | 'ACCOUNTANT' | 'BARISTA' | 'CHEF';
type A = { id: string; role: Role; siteId: string | null; isDepartmentHead: boolean };

const sentenceKeys = /^(?!gapCount$).*(sent|gap|requested|cost|value|kes)/i;
const keysOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap(keysOf) : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]) : [];

describe.skipIf(!enabled)('Deliveries and Discrepancies against the real database', () => {
  let hubId = '';
  let storeLocationId = '';
  let siteId = '';
  let code = '';
  let milkId = '';
  let creamId = '';
  let carrierId = '';
  const requisitionIds: string[] = [];
  let storeManager: A;
  let director: A;
  let accountant: A;
  let branchManager: A;
  let baristaHead: A;
  let baristaMember: A;
  let pastryMember: A;
  const dept: Record<string, string> = {};
  const userIds: string[] = [];
  const itemIds: string[] = [];
  let seq = 0;

  const sum = async (locationId: string, itemId: string): Promise<string> =>
    ((await prisma.inventoryTransaction.aggregate({ where: { locationId, inventoryItemId: itemId }, _sum: { quantity: true } }))._sum.quantity ?? new Prisma.Decimal(0)).toString();
  const deptLocation = async (departmentId: string): Promise<string> => (await prisma.location.findFirstOrThrow({ where: { siteId, type: 'BRANCH_DEPARTMENT', departmentId } })).id;

  /** A signed, On the way dispatch with the store's DISPATCH_OUT rows already posted (as P5 leaves it). */
  const makeDispatch = async (departmentId: string, lines: Array<{ itemId: string; sent: number; cost: number }>, signedAt = new Date()): Promise<{ id: string; lineIds: string[]; reference: string }> => {
    seq += 1;
    const reference = `DSP-${code}-${String(9000 + seq)}`;
    // One live dispatch per department per requisition (a partial unique index), so each test dispatch gets its own requisition.
    const requisition = await prisma.requisition.create({ data: { siteId, type: 'MORNING', reference: `REQ-${code}-${String(9100 + seq)}`, status: 'APPROVED', openedById: branchManager.id, approvedById: branchManager.id, approvedAt: new Date() } });
    requisitionIds.push(requisition.id);
    const d = await prisma.dispatch.create({
      data: {
        siteId: hubId,
        toSiteId: siteId,
        requisitionId: requisition.id,
        departmentId,
        reference,
        status: 'ON_THE_WAY',
        packedById: storeManager.id,
        packedAt: signedAt,
        signedById: storeManager.id,
        signedAt,
        carrierId,
        sendBatchId: randomUUID(),
        lines: {
          create: lines.map((l) => ({
            inventoryItemId: l.itemId,
            requestedQty: new Prisma.Decimal(l.sent),
            sentQty: new Prisma.Decimal(l.sent),
            packedTick: true,
            unitCostAtDispatch: new Prisma.Decimal(l.cost),
          })),
        },
      },
      include: { lines: { orderBy: { id: 'asc' } } },
    });
    for (const line of d.lines) {
      await prisma.inventoryTransaction.create({
        data: { siteId: hubId, locationId: storeLocationId, inventoryItemId: line.inventoryItemId, type: 'DISPATCH_OUT', quantity: line.sentQty.negated(), unitCost: line.unitCostAtDispatch ?? new Prisma.Decimal(0), userId: storeManager.id, dispatchLineId: line.id },
      });
    }
    return { id: d.id, lineIds: d.lines.map((l) => l.id), reference };
  };
  const lineOf = async (dispatchId: string, itemId: string): Promise<string> => (await prisma.dispatchLine.findFirstOrThrow({ where: { dispatchId, inventoryItemId: itemId } })).id;
  const png = (extra = 0): { buffer: Buffer; originalname: string; size: number } => {
    const buffer = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16 + extra, 1)]);
    return { buffer, originalname: 'box.png', size: buffer.length };
  };
  const failsWith = async (promise: Promise<unknown>, code: string): Promise<void> => {
    await expect(promise).rejects.toMatchObject({ code });
  };

  beforeAll(async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { type: 'CENTRAL_STORE', isHub: true }, select: { id: true, companyId: true } });
    hubId = hub.id;
    storeLocationId = (await prisma.location.findFirstOrThrow({ where: { type: 'CENTRAL_STORE' }, select: { id: true } })).id;
    code = `Z${tag.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, 'Q')}X`.slice(0, 3);
    const branch = await prisma.site.create({ data: { companyId: hub.companyId, type: 'BRANCH', name: `Deliveries test ${tag}`, code, address: 'x', city: 'x', latitude: 0, longitude: 0 } });
    siteId = branch.id;
    await departmentLinks.provisionBranch({ id: siteId, name: 'x', code });
    for (const d of await prisma.department.findMany({ where: { siteId }, select: { id: true, key: true } })) if (d.key) dept[d.key] = d.id;

    const pinHash = await hashPin(PIN);
    const user = async (name: string, role: Role, site: string | null, extra: { departmentId?: string; isDepartmentHead?: boolean } = {}): Promise<A> => {
      const u = await prisma.user.create({ data: { name: `${name} ${tag}`, email: `${name}-${tag}@test.invalid`, passwordHash: 'x', pinHash, role, siteId: site, ...extra } });
      userIds.push(u.id);
      return { id: u.id, role, siteId: site, isDepartmentHead: extra.isDepartmentHead ?? false };
    };
    storeManager = await user('sm', 'STORE_MANAGER', hubId);
    director = await user('dir', 'DIRECTOR', null);
    accountant = await user('acc', 'ACCOUNTANT', hubId);
    branchManager = await user('bm', 'MANAGER', siteId);
    baristaHead = await user('head', 'BARISTA', siteId, { departmentId: dept['BARISTA'], isDepartmentHead: true });
    baristaMember = await user('bar', 'BARISTA', siteId, { departmentId: dept['BARISTA'] });
    pastryMember = await user('pas', 'CHEF', siteId, { departmentId: dept['PASTRY'] });

    const item = async (name: string, cost: number): Promise<string> => {
      const i = await prisma.inventoryItem.create({ data: { siteId: hubId, name: `${name} ${tag}`, type: 'STOCKED', buyUnit: 'kg', usageUnit: 'kg', departmentTags: [], currentCost: new Prisma.Decimal(cost) } });
      itemIds.push(i.id);
      return i.id;
    };
    milkId = await item('Milk', 100);
    creamId = await item('Cream', 250);
    for (const itemId of [milkId, creamId]) {
      await prisma.inventoryTransaction.create({ data: { siteId: hubId, locationId: storeLocationId, inventoryItemId: itemId, type: 'RECEIVE', quantity: new Prisma.Decimal(100), unitCost: new Prisma.Decimal(100), userId: storeManager.id } });
    }
    carrierId = (await prisma.carrier.create({ data: { siteId: hubId, name: `Van ${tag}`, kind: 'VEHICLE' } })).id;
  }, 60_000);

  afterAll(async () => {
    if (!enabled) return;
    await prisma.$transaction(async (tx) => {
      await allowLedgerEditsInThisTransaction(tx);
      const dispatches = await tx.dispatch.findMany({ where: { toSiteId: siteId }, select: { id: true, lines: { select: { id: true } } } });
      const lineIds = dispatches.flatMap((d) => d.lines.map((l) => l.id));
      const dispatchIds = dispatches.map((d) => d.id);
      const discrepancyIds = (await tx.discrepancy.findMany({ where: { toSiteId: siteId }, select: { id: true } })).map((d) => d.id);
      await tx.$executeRaw`UPDATE inventory_transactions SET reverses_transaction_id = NULL WHERE dispatch_line_id = ANY(${lineIds}::text[])`;
      await tx.inventoryTransaction.deleteMany({ where: { OR: [{ dispatchLineId: { in: lineIds } }, { inventoryItemId: { in: itemIds } }] } });
      await tx.discrepancyEvent.deleteMany({ where: { discrepancyId: { in: discrepancyIds } } });
      await tx.discrepancy.deleteMany({ where: { toSiteId: siteId } });
      await tx.dispatchPhoto.deleteMany({ where: { dispatchLineId: { in: lineIds } } });
      await tx.dispatchEvent.deleteMany({ where: { dispatchId: { in: dispatchIds } } });
      await tx.dispatchLine.deleteMany({ where: { dispatchId: { in: dispatchIds } } });
      await tx.dispatch.deleteMany({ where: { toSiteId: siteId } });
      await tx.carrier.deleteMany({ where: { id: carrierId } });
      await tx.requisition.deleteMany({ where: { id: { in: requisitionIds } } });
      await tx.referenceCounter.deleteMany({ where: { siteId } });
      await tx.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
      await tx.location.deleteMany({ where: { siteId } });
      await tx.department.deleteMany({ where: { siteId } });
      await tx.site.deleteMany({ where: { id: siteId } });
    });
    await prisma.$disconnect();
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('the blind count and the confirm', () => {
    let A: { id: string; lineIds: string[]; reference: string };
    let milkLine = '';
    let creamLine = '';
    let gapId = '';
    const KEY = `key-${tag}-1`;

    beforeAll(async () => {
      A = await makeDispatch(dept['BARISTA'] ?? '', [{ itemId: milkId, sent: 10, cost: 100 }, { itemId: creamId, sent: 4, cost: 250 }]);
      milkLine = await lineOf(A.id, milkId);
      creamLine = await lineOf(A.id, creamId);
    });

    it('V1: a member sees their own department only; the Branch Manager sees the branch; the row carries no sent figure', async () => {
      const mine = await deliveriesService.list(baristaMember as never, { tab: 'waiting', page: 1, pageSize: 50 });
      expect(mine.rows.map((r) => r.id)).toContain(A.id);
      expect(mine.rows.every((r) => r.department.id === dept['BARISTA'])).toBe(true);
      expect(mine.rows.find((r) => r.id === A.id)).toMatchObject({ stage: 'ON_THE_WAY', arrivedAt: null, countStarted: false, can: { count: true, confirmOnBehalf: false } });
      expect(keysOf(mine).filter((k) => sentenceKeys.test(k))).toEqual([]);
      const other = await deliveriesService.list(pastryMember as never, { tab: 'waiting', page: 1, pageSize: 50 });
      expect(other.rows.map((r) => r.id)).not.toContain(A.id);
      const bm = await deliveriesService.list(branchManager as never, { tab: 'waiting', page: 1, pageSize: 50 });
      expect(bm.rows.map((r) => r.id)).toContain(A.id);
      expect(bm.rows.find((r) => r.id === A.id)?.can).toEqual({ count: true, confirmOnBehalf: true });
    });

    it('a hub user or a person with no department cannot count at all', async () => {
      await expect(deliveriesService.list(storeManager as never, { tab: 'waiting', page: 1, pageSize: 50 })).rejects.toMatchObject({ statusCode: 403 });
      await failsWith(deliveriesService.getCount(pastryMember as never, A.id), 'NOT_YOUR_DEPARTMENT');
    });

    it('V2: the Branch Manager looking in does not stamp arrivedAt; the first read by the department does, once', async () => {
      const bmView = await deliveriesService.getCount(branchManager as never, A.id);
      expect(bmView.arrivedAt).toBeNull();
      const first = await deliveriesService.getCount(baristaMember as never, A.id);
      expect(first.arrivedAt).not.toBeNull();
      const stamped = (await prisma.dispatch.findUniqueOrThrow({ where: { id: A.id } })).arrivedAt;
      const again = await deliveriesService.getCount(baristaHead as never, A.id);
      expect(again.arrivedAt).toBe(stamped?.toISOString());
      expect(first.lines.every((l) => l.countedQty === null && l.state === 'NOT_COUNTED')).toBe(true);
      expect(keysOf(first).filter((k) => sentenceKeys.test(k))).toEqual([]);
    });

    it('V7: before the department counts, its member reads the file with no sent figure, gap, total or money; another department is refused', async () => {
      const file = await deliveriesService.file(baristaMember as never, A.id);
      expect(file).toMatchObject({ id: A.id, status: 'ON_THE_WAY', sentVisible: false, shortCount: 0, siblings: [], can: { print: false, cancel: false, recordFinding: false, confirmForDepartment: false } });
      expect(file.nextStep.facts.gapLineCount).toBe(0);
      const keys = keysOf(file);
      expect(keys.filter((k) => /^(sentQty|gapQty|valueKes|unitCostKes|lossValueKes)$/.test(k))).toEqual([]);
      expect(file.items.every((i) => i.countedQty === null)).toBe(true);
      await failsWith(deliveriesService.file(pastryMember as never, A.id), 'NOT_YOUR_DEPARTMENT');
      await expect(deliveriesService.file(storeManager as never, A.id)).rejects.toMatchObject({ statusCode: 403 });
      // the Branch Manager reads any department of the branch, still blind, and may confirm for the department
      const bm = await deliveriesService.file(branchManager as never, A.id);
      expect(bm.sentVisible).toBe(false);
      expect(bm.can.confirmForDepartment).toBe(true);
    });

    it('V3: a save never says whether it matches; the check flags a difference once and says which way, never the size', async () => {
      const saved = await deliveriesService.saveCount(baristaMember as never, A.id, { counts: [{ lineId: milkLine, countedQty: '8' }, { lineId: creamLine, countedQty: '4' }] });
      expect(saved.lines.map((l) => [l.state, l.direction])).toEqual([['COUNTED', null], ['COUNTED', null]]);
      expect(JSON.stringify(saved)).not.toContain('"10"');
      const first = await deliveriesService.check(baristaMember as never, A.id);
      expect(first.differing).toEqual([{ lineId: milkLine, itemName: `Milk ${tag}`, countedQty: '8', direction: 'SHORT', state: 'COUNT_AGAIN' }]);
      expect(first.final).toBe(false);
      expect(JSON.stringify(first)).not.toMatch(/"(10|sent|gap)/);
      await failsWith(deliveriesService.confirmPreview(baristaMember as never, A.id), 'COUNT_AGAIN_PENDING');
    });

    it('a matching line is final at once (RECOUNT_USED if it is saved over); the flagged line can be counted again', async () => {
      await failsWith(deliveriesService.saveCount(baristaMember as never, A.id, { counts: [{ lineId: creamLine, countedQty: '5' }] }), 'RECOUNT_USED');
      const again = await deliveriesService.saveCount(baristaMember as never, A.id, { counts: [{ lineId: milkLine, countedQty: '8' }] });
      expect(again.lines.find((l) => l.lineId === milkLine)?.state).toBe('COUNT_AGAIN');
    });

    it('the second check makes the difference final; further saves are refused; reasons only on a final difference', async () => {
      await failsWith(deliveriesService.setReason(baristaMember as never, A.id, milkLine, { reason: 'DAMAGED' }), 'LINE_NOT_DIFFERENT');
      const second = await deliveriesService.check(baristaMember as never, A.id);
      expect(second.final).toBe(true);
      expect(second.reasonsComplete).toBe(false);
      expect(second.differing[0]).toMatchObject({ state: 'SHORT', direction: 'SHORT' });
      await failsWith(deliveriesService.saveCount(baristaMember as never, A.id, { counts: [{ lineId: milkLine, countedQty: '10' }] }), 'RECOUNT_USED');
      await failsWith(deliveriesService.setReason(baristaMember as never, A.id, creamLine, { reason: 'DAMAGED' }), 'LINE_NOT_DIFFERENT');
      await failsWith(deliveriesService.confirm(baristaMember as never, A.id, { pin: PIN, idempotencyKey: `${KEY}-early` }), 'REASON_REQUIRED');
    });

    it('V4 photos: three per line, 5 MB, real image bytes, delete, and an authenticated read for the department only', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 3; i += 1) ids.push((await deliveriesService.uploadPhoto(baristaMember as never, A.id, { lineId: milkLine }, png(i))).photo.id);
      await failsWith(deliveriesService.uploadPhoto(baristaMember as never, A.id, { lineId: milkLine }, png(9)), 'TOO_MANY_PHOTOS');
      await failsWith(deliveriesService.uploadPhoto(baristaMember as never, A.id, { lineId: milkLine }, { buffer: Buffer.from('not an image at all'), originalname: 'x.png', size: 19 }), 'PHOTO_TYPE_NOT_ALLOWED');
      await failsWith(deliveriesService.uploadPhoto(baristaMember as never, A.id, { lineId: milkLine }, { ...png(), size: 6 * 1024 * 1024 }), 'PHOTO_TOO_LARGE');
      await failsWith(deliveriesService.uploadPhoto(baristaMember as never, A.id, { lineId: creamLine }, png()), 'LINE_NOT_DIFFERENT');
      const read = await deliveriesService.readPhoto(baristaHead as never, ids[0] ?? '');
      expect(read.contentType).toBe('image/png');
      await expect(deliveriesService.readPhoto(pastryMember as never, ids[0] ?? '')).rejects.toMatchObject({ statusCode: 404 });
      expect((await deliveriesService.readPhoto(storeManager as never, ids[0] ?? '')).body.length).toBeGreaterThan(0);
      const left = await deliveriesService.deletePhoto(baristaMember as never, A.id, ids[2] ?? '');
      expect(left.photos.map((p) => p.id)).toEqual(ids.slice(0, 2));
      await expect(deliveriesService.deletePhoto(pastryMember as never, A.id, ids[0] ?? '')).rejects.toMatchObject({ code: 'NOT_YOUR_DEPARTMENT' });
    });

    it('V5: the summary is where the sent figure first appears', async () => {
      await deliveriesService.setReason(baristaMember as never, A.id, milkLine, { reason: 'NOT_IN_THE_BOX' });
      const preview = await deliveriesService.confirmPreview(baristaMember as never, A.id);
      expect(preview.canConfirm).toBe(true);
      expect(preview.differingLines).toMatchObject([{ itemName: `Milk ${tag}`, countedQty: '8', sentQty: '10', gapQty: '-2', direction: 'SHORT', reason: 'NOT_IN_THE_BOX', photoCount: 2 }]);
      expect(preview.matchingLines).toHaveLength(1);
    });

    it('V6: a wrong PIN is refused and nothing is written; ON_BEHALF_NOT_ALLOWED for a member', async () => {
      await failsWith(deliveriesService.confirm(baristaMember as never, A.id, { pin: '0000', idempotencyKey: `${KEY}-bad` }), 'INVALID_PIN');
      await failsWith(deliveriesService.confirm(baristaMember as never, A.id, { pin: PIN, onBehalf: true, idempotencyKey: `${KEY}-ob` }), 'ON_BEHALF_NOT_ALLOWED');
      expect((await prisma.dispatch.findUniqueOrThrow({ where: { id: A.id } })).status).toBe('ON_THE_WAY');
      expect(await prisma.discrepancy.count({ where: { dispatchId: A.id } })).toBe(0);
    });

    it('V6: confirms once: DISPATCH_IN of the COUNTED quantity at the department, the gap held, one DSC-, balanced and linked', async () => {
      const result = await deliveriesService.confirm(baristaMember as never, A.id, { pin: PIN, idempotencyKey: KEY });
      expect(result).toMatchObject({ status: 'CONFIRMED', lineCount: 2, matchedCount: 1, replayed: false, onBehalfOfDepartment: null });
      expect(result.discrepancies).toMatchObject([{ reference: `DSC-${code}-0001`, itemName: `Milk ${tag}`, gapQty: '-2' }]);
      gapId = result.discrepancies[0]?.id ?? '';
      const location = await deptLocation(dept['BARISTA'] ?? '');
      expect(await sum(location, milkId)).toBe('8'); // counted, not sent
      expect(await sum(location, creamId)).toBe('4');
      // the store gave 10 and 4; the department holds 8 and 4; the 2 missing milk are held as unaccounted (in neither)
      expect(await sum(storeLocationId, milkId)).toBe('90');
      const ins = await prisma.inventoryTransaction.findMany({ where: { dispatchLineId: { in: A.lineIds }, type: 'DISPATCH_IN' } });
      expect(ins).toHaveLength(2);
      expect(ins.every((r) => r.siteId === siteId && r.locationId === location)).toBe(true);
      const row = await prisma.dispatch.findUniqueOrThrow({ where: { id: A.id } });
      expect(row).toMatchObject({ status: 'CONFIRMED', countedById: baristaMember.id, onBehalf: false });
    });

    it('V6: a repeat of the same key returns the first result and writes nothing; a second member is ALREADY_CONFIRMED', async () => {
      const again = await deliveriesService.confirm(baristaMember as never, A.id, { pin: PIN, idempotencyKey: KEY });
      expect(again).toMatchObject({ replayed: true, discrepancies: [{ id: gapId }] });
      expect(await prisma.inventoryTransaction.count({ where: { dispatchLineId: { in: A.lineIds }, type: 'DISPATCH_IN' } })).toBe(2);
      expect(await prisma.discrepancy.count({ where: { dispatchId: A.id } })).toBe(1);
      await failsWith(deliveriesService.confirm(baristaHead as never, A.id, { pin: PIN, idempotencyKey: `${KEY}-head` }), 'ALREADY_CONFIRMED');
      await failsWith(deliveriesService.saveCount(baristaMember as never, A.id, { counts: [{ lineId: milkLine, countedQty: '9' }] }), 'ALREADY_CONFIRMED');
      await failsWith(deliveriesService.getCount(baristaMember as never, A.id), 'NOT_ON_THE_WAY');
    });

    it('V7 after the count: the member now sees the sent figure and the gap, with the DSC- number and still no money', async () => {
      const file = await deliveriesService.file(baristaMember as never, A.id);
      expect(file).toMatchObject({ status: 'CONFIRMED', sentVisible: true });
      expect(file.nextStep.facts.gapLineCount).toBe(1);
      const milk = file.items.find((i) => i.itemName === `Milk ${tag}`);
      expect(milk).toMatchObject({ sentQty: '10', countedQty: '8', gapQty: '-2', countReason: 'NOT_IN_THE_BOX', discrepancy: { reference: `DSC-${code}-0001` } });
      expect(milk?.photos).toHaveLength(2);
      expect(keysOf(file).filter((k) => /valueKes|unitCostKes|lossValueKes/.test(k))).toEqual([]);
      await failsWith(deliveriesService.file(pastryMember as never, A.id), 'NOT_YOUR_DEPARTMENT');
    });

    it('V1 history: the result chip says the gap is open, with the confirmer\'s title', async () => {
      const past = await deliveriesService.list(baristaHead as never, { tab: 'past', page: 1, pageSize: 50 });
      expect(past.rows.find((r) => r.id === A.id)).toMatchObject({ result: 'GAP_OPEN', gapCount: 1, confirmedByTitle: 'Barista', stage: 'GAP_HELD' });
      const filtered = await deliveriesService.list(baristaHead as never, { tab: 'past', result: 'MATCHED', page: 1, pageSize: 50 });
      expect(filtered.rows.map((r) => r.id)).not.toContain(A.id);
    });

    // ----------------------------------------------------------------------------------------------------------------------------
    describe('the discrepancy: list, file, finding, reversal', () => {
      const FKEY = `fkey-${tag}`;
      const rkey = (n: number) => `rkey-${tag}-${n}`;

      it('Q1/Q2: the Store Manager and the Branch Manager read it; a head reads their own department; the sent figure is shown here', async () => {
        const list = await discrepanciesService.list(storeManager as never, { tab: 'open', page: 1, pageSize: 50 });
        expect(list.rows.map((r) => r.id)).toContain(gapId);
        expect(list.counts.open).toBeGreaterThanOrEqual(1);
        expect(list.branches?.length).toBeGreaterThanOrEqual(1);
        const bm = await discrepanciesService.list(branchManager as never, { tab: 'open', page: 1, pageSize: 50 });
        expect(bm.rows.every((r) => r.branch.id === siteId)).toBe(true);
        expect(bm.branches).toBeUndefined();
        const head = await discrepanciesService.list(baristaHead as never, { tab: 'open', page: 1, pageSize: 50 });
        expect(head.rows.map((r) => r.id)).toContain(gapId);
        await expect(discrepanciesService.list(baristaMember as never, { tab: 'open', page: 1, pageSize: 50 })).rejects.toMatchObject({ statusCode: 403 });
        const search = await discrepanciesService.list(storeManager as never, { tab: 'open', q: `Milk ${tag}`, page: 1, pageSize: 50 });
        expect(search.rows.map((r) => r.id)).toEqual([gapId]);
        const file = await discrepanciesService.getFile(storeManager as never, gapId);
        expect(file).toMatchObject({ status: 'OPEN', sentQty: '10', countedQty: '8', gapQty: '-2', direction: 'SHORT', countedTwice: true, branchReason: 'NOT_IN_THE_BOX', valueKes: '200.00', can: { recordFinding: true, reverse: false } });
        expect(file.allowedFindings).toEqual(['PACKED_SHORT', 'LOST_OR_DAMAGED', 'BRANCH_COUNTED_WRONG', 'CANT_TELL']);
        expect(file.photos).toHaveLength(2);
        expect(file.events.map((e) => e.type)).toEqual(['DISCREPANCY_OPENED']);
      });

      it('money follows requisitions.see_value: the Accountant sees the value, a department head does not (absent, not null)', async () => {
        expect((await discrepanciesService.getFile(accountant as never, gapId)).valueKes).toBe('200.00');
        const headFile = await discrepanciesService.getFile(baristaHead as never, gapId);
        expect('valueKes' in headFile).toBe(false);
        expect(headFile.can).toEqual({ recordFinding: false, reverse: false });
      });

      it('Q3/Q4: only the allowed findings; a wrong PIN writes nothing; the preview says what it will do', async () => {
        await failsWith(discrepanciesService.findingPreview(storeManager as never, gapId, 'PACKED_MORE'), 'FINDING_NOT_ALLOWED');
        await failsWith(discrepanciesService.recordFinding(storeManager as never, gapId, { finding: 'PACKED_MORE', pin: PIN, idempotencyKey: FKEY }), 'FINDING_NOT_ALLOWED');
        await failsWith(discrepanciesService.recordFinding(storeManager as never, gapId, { finding: 'LOST_OR_DAMAGED', pin: '0000', idempotencyKey: FKEY }), 'INVALID_PIN');
        await expect(discrepanciesService.recordFinding(director as never, gapId, { finding: 'CANT_TELL', pin: PIN, idempotencyKey: FKEY })).rejects.toMatchObject({ statusCode: 403 });
        const preview = await discrepanciesService.findingPreview(storeManager as never, gapId, 'PACKED_SHORT');
        expect(preview).toMatchObject({ against: 'STORE', lossKind: 'PACKING_ERROR', effects: [{ place: 'CENTRAL_STORE', quantity: '2' }] });
        expect('lossValueKes' in preview).toBe(false);
        const loss = await discrepanciesService.findingPreview(storeManager as never, gapId, 'LOST_OR_DAMAGED');
        expect(loss).toMatchObject({ againstParty: `Van ${tag}`, lossValueKes: '200.00', effects: [{ place: 'WRITTEN_OFF', quantity: '-2' }] });
        expect(await prisma.discrepancy.count({ where: { id: gapId, status: 'OPEN' } })).toBe(1);
      });

      it('Q4: Lost or damaged writes the loss off at the frozen cost; the Accountant sees the value, the closed dispatch follows', async () => {
        const before = await prisma.inventoryTransaction.count({ where: { dispatchLineId: milkLine } });
        const result = await discrepanciesService.recordFinding(storeManager as never, gapId, { finding: 'LOST_OR_DAMAGED', note: 'Van spill', pin: PIN, idempotencyKey: FKEY });
        expect(result).toMatchObject({ status: 'RECORDED', ledgerEntries: 0, replayed: false, finding: { finding: 'LOST_OR_DAMAGED', against: 'CARRIER', lossKind: 'LOSS', lossValueKes: '200.00' } });
        expect(await prisma.inventoryTransaction.count({ where: { dispatchLineId: milkLine } })).toBe(before);
        expect((await prisma.discrepancy.findUniqueOrThrow({ where: { id: gapId } })).lossValue?.toString()).toBe('200');
        expect((await prisma.dispatch.findUniqueOrThrow({ where: { id: A.id } })).status).toBe('CLOSED');
        await failsWith(discrepanciesService.recordFinding(storeManager as never, gapId, { finding: 'CANT_TELL', pin: PIN, idempotencyKey: `${FKEY}-2` }), 'FINDING_ALREADY_RECORDED');
        const replay = await discrepanciesService.recordFinding(storeManager as never, gapId, { finding: 'LOST_OR_DAMAGED', note: 'Van spill', pin: PIN, idempotencyKey: FKEY });
        expect(replay.replayed).toBe(true);
        const acc = await discrepanciesService.getFile(accountant as never, gapId);
        expect(acc.finding?.lossValueKes).toBe('200.00');
        const head = await discrepanciesService.getFile(baristaHead as never, gapId);
        expect(head.finding && 'lossValueKes' in head.finding).toBe(false);
        const settled = await discrepanciesService.list(storeManager as never, { tab: 'settled', page: 1, pageSize: 50 });
        expect(settled.rows.find((r) => r.id === gapId)?.finding?.finding).toBe('LOST_OR_DAMAGED');
        const dsp = await deliveriesService.list(baristaHead as never, { tab: 'past', page: 1, pageSize: 50 });
        expect(dsp.rows.find((r) => r.id === A.id)).toMatchObject({ result: 'GAP_RESOLVED', stage: 'CLOSED' });
      });

      it('Q5: reversing needs a recorded finding, a reason and a PIN; the gap is held again and the dispatch opens', async () => {
        await failsWith(discrepanciesService.reverse(storeManager as never, gapId, { reason: 'It turned up', pin: '0000', idempotencyKey: rkey(0) }), 'INVALID_PIN');
        const result = await discrepanciesService.reverse(storeManager as never, gapId, { reason: 'The milk turned up at the branch', pin: PIN, idempotencyKey: rkey(1) });
        expect(result).toMatchObject({ status: 'OPEN', replayed: false, reversal: { reason: 'The milk turned up at the branch' } });
        const row = await prisma.discrepancy.findUniqueOrThrow({ where: { id: gapId } });
        expect(row).toMatchObject({ status: 'OPEN', finding: null, lossValue: null, reverseReason: 'The milk turned up at the branch' });
        expect((await prisma.dispatch.findUniqueOrThrow({ where: { id: A.id } })).status).toBe('CONFIRMED');
        await failsWith(discrepanciesService.reverse(storeManager as never, gapId, { reason: 'Again please', pin: PIN, idempotencyKey: rkey(2) }), 'FINDING_NOT_REVERSIBLE');
        expect((await discrepanciesService.reverse(storeManager as never, gapId, { reason: 'The milk turned up at the branch', pin: PIN, idempotencyKey: rkey(1) })).replayed).toBe(true);
        const open = await discrepanciesService.list(storeManager as never, { tab: 'open', page: 1, pageSize: 50 });
        expect(open.rows.map((r) => r.id)).toContain(gapId);
        const file = await discrepanciesService.getFile(storeManager as never, gapId);
        expect(file).toMatchObject({ status: 'OPEN', finding: null, reversal: { reason: 'The milk turned up at the branch' }, can: { recordFinding: true, reverse: false } });
        expect(file.allowedFindings).toHaveLength(4);
        expect(file.events.map((e) => e.type)).toEqual(['DISCREPANCY_OPENED', 'FINDING_RECORDED', 'FINDING_REVERSED']);
      });

      it('Q4 after a reversal: Branch counted wrong corrects the department up, linked to the dispatch line; reversing it puts it back, balanced', async () => {
        const location = await deptLocation(dept['BARISTA'] ?? '');
        await discrepanciesService.recordFinding(storeManager as never, gapId, { finding: 'BRANCH_COUNTED_WRONG', pin: PIN, idempotencyKey: `${FKEY}-3` });
        expect(await sum(location, milkId)).toBe('10'); // all 10 arrived
        const adj = await prisma.inventoryTransaction.findMany({ where: { dispatchLineId: milkLine, type: 'ADJUSTMENT' } });
        expect(adj).toHaveLength(1);
        expect(adj[0]).toMatchObject({ siteId, locationId: location });
        expect(adj[0]?.reference).toMatch(/^ADJ-/);
        const reversal = await discrepanciesService.reverse(storeManager as never, gapId, { reason: 'Counted again: only 8', pin: PIN, idempotencyKey: rkey(3) });
        expect(reversal.ledgerEntries).toBe(1);
        expect(await sum(location, milkId)).toBe('8');
        const rows = await prisma.inventoryTransaction.findMany({ where: { dispatchLineId: milkLine, type: 'ADJUSTMENT' } });
        expect(rows).toHaveLength(2);
        expect(rows.reduce((s, r) => s.add(r.quantity), new Prisma.Decimal(0)).toString()).toBe('0');
        expect(rows.find((r) => r.reversesTransactionId !== null)?.reversesTransactionId).toBe(adj[0]?.id);
      });

      it('Q4: Packed short at the store returns the 2 to the store; the gap is settled and nothing is a loss', async () => {
        const storeBefore = await sum(storeLocationId, milkId);
        const result = await discrepanciesService.recordFinding(storeManager as never, gapId, { finding: 'PACKED_SHORT', pin: PIN, idempotencyKey: `${FKEY}-4` });
        expect(result.finding).toMatchObject({ against: 'STORE', lossKind: 'PACKING_ERROR' });
        expect('lossValueKes' in result.finding).toBe(false);
        expect(new Prisma.Decimal(await sum(storeLocationId, milkId)).minus(storeBefore).toString()).toBe('2');
        expect((await prisma.discrepancy.findUniqueOrThrow({ where: { id: gapId } })).lossValue).toBeNull();
      });

      it('the Audit log has a Dispatch and a Discrepancies area with the sentences, and no PIN', async () => {
        const disp = await auditLogService.list(director as never, { area: 'DISPATCH', branchId: siteId, page: 1, perPage: 50 } as never);
        expect(disp.entries.map((e) => e.what).join(' | ')).toContain(`Barista counted ${A.reference}`);
        const dsc = await auditLogService.list(director as never, { area: 'DISCREPANCIES', branchId: siteId, page: 1, perPage: 50 } as never);
        const text = dsc.entries.map((e) => e.what).join(' | ');
        expect(text).toContain('Recorded a finding on');
        expect(text).toContain('Reversed the finding on');
        expect(text).toContain('Opened');
        expect(dsc.entries.find((e) => e.what.startsWith('Reversed'))?.reason).toBeTruthy();
        expect(JSON.stringify(dsc)).not.toContain(PIN);
        const bm = await auditLogService.list(branchManager as never, { area: 'DISCREPANCIES', page: 1, perPage: 50 } as never);
        expect(bm.entries.length).toBeGreaterThan(0);
      });
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('on behalf, the race and the all-matched case', () => {
    it('the Branch Manager confirms for a department that never opened it; arrivedAt stays empty; a clean delivery closes', async () => {
      const B = await makeDispatch(dept['PASTRY'] ?? '', [{ itemId: milkId, sent: 3, cost: 100 }]);
      const lineId = await lineOf(B.id, milkId);
      await deliveriesService.saveCount(branchManager as never, B.id, { counts: [{ lineId, countedQty: '3' }] });
      const check = await deliveriesService.check(branchManager as never, B.id);
      expect(check.differing).toEqual([]);
      expect(check.view.onBehalfOfDepartment?.id).toBe(dept['PASTRY']);
      const result = await deliveriesService.confirm(branchManager as never, B.id, { pin: PIN, onBehalf: true, idempotencyKey: `ob-${tag}` });
      expect(result).toMatchObject({ status: 'CLOSED', arrivedAt: null, matchedCount: 1, discrepancies: [], onBehalfOfDepartment: { id: dept['PASTRY'] } });
      expect(await prisma.dispatchEvent.count({ where: { dispatchId: B.id, type: 'DELIVERY_CONFIRMED_ON_BEHALF' } })).toBe(1);
      expect((await prisma.dispatch.findUniqueOrThrow({ where: { id: B.id } }))).toMatchObject({ onBehalf: true, status: 'CLOSED' });
      expect(await sum(await deptLocation(dept['PASTRY'] ?? ''), milkId)).toBe('3');
      const past = await deliveriesService.list(pastryMember as never, { tab: 'past', page: 1, pageSize: 50 });
      expect(past.rows.find((r) => r.id === B.id)).toMatchObject({ result: 'MATCHED', gapCount: 0, confirmedByTitle: 'Branch Manager' });
    });

    it('two members signing at once: exactly one wins, the other gets ALREADY_CONFIRMED, and the stock is posted once', async () => {
      const C = await makeDispatch(dept['BARISTA'] ?? '', [{ itemId: creamId, sent: 2, cost: 250 }]);
      const lineId = await lineOf(C.id, creamId);
      await deliveriesService.saveCount(baristaMember as never, C.id, { counts: [{ lineId, countedQty: '2' }] });
      await deliveriesService.check(baristaMember as never, C.id);
      const before = await sum(await deptLocation(dept['BARISTA'] ?? ''), creamId);
      const results = await Promise.allSettled([
        deliveriesService.confirm(baristaMember as never, C.id, { pin: PIN, idempotencyKey: `race-a-${tag}` }),
        deliveriesService.confirm(baristaHead as never, C.id, { pin: PIN, idempotencyKey: `race-b-${tag}` }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const lost = results.find((r) => r.status === 'rejected');
      expect(lost && lost.status === 'rejected' ? (lost.reason as { code?: string }).code : '').toBe('ALREADY_CONFIRMED');
      expect(await prisma.inventoryTransaction.count({ where: { dispatchLineId: lineId, type: 'DISPATCH_IN' } })).toBe(1);
      expect(new Prisma.Decimal(await sum(await deptLocation(dept['BARISTA'] ?? ''), creamId)).minus(before).toString()).toBe('2');
    });

    it('a cancelled dispatch tells the department on its next write (DISPATCH_CANCELLED)', async () => {
      const E = await makeDispatch(dept['SERVICE'] ?? '', [{ itemId: milkId, sent: 1, cost: 100 }]);
      await prisma.dispatch.update({ where: { id: E.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: storeManager.id, cancelReason: 'Vehicle did not leave' } });
      const serviceMember = { ...baristaMember, id: (await prisma.user.create({ data: { name: `svc ${tag}`, email: `svc-${tag}@test.invalid`, passwordHash: 'x', pinHash: await hashPin(PIN), role: 'CHEF', siteId, departmentId: dept['SERVICE'] } })).id };
      userIds.push(serviceMember.id);
      await failsWith(deliveriesService.getCount(serviceMember as never, E.id), 'DISPATCH_CANCELLED');
      await failsWith(deliveriesService.saveCount(serviceMember as never, E.id, { counts: [{ lineId: await lineOf(E.id, milkId), countedQty: '1' }] }), 'DISPATCH_CANCELLED');
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('the jobs', () => {
    it('Waiting for the branch: a delivery signed 3 hours ago is claimed once and told once, never again; a fresh one is left alone', async () => {
      const old = new Date(Date.now() - 3 * 3_600_000);
      const W = await makeDispatch(dept['KITCHEN'] ?? '', [{ itemId: milkId, sent: 1, cost: 100 }], old);
      const fresh = await makeDispatch(dept['PASTRY'] ?? '', [{ itemId: milkId, sent: 1, cost: 100 }], new Date());
      const told: string[] = [];
      const run = createWaitingNotifier({
        hubId: async () => hubId,
        findDue: (hub, cutoff) => deliveriesRepository.findWaitingCandidates(hub, cutoff),
        claim: (id, hub, at, cutoff) => deliveriesRepository.claimWaiting(id, hub, at, cutoff),
        notify: async (w) => void told.push(w.dispatchId),
      });
      await run();
      await run();
      await Promise.all([run(), run()]);
      expect(told.filter((id) => id === W.id)).toHaveLength(1);
      expect(told).not.toContain(fresh.id);
      expect((await prisma.dispatch.findUniqueOrThrow({ where: { id: W.id } })).waitingNotifiedAt).not.toBeNull();
    });

    it('The 24-hour reminder: not before 24 hours, once at 24, not again that day, again the next day', async () => {
      const opened = new Date(Date.now() - 25 * 3_600_000);
      const R = await makeDispatch(dept['KITCHEN'] ?? '', [{ itemId: creamId, sent: 5, cost: 250 }], opened);
      const lineId = await lineOf(R.id, creamId);
      const gap = await prisma.discrepancy.create({ data: { siteId: hubId, toSiteId: siteId, dispatchId: R.id, dispatchLineId: lineId, reference: `DSC-${code}-9999`, gapQty: new Prisma.Decimal(-1), createdAt: opened } });
      const stamp = async (): Promise<number | null> => ((await prisma.discrepancy.findUniqueOrThrow({ where: { id: gap.id } })).reminderSentAt?.getTime() ?? null);
      const { discrepancyNotices } = await import('../discrepancies/discrepancies-notify');
      const reminder = vi.mocked(discrepancyNotices.reminder);
      const mine = (): number => reminder.mock.calls.filter(([c]) => c.discrepancyId === gap.id).length;
      const now = new Date();

      await discrepanciesService.sendReminders(new Date(opened.getTime() + 23 * 3_600_000)); // 23 hours old: nothing
      expect(mine()).toBe(0);
      await discrepanciesService.sendReminders(now); // 25 hours old: the first reminder
      expect(mine()).toBe(1);
      expect(await stamp()).toBe(now.getTime());
      await Promise.all([discrepanciesService.sendReminders(new Date(now.getTime() + 1000)), discrepanciesService.sendReminders(new Date(now.getTime() + 2000))]);
      expect(mine()).toBe(1); // overlapping runs and reruns the same day send nothing
      await discrepanciesService.sendReminders(new Date(now.getTime() + 25 * 3_600_000)); // the next day: again
      expect(mine()).toBe(2);
      expect(reminder.mock.calls.find(([c]) => c.discrepancyId === gap.id)?.[0]).toMatchObject({ hubId, reference: `DSC-${code}-9999` });
      expect(discrepanciesRepository).toBeDefined();
    });
  });
});
