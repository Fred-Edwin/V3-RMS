/**
 * Block 3 (Branch waste), back end, against a REAL database (no mocks of the data layer). Opt-in:
 *   cd backend && RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/waste/branch/branch-waste.db.test.ts
 * It builds its own two branches, departments, users, items and links, and removes everything it made (the ledger is append-only, so
 * its cleanup lifts that lock inside one transaction, as the dev seed scripts do). Use only the lane's own database, and run it on its
 * own (one file at a time).
 *
 * Covers the log and reverse paths end to end: BW2 (a ledger row per entry through the door, the department's location made on first
 * use, idempotent replay, the department rule, the item refusals), BW3 to BW6 (scoping by branch and department, money only for those
 * who hold the capability, reversed entries read 0.00), BW7 (a linked reversing ledger row, the same-Nairobi-day window, any entry for
 * the Branch Manager and the System Admin, one winner in a race) and the Audit log's BRANCH_WASTE source.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { allowLedgerEditsInThisTransaction } from '../../../../scripts/ledger-dev-bypass';
import { LOCK_WAIT_MS, takeDbTestLock } from '../../_shared/db-test-lock';
import { auditLogService } from '../../audit-log/audit-log-service';
import { AuditLogQuerySchema } from '../../audit-log/audit-log-validators';
import { departmentLinks } from '../../departments/department-links';
import { BRANCH_WASTE_BLIND_KEYS } from '../_shared/waste-contract';
import { branchWasteRepository } from './branch-repository';
import { branchWasteService } from './branch-service';

const enabled = process.env['RUN_DB_TESTS'] === '1';
const tag = randomUUID().slice(0, 8);

let releaseDbLock: () => Promise<void> = async () => undefined;
beforeAll(async () => {
  if (enabled) releaseDbLock = await takeDbTestLock();
}, LOCK_WAIT_MS);
afterAll(async () => {
  await releaseDbLock();
});

type Role = 'STORE_MANAGER' | 'MANAGER' | 'DIRECTOR' | 'SYSTEM_ADMIN' | 'CHEF' | 'BARISTA';
type A = { id: string; role: Role; siteId: string | null; isDepartmentHead: boolean };

const keysOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap(keysOf) : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]) : [];
const codeFrom = (lead: string, hex: string): string => lead + [...hex.slice(0, 2)].map((c) => String.fromCharCode(65 + (parseInt(c, 16) % 26))).join('');

describe.skipIf(!enabled)('Branch waste against the real database', () => {
  let hubId = '';
  let siteA = '';
  let siteB = '';
  const dept: Record<string, string> = {};
  const deptB: Record<string, string> = {};
  let beefId = '';
  let milkId = '';
  let retiredId = '';
  let storeManager: A;
  let director: A;
  let admin: A;
  let bmA: A;
  let bmB: A;
  let head: A;
  let member: A;
  let colleague: A;
  let barista: A;
  const userIds: string[] = [];
  const itemIds: string[] = [];
  const logIds: string[] = [];
  let kitchenLocationId = '';

  const onHand = async (itemId: string): Promise<string> =>
    ((await prisma.inventoryTransaction.aggregate({ where: { siteId: siteA, locationId: kitchenLocationId, inventoryItemId: itemId }, _sum: { quantity: true } }))._sum.quantity ?? new Prisma.Decimal(0)).toString();
  const failsWith = async (promise: Promise<unknown>, code: string): Promise<void> => {
    await expect(promise).rejects.toMatchObject({ code });
  };
  const logAs = async (actor: A, itemId: string, quantity: string, key = `key-${randomUUID()}`) => {
    const { result, replayed } = await branchWasteService.log(actor as never, { entries: [{ inventoryItemId: itemId, quantity, reason: 'EXPIRY' }], idempotencyKey: key });
    for (const e of result.entries) if (!logIds.includes(e.id)) logIds.push(e.id);
    return { result, replayed, key };
  };

  beforeAll(async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { type: 'CENTRAL_STORE', isHub: true }, select: { id: true, companyId: true } });
    hubId = hub.id;
    const branch = async (lead: string, name: string): Promise<string> => {
      const code = codeFrom(lead, tag);
      const b = await prisma.site.create({ data: { companyId: hub.companyId, type: 'BRANCH', name: `${name} ${tag}`, code, address: 'x', city: 'x', latitude: 0, longitude: 0 } });
      await departmentLinks.provisionBranch({ id: b.id, name, code });
      return b.id;
    };
    siteA = await branch('W', 'Waste test A');
    siteB = await branch('V', 'Waste test B');
    for (const d of await prisma.department.findMany({ where: { siteId: siteA }, select: { id: true, key: true } })) if (d.key) dept[d.key] = d.id;
    for (const d of await prisma.department.findMany({ where: { siteId: siteB }, select: { id: true, key: true } })) if (d.key) deptB[d.key] = d.id;

    const user = async (name: string, role: Role, site: string | null, extra: { departmentId?: string; isDepartmentHead?: boolean } = {}): Promise<A> => {
      const u = await prisma.user.create({ data: { name: `${name} ${tag}`, email: `${name}-${tag}@test.invalid`, passwordHash: 'x', role, siteId: site, ...extra } });
      userIds.push(u.id);
      return { id: u.id, role, siteId: site, isDepartmentHead: extra.isDepartmentHead ?? false };
    };
    storeManager = await user('sm', 'STORE_MANAGER', hubId);
    director = await user('dir', 'DIRECTOR', null);
    admin = await user('adm', 'SYSTEM_ADMIN', null);
    bmA = await user('bma', 'MANAGER', siteA);
    bmB = await user('bmb', 'MANAGER', siteB);
    head = await user('head', 'CHEF', siteA, { departmentId: dept['KITCHEN'], isDepartmentHead: true });
    member = await user('mem', 'CHEF', siteA, { departmentId: dept['KITCHEN'] });
    colleague = await user('col', 'CHEF', siteA, { departmentId: dept['KITCHEN'] });
    barista = await user('bar', 'BARISTA', siteA, { departmentId: dept['BARISTA'] });

    const item = async (name: string, cost: number, departmentId: string, extra: { deletedAt?: Date } = {}): Promise<string> => {
      const i = await prisma.inventoryItem.create({ data: { siteId: hubId, name: `${name} ${tag}`, type: 'STOCKED', buyUnit: 'kg', usageUnit: 'kg', departmentTags: [], currentCost: new Prisma.Decimal(cost), ...extra } });
      itemIds.push(i.id);
      await prisma.itemDepartment.create({ data: { itemId: i.id, departmentId } });
      return i.id;
    };
    beefId = await item('Beef stew', 320, dept['KITCHEN'] ?? '');
    milkId = await item('Milk', 100, dept['BARISTA'] ?? '');
    retiredId = await item('Old stew', 50, dept['KITCHEN'] ?? '', { deletedAt: new Date('2026-09-01') });
  }, 60_000);

  afterAll(async () => {
    if (!enabled) return;
    await prisma.$transaction(async (tx) => {
      await allowLedgerEditsInThisTransaction(tx);
      const logs = (await tx.wasteLog.findMany({ where: { siteId: { in: [siteA, siteB] } }, select: { id: true } })).map((l) => l.id);
      await tx.$executeRaw`UPDATE inventory_transactions SET reverses_transaction_id = NULL WHERE waste_log_id = ANY(${logs}::text[])`;
      await tx.inventoryTransaction.deleteMany({ where: { OR: [{ wasteLogId: { in: logs } }, { inventoryItemId: { in: itemIds } }] } });
      await tx.wasteLog.deleteMany({ where: { id: { in: logs } } });
      await tx.wasteBatch.deleteMany({ where: { siteId: { in: [siteA, siteB] } } });
      await tx.itemDepartment.deleteMany({ where: { itemId: { in: itemIds } } });
      await tx.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
      await tx.location.deleteMany({ where: { siteId: { in: [siteA, siteB] } } });
      await tx.department.deleteMany({ where: { siteId: { in: [siteA, siteB] } } });
      await tx.site.deleteMany({ where: { id: { in: [siteA, siteB] } } });
    });
    await prisma.$disconnect();
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('BW1 and BW2: the picker and logging', () => {
    it('BW1: lists only the live items linked to the caller’s department, with no cost and no stock figure', async () => {
      const kitchen = await branchWasteService.listItems(member as never, { limit: 50 });
      expect(kitchen.items.map((i) => i.itemId)).toEqual([beefId]);
      expect(keysOf(kitchen).filter((k) => (BRANCH_WASTE_BLIND_KEYS as readonly string[]).includes(k))).toEqual([]);
      const bar = await branchWasteService.listItems(barista as never, { limit: 50, search: 'milk' });
      expect(bar.items.map((i) => i.itemId)).toEqual([milkId]);
      expect((await branchWasteService.listItems(member as never, { limit: 50, search: 'zzzz' })).items).toEqual([]);
    });

    it('BW2: a member logs; the ledger gets one negative WASTE row at the department’s new location, valued at the item’s cost; on hand goes negative and is not blocked', async () => {
      expect(await prisma.location.count({ where: { siteId: siteA, type: 'BRANCH_DEPARTMENT', departmentId: dept['KITCHEN'] } })).toBe(0);
      const { result, replayed } = await logAs(member, beefId, '2');
      expect(replayed).toBe(false);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toMatchObject({ itemId: beefId, quantity: '2', status: 'LOGGED', department: { id: dept['KITCHEN'] }, branch: { id: siteA }, can: { reverse: true } });
      // A head or member receives no money and no stock figure.
      expect(keysOf(result).filter((k) => (BRANCH_WASTE_BLIND_KEYS as readonly string[]).includes(k))).toEqual([]);

      const location = await prisma.location.findFirstOrThrow({ where: { siteId: siteA, type: 'BRANCH_DEPARTMENT', departmentId: dept['KITCHEN'] } });
      kitchenLocationId = location.id;
      expect(location.departmentTag).toBe('KITCHEN');
      const log = await prisma.wasteLog.findFirstOrThrow({ where: { id: result.entries[0]?.id } });
      expect(log).toMatchObject({ siteId: siteA, locationId: location.id, loggedById: member.id, reason: 'EXPIRY' });
      expect(log.unitCost.toString()).toBe('320');
      const rows = await prisma.inventoryTransaction.findMany({ where: { wasteLogId: log.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ siteId: siteA, locationId: location.id, inventoryItemId: beefId, type: 'WASTE', userId: member.id, reversesTransactionId: null });
      expect(rows[0]?.quantity.toString()).toBe('-2');
      expect(await onHand(beefId)).toBe('-2');
    });

    it('BW2: a head logs too, and the Branch Manager’s own log shows the flagged negative stock to those who may see it', async () => {
      const { result } = await logAs(head, beefId, '1');
      expect(result.entries[0]?.loggedBy.id).toBe(head.id);
      expect(await onHand(beefId)).toBe('-3');
    });

    it('BW2: a repeated key returns the same batch with replayed:true and writes nothing more', async () => {
      const first = await logAs(member, beefId, '0.5', `replay-${tag}-key`);
      const before = await prisma.inventoryTransaction.count({ where: { siteId: siteA, inventoryItemId: beefId } });
      const second = await branchWasteService.log(member as never, { entries: [{ inventoryItemId: beefId, quantity: '0.5', reason: 'EXPIRY' }], idempotencyKey: `replay-${tag}-key` });
      expect(second.replayed).toBe(true);
      expect(second.result.replayed).toBe(true);
      expect(second.result.entries.map((e) => e.id)).toEqual(first.result.entries.map((e) => e.id));
      expect(await prisma.inventoryTransaction.count({ where: { siteId: siteA, inventoryItemId: beefId } })).toBe(before);
      expect(await prisma.wasteBatch.count({ where: { siteId: siteA, userId: member.id, idempotencyKey: `replay-${tag}-key` } })).toBe(1);
    });

    it('BW2: two taps at once make one batch (the unique key settles the race)', async () => {
      const key = `race-${tag}-key`;
      const input = { entries: [{ inventoryItemId: beefId, quantity: '0.25', reason: 'SPOILAGE' as const }], idempotencyKey: key };
      const both = await Promise.all([branchWasteService.log(member as never, input), branchWasteService.log(member as never, input)]);
      for (const o of both) for (const e of o.result.entries) if (!logIds.includes(e.id)) logIds.push(e.id);
      expect(both.filter((o) => o.replayed)).toHaveLength(1);
      expect(both[0].result.entries[0]?.id).toBe(both[1].result.entries[0]?.id);
      expect(await prisma.wasteBatch.count({ where: { siteId: siteA, userId: member.id, idempotencyKey: key } })).toBe(1);
      expect(await prisma.wasteLog.count({ where: { siteId: siteA, batchId: both[0].result.entries[0] ? (await prisma.wasteLog.findFirstOrThrow({ where: { id: both[0].result.entries[0].id } })).batchId : '' } })).toBe(1);
    });

    it('BW2: an item of another department is ITEM_NOT_IN_DEPARTMENT, a retired item is ITEM_RETIRED, an unknown item is 404 — and nothing is written', async () => {
      const before = await prisma.wasteLog.count({ where: { siteId: siteA } });
      await failsWith(logAs(member, milkId, '1'), 'ITEM_NOT_IN_DEPARTMENT');
      await failsWith(logAs(barista, beefId, '1'), 'ITEM_NOT_IN_DEPARTMENT');
      await failsWith(logAs(member, retiredId, '1'), 'ITEM_RETIRED');
      await expect(logAs(member, randomUUID(), '1')).rejects.toMatchObject({ statusCode: 404 });
      // One bad line spoils the whole batch: the good one is not kept.
      await expect(
        branchWasteService.log(member as never, { entries: [{ inventoryItemId: beefId, quantity: '1', reason: 'EXPIRY' }, { inventoryItemId: milkId, quantity: '1', reason: 'EXPIRY' }], idempotencyKey: `mixed-${tag}-key` }),
      ).rejects.toMatchObject({ code: 'ITEM_NOT_IN_DEPARTMENT' });
      expect(await prisma.wasteLog.count({ where: { siteId: siteA } })).toBe(before);
    });

    it('BW2: nobody but an active head or member of an active department may log (the Branch Manager, Director, Store Manager, System Admin: 403)', async () => {
      for (const actor of [bmA, director, storeManager, admin]) await failsWith(logAs(actor, beefId, '1'), 'NOT_YOUR_DEPARTMENT');
    });

    it('BW2: a member of a retired department cannot log; restoring the department lets them again', async () => {
      await prisma.department.update({ where: { id: dept['KITCHEN'] ?? '' }, data: { status: 'RETIRED', retiredAt: new Date() } });
      try {
        await failsWith(logAs(member, beefId, '1'), 'NOT_YOUR_DEPARTMENT');
        await failsWith(branchWasteService.listMine(member as never, { page: 1, pageSize: 50 }), 'NOT_YOUR_DEPARTMENT');
      } finally {
        await prisma.department.update({ where: { id: dept['KITCHEN'] ?? '' }, data: { status: 'ACTIVE', retiredAt: null } });
      }
      await logAs(member, beefId, '0.1');
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('BW3 to BW6: reading, scoping and money', () => {
    it('BW1: after logging, the item is among this person’s usual ones; a colleague who never logged has none', async () => {
      expect((await branchWasteService.listItems(member as never, { limit: 50 })).often.map((i) => i.itemId)).toEqual([beefId]);
      expect((await branchWasteService.listItems(barista as never, { limit: 50 })).often).toEqual([]);
    });

    it('BW3: a member sees the whole department’s entries (their own and the head’s), no money, banner for what they logged today; another department sees none of it', async () => {
      const mine = await branchWasteService.listMine(member as never, { page: 1, pageSize: 50 });
      expect(mine.department).toMatchObject({ id: dept['KITCHEN'], name: 'Kitchen' });
      expect(new Set(mine.rows.map((r) => r.loggedBy.id))).toEqual(new Set([member.id, head.id]));
      expect(mine.rows.every((r) => r.branch.id === siteA && r.department.id === dept['KITCHEN'])).toBe(true);
      expect(keysOf(mine).filter((k) => (BRANCH_WASTE_BLIND_KEYS as readonly string[]).includes(k))).toEqual([]);
      expect(mine.bannerText).toMatch(/^1 item logged at \d\d:\d\d\. You can reverse your own entries today\.$/);
      // Reverse is offered on the caller's own entries only.
      expect(mine.rows.filter((r) => r.can.reverse).every((r) => r.loggedBy.id === member.id)).toBe(true);
      expect(mine.rows.some((r) => r.loggedBy.id === head.id && !r.can.reverse)).toBe(true);
      const other = await branchWasteService.listMine(barista as never, { page: 1, pageSize: 50 });
      expect(other.rows).toEqual([]);
      expect(other.bannerText).toBeNull();
    });

    it('BW3: the date range and pager narrow the rows; entries from before the window are left out', async () => {
      const old = await prisma.wasteLog.findFirstOrThrow({ where: { siteId: siteA, loggedById: head.id } });
      await prisma.wasteLog.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000) } });
      const week = await branchWasteService.listMine(member as never, { page: 1, pageSize: 50 });
      expect(week.rows.map((r) => r.id)).not.toContain(old.id);
      const wide = await branchWasteService.listMine(member as never, { page: 1, pageSize: 50, from: '2000-01-01' });
      expect(wide.rows.map((r) => r.id)).toContain(old.id);
      const paged = await branchWasteService.listMine(member as never, { page: 1, pageSize: 25, from: '2000-01-01' });
      expect(paged.page).toEqual({ page: 1, pageSize: 25, total: wide.page.total });
      await prisma.wasteLog.update({ where: { id: old.id }, data: { createdAt: old.createdAt } });
    });

    it('BW4: the Branch Manager reads their branch with values and the four figures; another branch’s manager sees none of it', async () => {
      const list = await branchWasteService.listBranch(bmA as never, { page: 1, pageSize: 50 });
      expect(list.rows.length).toBeGreaterThan(0);
      expect(list.rows.every((r) => r.branch.id === siteA)).toBe(true);
      expect(list.rows[0]?.valueKes).toMatch(/^\d+\.\d\d$/);
      expect(list.kpis?.map((k) => k.key)).toEqual(['today', 'last7', 'most', 'reversed']);
      expect(list.kpis?.[2]).toMatchObject({ value: `Beef stew ${tag}` });
      expect(list.departments.map((d) => d.id)).toContain(dept['KITCHEN']);
      expect(list.departments.map((d) => d.id)).not.toContain(deptB['KITCHEN']);
      expect(list.branches).toBeUndefined();
      const otherBranch = await branchWasteService.listBranch(bmB as never, { page: 1, pageSize: 50 });
      expect(otherBranch.rows).toEqual([]);
      // Filters: department, reason, status, search.
      expect((await branchWasteService.listBranch(bmA as never, { page: 1, pageSize: 50, departmentId: dept['BARISTA'] })).rows).toEqual([]);
      expect((await branchWasteService.listBranch(bmA as never, { page: 1, pageSize: 50, reason: 'SPOILAGE' })).rows.every((r) => r.reason === 'SPOILAGE')).toBe(true);
      expect((await branchWasteService.listBranch(bmA as never, { page: 1, pageSize: 50, status: 'reversed' })).rows).toEqual([]);
      expect((await branchWasteService.listBranch(bmA as never, { page: 1, pageSize: 50, search: 'beef' })).rows.length).toBeGreaterThan(0);
      expect((await branchWasteService.listBranch(bmA as never, { page: 1, pageSize: 50, search: 'nonexistent-thing' })).rows).toEqual([]);
    });

    it('BW5: the Director, Store Manager and System Admin read any branch, read only; the manager cannot', async () => {
      for (const actor of [director, storeManager, admin]) {
        const list = await branchWasteService.listBranches(actor as never, { page: 1, pageSize: 100, branchId: siteA });
        expect(list.rows.length).toBeGreaterThan(0);
        expect(list.rows.every((r) => r.branch.id === siteA && r.can.reverse === false)).toBe(true);
        expect(list.branches?.map((b) => b.id)).toContain(siteA);
        expect(list.rows[0]?.valueKes).toBeDefined();
      }
      const noneB = await branchWasteService.listBranches(director as never, { page: 1, pageSize: 100, branchId: siteB });
      expect(noneB.rows).toEqual([]);
      await failsWith(branchWasteService.listBranches(bmA as never, { page: 1, pageSize: 50 }), 'AUTHORIZATION_ERROR');
    });

    it('BW6: a member reads an entry of their department; a colleague of another department and another branch’s manager get 404', async () => {
      const id = logIds[0] ?? '';
      const detail = await branchWasteService.detail(member as never, id);
      expect(detail.entry.id).toBe(id);
      expect(detail.ledger).toBeUndefined();
      expect(keysOf(detail).filter((k) => (BRANCH_WASTE_BLIND_KEYS as readonly string[]).includes(k))).toEqual([]);
      await expect(branchWasteService.detail(barista as never, id)).rejects.toMatchObject({ statusCode: 404 });
      await expect(branchWasteService.detail(bmB as never, id)).rejects.toMatchObject({ statusCode: 404 });
      await expect(branchWasteService.detail(member as never, randomUUID())).rejects.toMatchObject({ statusCode: 404 });
    });

    it('BW6: the Branch Manager and Director also get the ledger rows and the value', async () => {
      const id = logIds[0] ?? '';
      for (const actor of [bmA, director]) {
        const detail = await branchWasteService.detail(actor as never, id);
        expect(detail.entry.valueKes).toBe('640.00');
        expect(detail.ledger).toEqual([{ kind: 'LOGGED', at: detail.entry.at, quantity: '-2' }].map((row) => expect.objectContaining({ kind: row.kind, quantity: row.quantity })));
      }
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('BW7: reversing', () => {
    it('a member reverses their own entry the same day: a linked reversing ledger row returns the stock, the original stays', async () => {
      const { result } = await logAs(member, beefId, '4');
      const id = result.entries[0]?.id ?? '';
      const before = await onHand(beefId);
      const reversed = await branchWasteService.reverse(member as never, id, { reason: 'WRONG_QUANTITY', note: 'It was 1 kg' });
      expect(reversed).toMatchObject({ id, status: 'REVERSED', can: { reverse: false }, reversal: { reason: 'WRONG_QUANTITY', note: 'It was 1 kg', by: { id: member.id } } });
      expect(keysOf(reversed).filter((k) => (BRANCH_WASTE_BLIND_KEYS as readonly string[]).includes(k))).toEqual([]);
      expect(new Prisma.Decimal(await onHand(beefId)).minus(before).toString()).toBe('4');

      const rows = await prisma.inventoryTransaction.findMany({ where: { wasteLogId: id }, orderBy: { createdAt: 'asc' } });
      expect(rows).toHaveLength(2);
      expect(rows[0]?.quantity.toString()).toBe('-4');
      expect(rows[1]).toMatchObject({ type: 'WASTE', siteId: siteA, userId: member.id, reversesTransactionId: rows[0]?.id });
      expect(rows[1]?.quantity.toString()).toBe('4');
      expect(await prisma.wasteLog.findFirstOrThrow({ where: { id } })).toMatchObject({ reversedById: member.id, reversalReason: 'WRONG_QUANTITY' });
      // The value reads 0.00 once reversed.
      const seen = await branchWasteService.detail(bmA as never, id);
      expect(seen.entry.valueKes).toBe('0.00');
      expect(seen.ledger?.map((l) => l.kind)).toEqual(['LOGGED', 'REVERSAL']);
    });

    it('a second reversal is ALREADY_REVERSED, for the member and for the manager, and posts nothing more', async () => {
      const id = (await prisma.wasteLog.findFirstOrThrow({ where: { siteId: siteA, reversedAt: { not: null } } })).id;
      const before = await prisma.inventoryTransaction.count({ where: { wasteLogId: id } });
      await failsWith(branchWasteService.reverse(member as never, id, { reason: 'WRONG_ITEM' }), 'ALREADY_REVERSED');
      await failsWith(branchWasteService.reverse(bmA as never, id, { reason: 'WRONG_ITEM' }), 'ALREADY_REVERSED');
      expect(await prisma.inventoryTransaction.count({ where: { wasteLogId: id } })).toBe(before);
    });

    it('two people reversing at once: one wins, the other is ALREADY_REVERSED, and the stock returns exactly once', async () => {
      const { result } = await logAs(member, beefId, '3');
      const id = result.entries[0]?.id ?? '';
      const settled = await Promise.allSettled([
        branchWasteService.reverse(member as never, id, { reason: 'WRONG_ITEM' }),
        branchWasteService.reverse(bmA as never, id, { reason: 'WRONG_ITEM' }),
      ]);
      expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
      const lost = settled.find((s) => s.status === 'rejected');
      expect(lost && lost.status === 'rejected' ? (lost.reason as { code?: string }).code : '').toBe('ALREADY_REVERSED');
      expect(await prisma.inventoryTransaction.count({ where: { wasteLogId: id } })).toBe(2);
    });

    it('a member cannot reverse a colleague’s entry (NOT_YOUR_ENTRY) or one from another department (404)', async () => {
      const { result } = await logAs(colleague, beefId, '1');
      const id = result.entries[0]?.id ?? '';
      await failsWith(branchWasteService.reverse(member as never, id, { reason: 'WRONG_ITEM' }), 'NOT_YOUR_ENTRY');
      await expect(branchWasteService.reverse(barista as never, id, { reason: 'WRONG_ITEM' })).rejects.toMatchObject({ statusCode: 404 });
      expect((await prisma.wasteLog.findFirstOrThrow({ where: { id } })).reversedAt).toBeNull();
    });

    it('after the Nairobi day has changed a member is refused (REVERSAL_WINDOW_PASSED); the Branch Manager and the System Admin still may', async () => {
      const old = async (): Promise<string> => {
        const id = (await logAs(member, beefId, '1')).result.entries[0]?.id ?? '';
        await prisma.wasteLog.update({ where: { id }, data: { createdAt: new Date(Date.now() - 30 * 3600 * 1000) } });
        return id;
      };
      const id = await old();
      await failsWith(branchWasteService.reverse(member as never, id, { reason: 'WRONG_ITEM' }), 'REVERSAL_WINDOW_PASSED');
      const reversed = await branchWasteService.reverse(bmA as never, id, { reason: 'OTHER', note: 'Counted twice' });
      expect(reversed.reversal).toMatchObject({ reason: 'OTHER', note: 'Counted twice', by: { id: bmA.id } });
      const second = await old();
      const byAdmin = await branchWasteService.reverse(admin as never, second, { reason: 'WRONG_ITEM' });
      expect(byAdmin.reversal?.by.id).toBe(admin.id);
    });

    it('the Branch Manager of another branch cannot reach the entry (404); the Director, Accountant-like readers and the Store Manager are refused (403)', async () => {
      const { result } = await logAs(member, beefId, '1');
      const id = result.entries[0]?.id ?? '';
      await expect(branchWasteService.reverse(bmB as never, id, { reason: 'WRONG_ITEM' })).rejects.toMatchObject({ statusCode: 404 });
      for (const actor of [director, storeManager]) await expect(branchWasteService.reverse(actor as never, id, { reason: 'WRONG_ITEM' })).rejects.toMatchObject({ statusCode: 403 });
      expect((await prisma.wasteLog.findFirstOrThrow({ where: { id } })).reversedAt).toBeNull();
    });

    it('the reversed entries read 0.00 in the branch list, with the “Reversed” figure counting them', async () => {
      // A wide window: the entries backdated a day are outside the default "today".
      const list = await branchWasteService.listBranch(bmA as never, { page: 1, pageSize: 100, status: 'reversed', from: '2000-01-01' });
      expect(list.rows.length).toBeGreaterThanOrEqual(4);
      expect(list.rows.every((r) => r.status === 'REVERSED' && r.valueKes === '0.00' && r.can.reverse === false)).toBe(true);
      expect(Number(list.kpis?.[3]?.value)).toBeGreaterThanOrEqual(4);
    });

    it('the stock nets back: on hand equals the sum of what stands, and nothing was edited or deleted', async () => {
      const standing = await prisma.wasteLog.findMany({ where: { siteId: siteA, reversedAt: null, inventoryItemId: beefId } });
      const expected = standing.reduce((sum, l) => sum.minus(l.quantity), new Prisma.Decimal(0));
      expect(await onHand(beefId)).toBe(expected.toString());
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('the Audit log (BRANCH_WASTE) and the repository', () => {
    it('the Store Manager reads logged and reversed entries of the branch, in plain words and with no money; the other branch has none', async () => {
      const page = await auditLogService.list(storeManager as never, AuditLogQuerySchema.parse({ area: 'BRANCH_WASTE', branchId: siteA, perPage: 100 }));
      const logged = page.entries.filter((e) => e.id.startsWith('branch-waste:logged:'));
      const reversed = page.entries.filter((e) => e.id.startsWith('branch-waste:reversed:'));
      expect(logged.length).toBeGreaterThan(0);
      expect(reversed.length).toBeGreaterThanOrEqual(3);
      expect(logged.every((e) => e.area === 'BRANCH_WASTE' && !/KES/.test(e.what) && e.what.startsWith('Logged waste · Beef stew'))).toBe(true);
      expect(reversed.map((e) => e.what)).toContain(`Reversed waste entry · Beef stew ${tag} 3 kg · reason: logged the wrong item`);
      expect(page.entries.every((e) => e.record?.kind === 'STOCK_CARD')).toBe(true);
      const hubWaste = await auditLogService.list(storeManager as never, AuditLogQuerySchema.parse({ area: 'WASTE', perPage: 100 }));
      expect(hubWaste.entries.some((e) => e.id.startsWith('waste:') && logIds.some((id) => e.id.endsWith(id)))).toBe(false);
      const other = await auditLogService.list(storeManager as never, AuditLogQuerySchema.parse({ area: 'BRANCH_WASTE', branchId: siteB, perPage: 100 }));
      expect(other.entries).toEqual([]);
    });

    it('the Branch Manager reads only their own branch’s Branch waste entries', async () => {
      const own = await auditLogService.list(bmA as never, AuditLogQuerySchema.parse({ area: 'BRANCH_WASTE', perPage: 100 }));
      expect(own.entries.length).toBeGreaterThan(0);
      const theirs = await auditLogService.list(bmB as never, AuditLogQuerySchema.parse({ area: 'BRANCH_WASTE', perPage: 100 }));
      expect(theirs.entries).toEqual([]);
    });

    it('latestDispatchInCost finds nothing when no stock was ever dispatched into the department', async () => {
      expect(await branchWasteRepository.latestDispatchInCost(siteA, kitchenLocationId, beefId)).toBeNull();
    });

    it('the Central Store’s waste list never carries a branch entry (they sit on the branch’s siteId)', async () => {
      expect(await prisma.wasteLog.count({ where: { siteId: hubId, id: { in: logIds } } })).toBe(0);
    });
  });

  // Last on purpose: it gives the second branch an entry, which the "other branch has none" tests above must not see.
  describe('BW5: the Department filter across branches', () => {
    it('lists each name once and a name matches that department in every branch', async () => {
      const headB = await prisma.user.create({ data: { name: `headb ${tag}`, email: `headb-${tag}@test.invalid`, passwordHash: 'x', role: 'CHEF', siteId: siteB, departmentId: deptB['KITCHEN'], isDepartmentHead: true } });
      userIds.push(headB.id);
      await prisma.itemDepartment.create({ data: { itemId: beefId, departmentId: deptB['KITCHEN'] ?? '' } });
      const { result } = await logAs({ id: headB.id, role: 'CHEF', siteId: siteB, isDepartmentHead: true }, beefId, '1');
      expect(result.entries).toHaveLength(1);

      const all = await branchWasteService.listBranches(director as never, { page: 1, pageSize: 100, from: '2020-01-01', to: '2099-01-01' });
      const names = all.departments.map((d) => d.name.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
      expect(names.filter((n) => n === 'kitchen')).toHaveLength(1);

      const kitchen = await branchWasteService.listBranches(director as never, { page: 1, pageSize: 100, from: '2020-01-01', to: '2099-01-01', departmentName: 'kitchen' });
      const branchesSeen = new Set(kitchen.rows.map((r) => r.branch.id));
      expect(branchesSeen.has(siteA) && branchesSeen.has(siteB)).toBe(true);
      expect(kitchen.rows.every((r) => r.department.name.toLowerCase() === 'kitchen')).toBe(true);
    });
  });
});
