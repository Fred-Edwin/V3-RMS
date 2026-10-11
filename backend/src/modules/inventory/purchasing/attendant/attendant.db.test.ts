/**
 * The Store Attendant's Purchasing phone against a REAL database (no mocks of the data layer). Opt-in:
 *   cd backend && RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/purchasing/attendant/attendant.db.test.ts
 * It builds its own users, suppliers, items, stock, restock levels, carriers and orders on the lane's hub, and removes everything it made
 * (the ledger is append-only, so its cleanup lifts that lock inside one transaction, as the dev seed scripts do). It restores the hub's
 * LPO and PAY counters to what they were. Use only the lane's own database, and run it on its own (one file at a time).
 *
 * Covers: the new queries (closed orders by date and status and search, the header counts, item, supplier and order search, the supplier
 * page, restock level rows, notice orders and read marks, orders sent and due on a day), "who is getting it" (carrier and staff lookups, the
 * guarded write, the picker), withdraw (the supplier's one open slot is free again), remind (the throttle reads the audit row), `closedAt`
 * on the move to CLOSED and its clearing on a reversal, the restock-list review and send (one order per supplier, a taken slot reported),
 * and the Home, My orders, History and Notifications services over the real rows.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { hashPin } from '../../../../utils/password';
import { allowLedgerEditsInThisTransaction } from '../../../../scripts/ledger-dev-bypass';
import { LOCK_WAIT_MS, takeDbTestLock } from '../../_shared/db-test-lock';
import { payablesService } from '../payables/payables-service';
import { ordersRepository } from '../orders/orders-repository';
import { ordersService } from '../orders/orders-service';
import { restockListService } from '../restock-list/restock-list-service';
import { attendantRepository } from './attendant-repository';
import { attendantService } from './attendant-service';

vi.mock('../_shared/purchasing-notify', () => ({
  purchasingNotices: { submitted: vi.fn(), approved: vi.fn(), returned: vi.fn(), reminder: vi.fn(), closed: vi.fn(), dueToday: vi.fn(), overdue: vi.fn() },
}));
import { purchasingNotices } from '../_shared/purchasing-notify';

const enabled = process.env['RUN_DB_TESTS'] === '1';
const tag = randomUUID().slice(0, 8);
const PIN = '4821';
// Thu 8 Oct 2026, 12:00 Nairobi.
const NOW = new Date('2026-10-08T09:00:00Z');
const D = (v: number | string) => new Prisma.Decimal(v);

let releaseDbLock: () => Promise<void> = async () => undefined;
beforeAll(async () => {
  if (enabled) releaseDbLock = await takeDbTestLock();
}, LOCK_WAIT_MS);
afterAll(async () => {
  await releaseDbLock();
});

type A = { id: string; role: 'STORE_MANAGER' | 'STORE_ATTENDANT' | 'ACCOUNTANT'; siteId: string };

describe.skipIf(!enabled)('Purchasing: the Store Attendant phone against the real database', () => {
  let hubId = '';
  let storeLocationId = '';
  let sm: A;
  let att: A;
  let att2: A;
  let acc: A;
  let goneId = '';
  let carrierId = '';
  let retiredCarrierId = '';
  const userIds: string[] = [];
  const supplierIds: string[] = [];
  const itemIds: string[] = [];
  const counterBefore = new Map<string, number | null>();
  const sup: Record<string, string> = {};
  const item: Record<string, string> = {};
  const ord: Record<string, string> = {};
  let seq = 0;

  const mkSupplier = async (key: string, name: string): Promise<string> => {
    seq += 1;
    const s = await prisma.supplier.create({
      data: {
        siteId: hubId, code: `SUP-T${tag}-${seq}`, name: `${name} ${tag}`, address: 'Nyeri', defaultPaymentTerms: 'INVOICE_TO_FOLLOW', paymentDays: 14,
        contacts: { create: { siteId: hubId, name: `Contact ${key}`, phone: `0700${seq}`, whatsapp: `0711${seq}`, isPrimary: true } },
      },
    });
    supplierIds.push(s.id);
    sup[key] = s.id;
    return s.id;
  };
  const mkItem = async (key: string, name: string, level: number | null, onHand: number, unit = 'kg'): Promise<string> => {
    const i = await prisma.inventoryItem.create({ data: { siteId: hubId, name: `${name} ${tag}`, type: 'STOCKED', buyUnit: unit, usageUnit: unit, departmentTags: [], currentCost: D(10) } });
    itemIds.push(i.id);
    item[key] = i.id;
    if (level !== null) await prisma.restockLevel.create({ data: { siteId: hubId, locationId: storeLocationId, inventoryItemId: i.id, level: D(level), setById: sm.id } });
    if (onHand !== 0) await prisma.inventoryTransaction.create({ data: { siteId: hubId, locationId: storeLocationId, inventoryItemId: i.id, type: 'RECEIVE', quantity: D(onHand), unitCost: D(10), userId: sm.id } });
    return i.id;
  };
  const sells = (supplierKey: string, itemKey: string, price: number | null, preferred = false) =>
    prisma.supplierItem.create({ data: { siteId: hubId, supplierId: sup[supplierKey] ?? '', inventoryItemId: item[itemKey] ?? '', lastPrice: price === null ? null : D(price), isPreferred: preferred } });

  /** An order written straight to the table (so the hub's counters are not used), with one line per item named. */
  const mkOrder = async (
    key: string,
    over: { supplier: string; status: Prisma.PurchaseOrderCreateInput['status']; raisedBy?: A; items?: string[]; closedAt?: Date; cancelledAt?: Date; cancelReason?: 'WITHDRAWN'; expectedDate?: string; approvedAt?: Date; returnedAt?: Date; delivered?: number },
  ): Promise<string> => {
    seq += 1;
    const raiser = over.raisedBy ?? att;
    const lineItems = over.items ?? ['oil'];
    const o = await prisma.purchaseOrder.create({
      data: {
        siteId: hubId, reference: `LPO-T${tag}-${seq}`, supplierId: sup[over.supplier] ?? '', status: over.status, termsDays: 14, raisedById: raiser.id, submittedAt: new Date('2026-10-01T08:00:00Z'),
        expectedDate: over.expectedDate ? new Date(`${over.expectedDate}T00:00:00Z`) : null,
        approvedById: over.approvedAt ? sm.id : null, approvedAt: over.approvedAt ?? null, returnedById: over.returnedAt ? sm.id : null, returnedAt: over.returnedAt ?? null, returnedNote: over.returnedAt ? 'Lower the carrots' : null,
        closedAt: over.closedAt ?? null, cancelledAt: over.cancelledAt ?? null, cancelReason: over.cancelReason ?? null, cancelledById: over.cancelledAt ? raiser.id : null,
        lines: { create: lineItems.map((k, i) => ({ lineOrder: i + 1, inventoryItemId: item[k] ?? '', buyUnit: 'kg', packSize: D(1), orderedQty: D(10), unitPrice: D(100), ...(over.delivered !== undefined ? { receivedQty: D(10), result: 'AS_ORDERED' as const } : {}) })) },
      },
    });
    if (over.delivered !== undefined) {
      await prisma.purchaseDelivery.create({ data: { siteId: hubId, orderId: o.id, reference: `GRN-T${tag}-${seq}`, locationId: storeLocationId, deliveryNoteNo: 'DN1', receivedById: att.id, deliveredTotal: D(over.delivered), notSuppliedTotal: D(0) } });
    }
    ord[key] = o.id;
    return o.id;
  };

  beforeAll(async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { type: 'CENTRAL_STORE', isHub: true }, select: { id: true } });
    hubId = hub.id;
    storeLocationId = (await prisma.location.findFirstOrThrow({ where: { siteId: hubId, type: 'CENTRAL_STORE' }, select: { id: true } })).id;
    for (const prefix of ['LPO', 'PAY']) counterBefore.set(prefix, (await prisma.referenceCounter.findUnique({ where: { siteId_prefix: { siteId: hubId, prefix } } }))?.lastNumber ?? null);

    const pinHash = await hashPin(PIN);
    const user = async (name: string, role: A['role'], extra: { isActive?: boolean } = {}): Promise<A> => {
      const u = await prisma.user.create({ data: { name: `${name} ${tag}`, email: `${name}-${tag}@test.invalid`, passwordHash: 'x', pinHash, role, siteId: hubId, ...extra } });
      userIds.push(u.id);
      return { id: u.id, role, siteId: hubId };
    };
    sm = await user('Joseph', 'STORE_MANAGER');
    att = await user('Amina', 'STORE_ATTENDANT');
    att2 = await user('Peter', 'STORE_ATTENDANT');
    acc = await user('Margaret', 'ACCOUNTANT');
    goneId = (await user('Gone', 'STORE_ATTENDANT', { isActive: false })).id;

    for (const [key, name] of [['A', 'Samrat'], ['B', 'Kagumo'], ['C', 'Nyeri Market'], ['D', 'Returned Co'], ['E', 'Summer'], ['F', 'Fresh'], ['G', 'Greens'], ['H', 'Paid Co']] as const) await mkSupplier(key, name);
    await mkItem('oil', 'Salt Cooking Oil 10ltr', 8, 0, 'jerrican');
    await mkItem('wings', 'Chicken wings', 3, 1, 'tray');
    await mkItem('sugar', 'Kabras Sugar 1kg', 40, 12);
    await mkItem('fine', 'Iodised Salt 1kg', 20, 48);
    await mkItem('fresh1', 'Cabbage', 10, 2);
    await mkItem('fresh2', 'Spinach', 10, 0);
    await mkItem('nolevel', 'Plain flour', null, 5);
    await sells('A', 'oil', 2400, true);
    await sells('A', 'sugar', 168);
    await sells('A', 'fine', 40);
    await sells('B', 'wings', 1900);
    await sells('F', 'fresh1', 50);
    await sells('G', 'fresh2', 30);
    await sells('A', 'nolevel', 90);
    carrierId = (await prisma.carrier.create({ data: { siteId: hubId, name: `Van ${tag}`, kind: 'VEHICLE' } })).id;
    retiredCarrierId = (await prisma.carrier.create({ data: { siteId: hubId, name: `Old van ${tag}`, kind: 'VEHICLE', active: false, retiredAt: new Date() } })).id;

    // Open orders (each holds its supplier's one open slot): ready to send, sent and overdue, awaiting approval, returned.
    await mkOrder('ready', { supplier: 'A', status: 'APPROVED', approvedAt: new Date('2026-10-08T07:12:00Z'), items: ['oil', 'sugar'] });
    await mkOrder('overdue', { supplier: 'B', status: 'SENT', approvedAt: new Date('2026-10-05T07:00:00Z'), expectedDate: '2026-10-07', items: ['wings'] });
    await mkOrder('waiting', { supplier: 'C', status: 'AWAITING_APPROVAL', items: ['fine'] });
    await mkOrder('returned', { supplier: 'D', status: 'RETURNED', returnedAt: new Date('2026-10-08T07:40:00Z'), items: ['fine'] });
    await mkOrder('dueother', { supplier: 'E', status: 'SENT', raisedBy: att2, expectedDate: '2026-10-08', items: ['fine'] });
    // Closed and cancelled orders (they hold no slot).
    await mkOrder('paid1', { supplier: 'A', status: 'CLOSED', closedAt: new Date('2026-10-05T10:00:00Z'), items: ['oil'], delivered: 975 });
    await mkOrder('paid2', { supplier: 'B', status: 'CLOSED', closedAt: new Date('2026-09-20T10:00:00Z'), items: ['wings', 'sugar'], delivered: 1900 });
    await mkOrder('cancelled', { supplier: 'C', status: 'CANCELLED', cancelledAt: new Date('2026-10-02T22:30:00Z'), cancelReason: 'WITHDRAWN', items: ['fine'] });
    await mkOrder('old', { supplier: 'A', status: 'CLOSED', closedAt: new Date('2026-06-01T10:00:00Z'), items: ['oil'], delivered: 500 });
  }, 90_000);

  afterAll(async () => {
    if (!enabled) return;
    await prisma.$transaction(async (tx) => {
      await allowLedgerEditsInThisTransaction(tx);
      const orders = await tx.purchaseOrder.findMany({ where: { supplierId: { in: supplierIds } }, select: { id: true } });
      const orderIds = orders.map((o) => o.id);
      await tx.purchasingAuditEntry.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.purchasePayment.deleteMany({ where: { orderId: { in: orderIds }, reversesId: { not: null } } });
      await tx.purchasePayment.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.purchaseInvoice.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.purchaseDelivery.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.purchaseOrderLine.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.purchaseOrder.deleteMany({ where: { id: { in: orderIds } } });
      await tx.supplierItem.deleteMany({ where: { supplierId: { in: supplierIds } } });
      await tx.inventoryTransaction.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await tx.restockLevel.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await tx.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
      await tx.supplier.deleteMany({ where: { id: { in: supplierIds } } });
      await tx.carrier.deleteMany({ where: { id: { in: [carrierId, retiredCarrierId] } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
      for (const [prefix, before] of counterBefore) {
        if (before === null) await tx.referenceCounter.deleteMany({ where: { siteId: hubId, prefix } });
        else await tx.referenceCounter.updateMany({ where: { siteId: hubId, prefix }, data: { lastNumber: before } });
      }
    });
    await prisma.$disconnect();
  });

  const scope = () => ({ siteId: hubId, locationId: storeLocationId });
  const mine = <T extends { reference?: string | null }>(rows: readonly T[]): T[] => rows.filter((r) => r.reference?.includes(tag));

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('"Who is getting it?" lookups and the guarded write', () => {
    it('finds an active carrier of the hub, not a retired one, and not a stranger id', async () => {
      await expect(ordersRepository.findActiveCarrier(hubId, carrierId)).resolves.toEqual({ id: carrierId, name: `Van ${tag}` });
      await expect(ordersRepository.findActiveCarrier(hubId, retiredCarrierId)).resolves.toBeNull();
      await expect(ordersRepository.findActiveCarrier(hubId, randomUUID())).resolves.toBeNull();
      await expect(ordersRepository.findActiveCarrier(randomUUID(), carrierId)).resolves.toBeNull();
    });

    it('finds an active member of the hub staff, not someone who left, and not another organization', async () => {
      await expect(ordersRepository.findActiveStaff(hubId, att2.id)).resolves.toMatchObject({ id: att2.id, role: 'STORE_ATTENDANT' });
      await expect(ordersRepository.findActiveStaff(hubId, goneId)).resolves.toBeNull();
      await expect(ordersRepository.findActiveStaff(randomUUID(), att2.id)).resolves.toBeNull();
    });

    it('lists the active carriers and the staff for the picker, filtered by the typed text', async () => {
      const all = await ordersRepository.listCollectors(hubId, tag);
      expect(all.carriers.map((c) => c.name)).toEqual([`Van ${tag}`]);
      expect(all.staff.map((s) => s.id).sort()).toEqual([sm.id, att.id, att2.id, acc.id].sort());
      const narrow = await ordersRepository.listCollectors(hubId, `Peter ${tag}`);
      expect(narrow.staff.map((s) => s.id)).toEqual([att2.id]);
    });

    it('sets who is getting an approved order, shows it, corrects it, and clears it; only while approved or sent', async () => {
      const id = ord['ready'] ?? '';
      const set = await ordersService.setCollectedBy(att, id, { kind: 'CARRIER', carrierId }, NOW);
      expect(set.collectedBy).toMatchObject({ kind: 'CARRIER', label: `Van ${tag}`, summary: `collected by Van ${tag}`, carrierId, setBy: { id: att.id, role: 'Store Attendant' } });
      const fixed = await ordersService.setCollectedBy(att, id, { kind: 'STAFF', userId: att2.id }, NOW);
      expect(fixed.collectedBy).toMatchObject({ kind: 'STAFF', label: `Peter ${tag}`, carrierId: null, userId: att2.id });
      const free = await ordersService.setCollectedBy(att, id, { kind: 'OTHER', name: 'Kamau the driver' }, NOW);
      expect(free.collectedBy).toMatchObject({ kind: 'OTHER', label: 'Kamau the driver', userId: null });
      const row = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });
      expect([row.collectedByCarrierId, row.collectedByUserId, row.collectedByName]).toEqual([null, null, 'Kamau the driver']);
      const cleared = await ordersService.setCollectedBy(att, id, null, NOW);
      expect(cleared.collectedBy).toBeNull();
      expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } })).collectedBySetById).toBeNull();
      const audit = await prisma.purchasingAuditEntry.findMany({ where: { orderId: id, action: { in: ['Set who is getting the order', 'Cleared who is getting the order'] } } });
      expect(audit).toHaveLength(4);
    });

    it('refuses a retired carrier, a person who left, and an order that is not approved or sent', async () => {
      await expect(ordersService.setCollectedBy(att, ord['ready'] ?? '', { kind: 'CARRIER', carrierId: retiredCarrierId }, NOW)).rejects.toMatchObject({ code: 'COLLECTOR_NOT_FOUND' });
      await expect(ordersService.setCollectedBy(att, ord['ready'] ?? '', { kind: 'STAFF', userId: goneId }, NOW)).rejects.toMatchObject({ code: 'COLLECTOR_NOT_FOUND' });
      await expect(ordersService.setCollectedBy(att, ord['waiting'] ?? '', { kind: 'SUPPLIER_DELIVERS' }, NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
      await expect(ordersService.setCollectedBy(acc, ord['ready'] ?? '', { kind: 'SUPPLIER_DELIVERS' }, NOW)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('the repository write is guarded by the status: an order that moved on is left alone', async () => {
      const ok = await prisma.$transaction((tx) => ordersRepository.setCollectedBy(tx, hubId, ord['waiting'] ?? '', { collectedByKind: 'SUPPLIER_DELIVERS', collectedByCarrierId: null, collectedByUserId: null, collectedByName: null, collectedBySetById: att.id, collectedBySetAt: NOW }));
      expect(ok).toBe(false);
      expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: ord['waiting'] ?? '' } })).collectedByKind).toBeNull();
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('send with the choice in one tap', () => {
    it('marks an approved order sent with the carrier stored and in the audit row; a second send changes nothing', async () => {
      const id = ord['ready'] ?? '';
      const sent = await ordersService.send(att, id, 'MANUAL', NOW, { kind: 'CARRIER', carrierId });
      expect(sent).toMatchObject({ status: 'SENT', sentVia: 'MANUAL', collectedBy: { kind: 'CARRIER', label: `Van ${tag}`, setBy: { id: att.id } } });
      const audit = await prisma.purchasingAuditEntry.findFirstOrThrow({ where: { orderId: id, action: 'Marked order as sent' } });
      expect(audit.detail).toContain(`collected by Van ${tag}`);
      const again = await ordersService.send(att, id, 'MANUAL', new Date(NOW.getTime() + 60_000), { kind: 'SUPPLIER_DELIVERS' });
      expect(again.collectedBy).toMatchObject({ kind: 'CARRIER' });
      expect(again.sentAt).toBe(sent.sentAt);
    });

    it('a carrier retired before the tap refuses the whole send: the order stays approved', async () => {
      const id = await mkOrder('send2', { supplier: 'F', status: 'APPROVED', approvedAt: NOW, items: ['fresh1'] });
      await expect(ordersService.send(att, id, 'MANUAL', NOW, { kind: 'CARRIER', carrierId: retiredCarrierId })).rejects.toMatchObject({ code: 'COLLECTOR_NOT_FOUND' });
      expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } })).status).toBe('APPROVED');
      await prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: NOW, cancelReason: 'OTHER' } }); // free supplier F's slot for the send test below
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('withdraw and remind', () => {
    it('lets the raiser withdraw an order awaiting approval, with no PIN; the supplier slot is free again', async () => {
      const id = await mkOrder('wd', { supplier: 'G', status: 'AWAITING_APPROVAL', items: ['fresh2'] });
      await expect(ordersRepository.findOpenOrder(hubId, sup['G'] ?? '')).resolves.toMatchObject({ id });
      const view = await ordersService.withdraw(att, id, NOW);
      expect(view).toMatchObject({ status: 'CANCELLED', cancelled: { reason: 'WITHDRAWN', by: { id: att.id }, note: null } });
      expect(view.can.withdraw).toBe(false);
      await expect(ordersRepository.findOpenOrder(hubId, sup['G'] ?? '')).resolves.toBeNull();
      expect(await prisma.purchasingAuditEntry.count({ where: { orderId: id, action: 'Withdrew order' } })).toBe(1);
    });

    it('refuses to withdraw someone else’s order, an approved order, and the same order twice', async () => {
      await expect(ordersService.withdraw(att2, ord['waiting'] ?? '', NOW)).rejects.toMatchObject({ statusCode: 403 });
      await expect(ordersService.withdraw(att, ord['overdue'] ?? '', NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
      await expect(ordersService.withdraw(att, ord['wd'] ?? '', NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
    });

    it('withdraws a returned order, and the withdrawn orders show in History as cancelled with the reason', async () => {
      await ordersService.withdraw(att, ord['returned'] ?? '', NOW);
      const h = await attendantService.getHistory(att, { status: 'cancelled', q: tag, page: 1, pageSize: 50 }, NOW);
      expect(h.months.flatMap((m) => m.rows).map((r) => r.cancelReason)).toEqual(expect.arrayContaining(['WITHDRAWN']));
    });

    it('reminds the Store Manager once and not again within four hours; the throttle reads the audit row', async () => {
      const id = ord['waiting'] ?? '';
      await expect(ordersRepository.findLastAuditAt(hubId, id, 'Reminded the approver')).resolves.toBeNull();
      await ordersService.remind(att, id, NOW);
      expect(purchasingNotices.reminder).toHaveBeenCalledWith(expect.objectContaining({ orderId: id, fromLabel: `Amina ${tag} (Store Attendant)` }));
      const last = await ordersRepository.findLastAuditAt(hubId, id, 'Reminded the approver');
      expect(last?.toISOString()).toBe(NOW.toISOString());
      await expect(ordersService.remind(att, id, new Date(NOW.getTime() + 3 * 3_600_000))).rejects.toMatchObject({ code: 'REMINDER_TOO_SOON', statusCode: 409 });
      await ordersService.remind(att, id, new Date(NOW.getTime() + 5 * 3_600_000));
      expect(await prisma.purchasingAuditEntry.count({ where: { orderId: id, action: 'Reminded the approver' } })).toBe(2);
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('History queries', () => {
    const range = (from: string, toInclusive: string) => ({ from: new Date(`${from}T00:00:00+03:00`), toExclusive: new Date(new Date(`${toInclusive}T00:00:00+03:00`).getTime() + 86_400_000) });

    // The orders this file closed or cancelled with a fixed date (the withdrawals above were cancelled "now", at the front of any range that holds today).
    const fixed = () => [ord['paid1'], ord['cancelled'], ord['paid2'], ord['old']];
    const only = (ids: readonly string[]) => ids.filter((id) => fixed().includes(id));

    it('lists closed and cancelled orders in the range, newest closing first, by the day each closed', async () => {
      const r = await attendantRepository.listClosedIds(hubId, { ...range('2026-09-01', '2026-10-08'), status: 'all', q: tag }, 0, 50);
      expect(only(r.ids)).toEqual([ord['paid1'], ord['cancelled'], ord['paid2']]); // 5 Oct, 3 Oct (22:30 UTC on the 2nd), 20 Sep
      expect(r.ids).not.toContain(ord['old']); // 1 June is outside the range
      expect(r.total).toBe(r.ids.length);
    });

    it('filters by status, by the search (order number, supplier, item) and by who raised it', async () => {
      const wide = range('2026-01-01', '2026-10-08');
      const paid = await attendantRepository.listClosedIds(hubId, { ...wide, status: 'paid', q: tag }, 0, 50);
      expect(paid.ids).toEqual([ord['paid1'], ord['paid2'], ord['old']]);
      const cancelled = await attendantRepository.listClosedIds(hubId, { ...wide, status: 'cancelled', q: tag }, 0, 50);
      expect(cancelled.ids).toContain(ord['cancelled']);
      expect(cancelled.ids).not.toContain(ord['paid1']);
      const byRef = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: ord['paid2'] ?? '' }, select: { reference: true } });
      expect((await attendantRepository.listClosedIds(hubId, { ...wide, status: 'all', q: byRef.reference ?? '' }, 0, 50)).ids).toEqual([ord['paid2']]);
      expect((await attendantRepository.listClosedIds(hubId, { ...wide, status: 'all', q: `kagumo ${tag}` }, 0, 50)).ids).toEqual([ord['paid2']]);
      expect((await attendantRepository.listClosedIds(hubId, { ...wide, status: 'all', q: `chicken wings ${tag}` }, 0, 50)).ids).toEqual([ord['paid2']]);
      expect((await attendantRepository.listClosedIds(hubId, { ...wide, status: 'all', q: tag, raisedById: att2.id }, 0, 50)).total).toBe(0);
      expect(only((await attendantRepository.listClosedIds(hubId, { ...wide, status: 'all', q: tag, raisedById: att.id }, 0, 50)).ids)).toHaveLength(4);
    });

    it('pages with an offset and a limit: the pages together are the whole list, and the total is the whole match', async () => {
      const wide = { ...range('2026-01-01', '2026-10-08'), status: 'all' as const, q: tag };
      const everything = await attendantRepository.listClosedIds(hubId, wide, 0, 100);
      const pages = [await attendantRepository.listClosedIds(hubId, wide, 0, 2), await attendantRepository.listClosedIds(hubId, wide, 2, 2), await attendantRepository.listClosedIds(hubId, wide, 4, 2), await attendantRepository.listClosedIds(hubId, wide, 6, 2)];
      expect(everything.total).toBeGreaterThanOrEqual(7);
      expect(pages.every((p) => p.total === everything.total)).toBe(true);
      expect(pages.flatMap((p) => p.ids)).toEqual(everything.ids);
      expect(pages[0]?.ids).toHaveLength(2);
      expect(new Set(everything.ids).size).toBe(everything.ids.length);
    });

    it('an order closed at 01:00 Nairobi belongs to that Nairobi day, not the UTC one before it', async () => {
      const id = await mkOrder('midnight', { supplier: 'H', status: 'CLOSED', closedAt: new Date('2026-10-06T22:00:00Z'), items: ['oil'], delivered: 100 });
      expect((await attendantRepository.listClosedIds(hubId, { ...range('2026-10-07', '2026-10-07'), status: 'all', q: tag }, 0, 50)).ids).toEqual([id]);
      expect((await attendantRepository.listClosedIds(hubId, { ...range('2026-10-06', '2026-10-06'), status: 'all', q: tag }, 0, 50)).ids).toEqual([]);
    });

    it('the header counts cover everything closed and cancelled, and the range', async () => {
      const c = await attendantRepository.countClosed(hubId, ...(Object.values(range('2026-10-01', '2026-10-08')) as [Date, Date]));
      expect(c.allTime).toBeGreaterThanOrEqual(5);
      expect(c.inRange).toBeGreaterThanOrEqual(2);
      expect(c.allTime).toBeGreaterThanOrEqual(c.inRange);
    });

    it('the service returns the page by month with the delivered value and no invoice or payment figure', async () => {
      const h = await attendantService.getHistory(att, { from: '2026-09-01', to: '2026-10-08', status: 'all', q: tag, page: 1, pageSize: 20 }, NOW);
      expect(h.range).toEqual({ from: '2026-09-01', to: '2026-10-08' });
      expect(h.total).toBeGreaterThanOrEqual(4);
      expect(h.months.map((m) => m.label)).toEqual(['October 2026', 'September 2026']);
      const rows = h.months.flatMap((m) => m.rows);
      expect(rows.find((r) => r.id === ord['paid1'])).toMatchObject({ outcome: 'PAID', valueKind: 'DELIVERED', value: '975.00', itemCount: 1, shortCount: 0, closedOn: '2026-10-05' });
      expect(rows.find((r) => r.id === ord['cancelled'])).toMatchObject({ outcome: 'CANCELLED', valueKind: 'ORDERED', value: '1000.00', cancelReason: 'WITHDRAWN', closedOn: '2026-10-03' });
      expect(h.months[1]?.rows.map((r) => r.id)).toEqual([ord['paid2']]);
      expect(JSON.stringify(h)).not.toMatch(/invoice|payment|balance|money/i);
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('Search, the supplier page and Restock levels', () => {
    it('searches items with stock and level, suppliers with their open orders, and orders by number, supplier or item', async () => {
      const items = await attendantRepository.searchItems(scope(), tag, 20);
      expect(items.map((i) => [i.name.replace(` ${tag}`, ''), i.onHand.toString(), i.level?.toString() ?? null]).sort()).toEqual(
        [['Cabbage', '2', '10'], ['Chicken wings', '1', '3'], ['Iodised Salt 1kg', '48', '20'], ['Kabras Sugar 1kg', '12', '40'], ['Plain flour', '5', null], ['Salt Cooking Oil 10ltr', '0', '8'], ['Spinach', '0', '10']].sort(),
      );
      expect(await attendantRepository.countItems(hubId, tag)).toBe(7);
      const suppliers = await attendantRepository.searchSuppliers(hubId, `samrat ${tag}`, 10);
      expect(suppliers.total).toBe(1);
      expect(suppliers.rows[0]).toMatchObject({ id: sup['A'], itemCount: 4 });
      const orders = await attendantRepository.searchOrders(hubId, `Chicken wings ${tag}`, 10);
      expect(orders.rows.map((o) => o.id).sort()).toEqual([ord['overdue'], ord['paid2']].sort());
    });

    it('the service puts it together: an out item suggests level minus on hand from the default supplier and names the open order holding it', async () => {
      const s = await attendantService.search(att, `Salt Cooking Oil 10ltr ${tag}`, NOW);
      expect(s.items[0]).toMatchObject({ status: 'OUT', onHand: '0', level: '8', suggestedQty: '8', supplier: { id: sup['A'] }, onOpenOrder: { orderId: ord['ready'] } });
      expect(s.orders.length).toBeGreaterThanOrEqual(2);
      const blind = await attendantService.search(att, `Plain flour ${tag}`, NOW);
      expect(blind.items[0]).toMatchObject({ status: 'NO_LEVEL', suggestedQty: null });
    });

    it('the supplier page shows what we buy with its stock status and the open order', async () => {
      const page = await attendantService.getSupplier(att, sup['A'] ?? '', NOW);
      expect(page.supplier).toMatchObject({ name: `Samrat ${tag}`, phone: expect.stringMatching(/^0700/), whatsapp: expect.stringMatching(/^0711/) });
      expect(page.items.map((i) => [i.name.replace(` ${tag}`, ''), i.status, i.suggestedQty, i.onOpenOrder])).toEqual([
        ['Iodised Salt 1kg', 'OK', null, true],
        ['Kabras Sugar 1kg', 'LOW', '28', true],
        ['Plain flour', 'NO_LEVEL', null, false],
        ['Salt Cooking Oil 10ltr', 'OUT', '8', true],
      ]);
      expect(page.lowCount).toBe(0); // the sugar and the oil are both already on the open order
      expect(page.items[0]?.price).toBe('40.00');
      await expect(attendantService.getSupplier(att, randomUUID(), NOW)).rejects.toMatchObject({ code: 'SUPPLIER_NOT_FOUND' });
    });

    it('Restock levels list our items with a status and a bar, out first, filtered and paged', async () => {
      const r = await attendantService.getRestockLevels(att, { q: tag, page: 1, pageSize: 3 });
      expect(r.total).toBe(6); // the flour has no level: it is not listed
      expect(r.rows.map((x) => [x.name.replace(` ${tag}`, ''), x.status, x.fill])).toEqual([['Salt Cooking Oil 10ltr', 'OUT', 0], ['Spinach', 'OUT', 0], ['Cabbage', 'LOW', 0.2]]);
      const out = await attendantService.getRestockLevels(att, { q: tag, status: 'OUT', page: 1, pageSize: 20 });
      expect(out.rows).toHaveLength(2);
      const bySupplier = await attendantService.getRestockLevels(att, { q: tag, supplierId: sup['B'], page: 1, pageSize: 20 });
      expect(bySupplier.rows.map((x) => x.name)).toEqual([`Chicken wings ${tag}`]);
      expect(bySupplier.suppliers.some((s) => s.id === sup['B'])).toBe(true);
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('Home, My orders and Notifications over the real rows', () => {
    it('My orders: the caller’s own open orders in Needs you and Waiting, with the chip counts', async () => {
      // `ready` was sent above (expected nothing: waiting on the supplier), `overdue` is late, `waiting` awaits approval, `returned` was withdrawn above.
      const r = await attendantService.getMyOrders(att, { filter: 'all', q: tag }, NOW);
      const ids = (rows: Array<{ id: string }>) => rows.map((x) => x.id);
      expect(ids(r.needsYou)).toEqual([ord['overdue']]);
      expect(r.needsYou[0]).toMatchObject({ need: 'RECEIVE', dueLabel: 'OVERDUE' });
      expect(ids(r.waitingOnOthers).sort()).toEqual([ord['ready'], ord['waiting']].sort());
      expect(r.counts).toEqual({ all: 3, needs: 1, waiting: 2, overdue: 1 });
      expect(ids((await attendantService.getMyOrders(att, { filter: 'overdue', q: tag }, NOW)).needsYou)).toEqual([ord['overdue']]);
      expect((await attendantService.getMyOrders(att2, { filter: 'all', q: tag }, NOW)).counts.all).toBe(1);
      expect(r.approver?.role).toBe('Store Manager');
    });

    it('Home: a delivery due today that someone else raised still needs the Attendant; the restock card counts our items', async () => {
      const h = await attendantService.getHome(att, NOW);
      expect(mine(h.needsYou).map((x) => x.id).sort()).toEqual([ord['overdue'], ord['dueother']].sort());
      expect(h.restock.total).toBeGreaterThanOrEqual(3);
      expect(h.badges.receiving).toBeGreaterThanOrEqual(3);
      expect((await attendantService.getBadges(att, NOW)).myOrders).toBeGreaterThanOrEqual(1);
    });

    it('Notifications: the due, overdue and returned notices, newest first, unread until opened', async () => {
      await prisma.purchaseOrder.update({ where: { id: ord['waiting'] ?? '' }, data: { status: 'RETURNED', returnedAt: new Date('2026-10-08T07:40:00Z'), returnedById: sm.id, returnedNote: 'Lower the carrots' } });
      const n = await attendantService.getNotices(att, { filter: 'all' }, NOW);
      const mineNotices = n.groups.flatMap((g) => g.notices).filter((x) => x.reference?.includes(tag));
      expect(mineNotices.map((x) => x.type)).toEqual(expect.arrayContaining(['RETURNED', 'OVERDUE', 'DUE_TODAY']));
      expect(mineNotices.every((x) => x.unread)).toBe(true);
      const returned = mineNotices.find((x) => x.type === 'RETURNED');
      expect(returned).toMatchObject({ action: 'EDIT_AND_RESEND', title: `Joseph ${tag} (Store Manager) sent it back`, body: '"Lower the carrots"' });
      await attendantService.markNoticesRead(att, [returned?.key ?? ''], NOW);
      await attendantService.markNoticesRead(att, [returned?.key ?? ''], NOW); // opening twice is fine
      const after = await attendantService.getNotices(att, { filter: 'all' }, NOW);
      expect(after.groups.flatMap((g) => g.notices).find((x) => x.key === returned?.key)?.unread).toBe(false);
      expect(await prisma.purchasingNoticeRead.count({ where: { userId: att.id } })).toBe(1);
      const marked = await attendantService.markAllNoticesRead(att, NOW);
      expect(marked).toBeGreaterThanOrEqual(2);
      expect((await attendantService.getNotices(att, { filter: 'unread' }, NOW)).counts.unread).toBe(0);
      expect((await attendantService.getNotices(att2, { filter: 'all' }, NOW)).groups.flatMap((g) => g.notices).filter((x) => x.reference?.includes(tag) && x.type === 'RETURNED')).toEqual([]);
    });

    it('the 08:00 job’s query finds sent orders expected on a day, scoped to the hub', async () => {
      const due = await attendantRepository.findSentDueOn(hubId, new Date('2026-10-08T00:00:00Z'));
      expect(due.find((o) => o.id === ord['dueother'])).toMatchObject({ itemCount: 1 });
      expect(await attendantRepository.findSentDueOn(randomUUID(), new Date('2026-10-08T00:00:00Z'))).toEqual([]);
    });

    it('read marks are scoped to the person and go when the person goes (cascade)', async () => {
      expect([...(await attendantRepository.findReadKeys(att2.id))]).toEqual([]);
      await attendantRepository.markRead(att2.id, ['CLOSED:x', 'CLOSED:x', 'APPROVED:y'], NOW);
      expect([...(await attendantRepository.findReadKeys(att2.id))].sort()).toEqual(['APPROVED:y', 'CLOSED:x']);
      await attendantRepository.markRead(att2.id, [], NOW);
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('closedAt follows the order into CLOSED and out again', () => {
    it('stamps the day the invoice is paid in full, tells the raiser once, and clears it when the payment is reversed', async () => {
      const id = await mkOrder('inv', { supplier: 'H', status: 'INVOICED', items: ['oil'], delivered: 1000 });
      const invoice = await prisma.purchaseInvoice.create({ data: { siteId: hubId, orderId: id, supplierId: sup['H'] ?? '', number: `INV-${tag}`, invoiceDate: new Date('2026-10-05T00:00:00Z'), dueDate: new Date('2026-10-19T00:00:00Z'), amount: D(1000), enteredById: acc.id } });
      const paid = await payablesService.recordPayment(acc as never, invoice.id, { amount: '1000', paidOn: '2026-10-08', method: 'CASH', methodRef: null, chequeNo: null, proofPhotoId: null, confirmOverpay: false }, NOW);
      const closed = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });
      expect(closed.status).toBe('CLOSED');
      expect(closed.closedAt?.toISOString()).toBe(NOW.toISOString());
      expect(purchasingNotices.closed).toHaveBeenCalledTimes(1);
      expect(purchasingNotices.closed).toHaveBeenCalledWith(expect.objectContaining({ orderId: id, raisedById: att.id }));
      // It now appears in History for the Attendant, at its delivered value, with no payment figure.
      const h = await attendantService.getHistory(att, { from: '2026-10-08', to: '2026-10-08', status: 'paid', q: tag, page: 1, pageSize: 20 }, NOW);
      expect(h.months[0]?.rows[0]).toMatchObject({ id, value: '1000.00', valueKind: 'DELIVERED', outcome: 'PAID', closedOn: '2026-10-08' });

      await payablesService.reversePayment(acc as never, paid.payment.id, { reason: 'WRONG_AMOUNT', note: null, approverPin: PIN }, new Date(NOW.getTime() + 3_600_000));
      const reopened = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });
      expect(reopened.status).toBe('INVOICED');
      expect(reopened.closedAt).toBeNull();
    }, 30_000);
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('the restock list: review and send', () => {
    it('reviews two suppliers as two orders, then sends them for approval; a supplier with an open order is reported, not sent', async () => {
      const lines = [
        { inventoryItemId: item['fresh1'] ?? '', qty: '8' },
        { inventoryItemId: item['fresh2'] ?? '', qty: '10' },
        { inventoryItemId: item['wings'] ?? '', qty: '2' },
      ];
      const review = await restockListService.review(att, { lines });
      expect(review.orderCount).toBe(3);
      expect(review.groups.map((g) => [g.supplier.id, g.problem])).toEqual([[sup['F'], null], [sup['G'], null], [sup['B'], 'SUPPLIER_ORDER_OPEN']]);
      expect(review.groups[2]?.openOrder?.id).toBe(ord['overdue']);
      expect(review.estimatedTotal).toBe('4500.00'); // 8 x 50 + 10 x 30 + 2 x 1900
      expect(review.approver).toMatchObject({ role: 'Store Manager' });

      const result = await restockListService.send(att, { lines, note: 'Greens for the weekend' }, NOW);
      expect(result.sent.map((s) => s.supplier.id)).toEqual([sup['F'], sup['G']]);
      expect(result.failed).toEqual([{ supplier: { id: sup['B'], name: `Kagumo ${tag}` }, code: 'SUPPLIER_ORDER_OPEN', message: expect.stringContaining('is still open'), orderId: null }]);
      for (const sent of result.sent) {
        expect(sent.order).toMatchObject({ status: 'AWAITING_APPROVAL', reference: expect.stringMatching(/^LPO-\d{4,}$/), attendantNote: 'Greens for the weekend', raisedBy: { id: att.id } });
        const row = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: sent.order.id }, include: { lines: true } });
        expect(row.status).toBe('AWAITING_APPROVAL');
        expect(row.lines).toHaveLength(1);
      }
      expect(result.sent[0]?.order.lines[0]).toMatchObject({ orderedQty: '8', unitPrice: '50.00', lineTotal: '400.00' });
      expect(purchasingNotices.submitted).toHaveBeenCalledTimes(2);
      // Nothing was made for the supplier whose slot was taken.
      expect(await prisma.purchaseOrder.count({ where: { supplierId: sup['B'], status: { in: ['DRAFT', 'AWAITING_APPROVAL'] } } })).toBe(0);
    });

    it('sending the same list again is refused for both suppliers: each now has an open order', async () => {
      const lines = [{ inventoryItemId: item['fresh1'] ?? '', qty: '8' }, { inventoryItemId: item['fresh2'] ?? '', qty: '10' }];
      const again = await restockListService.send(att, { lines, note: null }, NOW);
      expect(again.sent).toEqual([]);
      expect(again.failed.map((f) => f.code)).toEqual(['SUPPLIER_ORDER_OPEN', 'SUPPLIER_ORDER_OPEN']);
    });

    it('refuses an item that does not exist, and a list that names a supplier that does not sell the item, before saving anything', async () => {
      const before = await prisma.purchaseOrder.count({ where: { supplierId: { in: supplierIds } } });
      await expect(restockListService.send(att, { lines: [{ inventoryItemId: randomUUID(), qty: '1' }], note: null }, NOW)).rejects.toMatchObject({ code: 'VALIDATION' });
      await expect(restockListService.send(att, { lines: [{ inventoryItemId: item['fresh1'] ?? '', qty: '1', supplierId: sup['G'] }], note: null }, NOW)).rejects.toMatchObject({ code: 'VALIDATION' });
      expect(await prisma.purchaseOrder.count({ where: { supplierId: { in: supplierIds } } })).toBe(before);
    });

    it('an item nobody sells us is listed apart and never ordered', async () => {
      const review = await restockListService.review(att, { lines: [{ inventoryItemId: item['fine'] ?? '', qty: '5' }, { inventoryItemId: item['nolevel'] ?? '', qty: '1' }] });
      expect(review.orderCount).toBe(1); // both sold by Samrat
      await prisma.supplierItem.deleteMany({ where: { inventoryItemId: item['nolevel'] } });
      const none = await restockListService.review(att, { lines: [{ inventoryItemId: item['nolevel'] ?? '', qty: '1' }] });
      expect(none.unsupplied.map((u) => u.inventoryItemId)).toEqual([item['nolevel']]);
      expect(none.orderCount).toBe(0);
    });
  });
});
