/**
 * Block 4, Branch day against a REAL database (no mocks of the data layer). Opt-in:
 *   cd backend && RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/branch-day/branch-day.db.test.ts
 * It builds its own two branches, departments (the five originals, one added department with no legacy key and one retired), users,
 * items, stock, a signed dispatch and an open discrepancy, and removes everything it made (the ledger is append-only, so its cleanup
 * lifts that lock inside one transaction, as the dev seed scripts do). Use only the lane's own database, and run it on its own (one
 * file at a time).
 *
 * Covers: the expand migration's back-fill, the first read (one day, one number, even when several people read at once), the
 * department rule and the branch rule on every kind of caller, opening accept and recount (BD2 to BD5), the blind count (BD6 to BD8,
 * no figure to count against, no money), blockers and the close (BD13, BD14: usage entries balanced, linked and numbered with the day
 * number, none for an item that moved nothing, idempotent, no reopen), Used today with received and waste and a zero-use item, the
 * day file, History, Activity, Documents and the stored sheet, the correction (BD20: one linked entry, a second correction, the window
 * per department, replay), the Yesterday column, a day closed under the old flow, an open day the old code made, and siteId scoping.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { hashPin } from '../../../utils/password';
import { allowLedgerEditsInThisTransaction } from '../../../scripts/ledger-dev-bypass';
import { LOCK_WAIT_MS, takeDbTestLock } from '../_shared/db-test-lock';
import { departmentLinks } from '../departments/department-links';
import { deliveriesRepository } from '../deliveries/deliveries-repository';
import type { ZodTypeAny } from 'zod';
import {
  closeDayResultSchema,
  closeSummarySchema,
  correctCountResultSchema,
  countViewSchema,
  DAY_COUNT_BLIND_KEYS,
  DAY_MONEY_KEYS,
  dayActivitySchema,
  dayDocumentsSchema,
  dayEntriesSchema,
  dayFileSchema,
  daySheetSchema,
  departmentFiguresSchema,
  historySchema,
  homeSchema,
  myDaySchema,
  myHistorySchema,
  openingResultSchema,
  openingViewSchema,
  recountPreviewSchema,
  saveCountResultSchema,
  signCountResultSchema,
  todaySchema,
} from './_shared/branch-day-contract';
import { branchDayService as unchecked } from './branch-day-service';

/** Every response of the service is parsed against the frozen contract's schema, so a wire drift fails the test that triggered it. */
const SCHEMAS: Partial<Record<keyof typeof unchecked, ZodTypeAny>> = {
  home: homeSchema,
  opening: openingViewSchema,
  acceptOpening: openingResultSchema,
  previewRecount: recountPreviewSchema,
  recountOpening: openingResultSchema,
  getCount: countViewSchema,
  saveCount: saveCountResultSchema,
  signCount: signCountResultSchema,
  myHistory: myHistorySchema,
  myDay: myDaySchema,
  today: todaySchema,
  departmentFigures: departmentFiguresSchema,
  closeSummary: closeSummarySchema,
  closeDay: closeDayResultSchema,
  history: historySchema,
  dayFile: dayFileSchema,
  activity: dayActivitySchema,
  documents: dayDocumentsSchema,
  entries: dayEntriesSchema,
  correctCount: correctCountResultSchema,
  sheet: daySheetSchema,
};
const branchDayService = Object.fromEntries(
  Object.entries(unchecked).map(([name, fn]) => [
    name,
    async (...args: unknown[]) => {
      const out = await (fn as (...a: unknown[]) => Promise<unknown>)(...args);
      SCHEMAS[name as keyof typeof unchecked]?.parse(out);
      return out;
    },
  ]),
) as typeof unchecked;

const enabled = process.env['RUN_DB_TESTS'] === '1';
const tag = randomUUID().slice(0, 8);
const PIN = '4821';
const DAY_MS = 24 * 60 * 60 * 1000;
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

let releaseDbLock: () => Promise<void> = async () => undefined;
beforeAll(async () => {
  if (enabled) releaseDbLock = await takeDbTestLock();
}, LOCK_WAIT_MS);
afterAll(async () => {
  await releaseDbLock();
});

type Role = 'STORE_MANAGER' | 'MANAGER' | 'DIRECTOR' | 'ACCOUNTANT' | 'SYSTEM_ADMIN' | 'BARISTA' | 'CHEF' | 'WAITER';
type A = { id: string; role: Role; siteId: string | null; isDepartmentHead: boolean };

const keysOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap(keysOf) : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]) : [];

describe.skipIf(!enabled)('Branch day against the real database', () => {
  let hubId = '';
  let siteId = '';
  let otherSiteId = '';
  let code = '';
  const dept: Record<string, string> = {};
  const otherDept: Record<string, string> = {};
  const loc: Record<string, string> = {};
  const item: Record<string, string> = {};
  let storeManager: A;
  let director: A;
  let accountant: A;
  let admin: A;
  let bm: A;
  let bm2: A;
  let kitchenHead: A;
  let baristaHead: A;
  let baristaMember: A;
  let pastryMember: A;
  let labHead: A;
  let retiredMember: A;
  let otherHead: A;
  let waiter: A;
  const userIds: string[] = [];
  const itemIds: string[] = [];
  const requisitionIds: string[] = [];
  const now = new Date();
  const tomorrow = new Date(now.getTime() + DAY_MS);

  let dayId = '';
  let reference = '';
  const key = (name: string): string => `${name}-${tag}-${randomUUID().slice(0, 6)}`;
  const failsWith = async (promise: Promise<unknown>, code_: string): Promise<void> => {
    await expect(promise).rejects.toMatchObject({ code: code_ });
  };
  const position = async (locationId: string, itemId: string): Promise<string> =>
    ((await prisma.inventoryTransaction.aggregate({ where: { locationId, inventoryItemId: itemId }, _sum: { quantity: true } }))._sum.quantity ?? D(0)).toString();
  const dayRows = () =>
    prisma.inventoryTransaction.findMany({ where: { siteId, reference, branchDayLineId: { not: null }, branchDayCorrection: null }, orderBy: { createdAt: 'asc' }, include: { inventoryItem: true } });
  const ledgerCount = (): Promise<number> => prisma.inventoryTransaction.count({ where: { siteId } });

  beforeAll(async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { type: 'CENTRAL_STORE', isHub: true }, select: { id: true, companyId: true } });
    hubId = hub.id;
    code = `Y${tag.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, 'Q')}X`.slice(0, 3);
    const otherCode = `W${tag.slice(2, 4).toUpperCase().replace(/[^A-Z]/g, 'Q')}X`.slice(0, 3);
    const branch = await prisma.site.create({ data: { companyId: hub.companyId, type: 'BRANCH', name: `Day test ${tag}`, code, address: '1 Test Road', city: 'x', latitude: 0, longitude: 0, phone: '0700000000' } });
    const other = await prisma.site.create({ data: { companyId: hub.companyId, type: 'BRANCH', name: `Day test two ${tag}`, code: otherCode, address: 'x', city: 'x', latitude: 0, longitude: 0 } });
    siteId = branch.id;
    otherSiteId = other.id;
    await departmentLinks.provisionBranch({ id: siteId, name: 'x', code });
    await departmentLinks.provisionBranch({ id: otherSiteId, name: 'x', code: otherCode });
    for (const d of await prisma.department.findMany({ where: { siteId }, select: { id: true, key: true } })) if (d.key) dept[d.key] = d.id;
    for (const d of await prisma.department.findMany({ where: { siteId: otherSiteId }, select: { id: true, key: true } })) if (d.key) otherDept[d.key] = d.id;
    // A department added in Block 1 has no legacy key; a retired one cannot count.
    dept['LAB'] = (await prisma.department.create({ data: { siteId, name: 'Prep Lab', key: null, position: 6 } })).id;
    dept['OLD'] = (await prisma.department.create({ data: { siteId, name: 'Old bar', key: null, position: 7, status: 'RETIRED', retiredAt: new Date() } })).id;
    for (const [name, id] of Object.entries(dept)) loc[name] = (await deliveriesRepository.ensureDepartmentLocation(prisma, siteId, id))?.id ?? '';

    const pinHash = await hashPin(PIN);
    const user = async (name: string, role: Role, site: string | null, extra: { departmentId?: string; isDepartmentHead?: boolean } = {}): Promise<A> => {
      const u = await prisma.user.create({ data: { name: `${name} ${tag}`, email: `${name}-${tag}@test.invalid`, passwordHash: 'x', pinHash, role, siteId: site, ...extra } });
      userIds.push(u.id);
      return { id: u.id, role, siteId: site, isDepartmentHead: extra.isDepartmentHead ?? false };
    };
    storeManager = await user('sm', 'STORE_MANAGER', hubId);
    director = await user('dir', 'DIRECTOR', null);
    accountant = await user('acc', 'ACCOUNTANT', hubId);
    admin = await user('adm', 'SYSTEM_ADMIN', null);
    bm = await user('bm', 'MANAGER', siteId);
    bm2 = await user('bm2', 'MANAGER', otherSiteId);
    kitchenHead = await user('kh', 'CHEF', siteId, { departmentId: dept['KITCHEN'], isDepartmentHead: true });
    baristaHead = await user('bh', 'BARISTA', siteId, { departmentId: dept['BARISTA'], isDepartmentHead: true });
    baristaMember = await user('bmem', 'BARISTA', siteId, { departmentId: dept['BARISTA'] });
    pastryMember = await user('pm', 'CHEF', siteId, { departmentId: dept['PASTRY'] });
    labHead = await user('lh', 'CHEF', siteId, { departmentId: dept['LAB'], isDepartmentHead: true });
    retiredMember = await user('rm', 'WAITER', siteId, { departmentId: dept['OLD'] });
    otherHead = await user('oh', 'BARISTA', otherSiteId, { departmentId: otherDept['BARISTA'], isDepartmentHead: true });
    waiter = await user('wt', 'WAITER', siteId);

    const make = async (name: string, cost: number, depts: string[]): Promise<void> => {
      const i = await prisma.inventoryItem.create({ data: { siteId: hubId, name: `${name} ${tag}`, type: 'STOCKED', buyUnit: 'kg', usageUnit: 'kg', departmentTags: [], currentCost: D(cost) } });
      itemIds.push(i.id);
      item[name] = i.id;
      await prisma.itemDepartment.createMany({ data: depts.map((d) => ({ itemId: i.id, departmentId: dept[d] ?? '' })) });
    };
    await make('Oil', 120, ['KITCHEN']);
    await make('Flour', 60, ['KITCHEN', 'PASTRY']);
    await make('Milk', 40, ['BARISTA']);
    await make('Cream', 250, ['BARISTA']);
    await make('Dye', 500, ['LAB']);
    // Opening stock two days ago (before today's Nairobi day starts), at the item's cost.
    const before = new Date(now.getTime() - 2 * DAY_MS);
    const stock = async (dept_: string, name: string, quantity: number, cost: number): Promise<void> => {
      await prisma.inventoryTransaction.create({
        data: { siteId, locationId: loc[dept_] ?? '', inventoryItemId: item[name] ?? '', type: 'DISPATCH_IN', quantity: D(quantity), unitCost: D(cost), userId: storeManager.id, createdAt: before },
      });
    };
    await stock('KITCHEN', 'Oil', 10, 120);
    await stock('KITCHEN', 'Flour', 20, 60);
    await stock('PASTRY', 'Flour', 6, 60);
    await stock('BARISTA', 'Milk', 8, 40);
    await stock('BARISTA', 'Cream', 5, 250);
    await stock('LAB', 'Dye', 3, 500);
  }, 60_000);

  afterAll(async () => {
    if (!enabled) return;
    const sites = [siteId, otherSiteId];
    await prisma.$transaction(async (tx) => {
      await allowLedgerEditsInThisTransaction(tx);
      await tx.branchDayCorrection.deleteMany({ where: { branchDay: { siteId: { in: sites } } } });
      await tx.$executeRaw`UPDATE inventory_transactions SET reverses_transaction_id = NULL WHERE organization_id = ANY(${sites}::text[])`;
      await tx.inventoryTransaction.deleteMany({ where: { OR: [{ siteId: { in: sites } }, { inventoryItemId: { in: itemIds } }] } });
      await tx.wasteLog.deleteMany({ where: { siteId: { in: sites } } });
      const dispatches = await tx.dispatch.findMany({ where: { toSiteId: { in: sites } }, select: { id: true, lines: { select: { id: true } } } });
      await tx.discrepancy.deleteMany({ where: { toSiteId: { in: sites } } });
      await tx.dispatchLine.deleteMany({ where: { dispatchId: { in: dispatches.map((d) => d.id) } } });
      await tx.dispatch.deleteMany({ where: { toSiteId: { in: sites } } });
      await tx.requisition.deleteMany({ where: { id: { in: requisitionIds } } });
      await tx.branchDay.deleteMany({ where: { siteId: { in: sites } } });
      await tx.itemDepartment.deleteMany({ where: { itemId: { in: itemIds } } });
      await tx.referenceCounter.deleteMany({ where: { siteId: { in: sites } } });
      await tx.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
      await tx.location.deleteMany({ where: { siteId: { in: sites } } });
      await tx.department.deleteMany({ where: { siteId: { in: sites } } });
      await tx.site.deleteMany({ where: { id: { in: sites } } });
    });
    await prisma.$disconnect();
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('the expand migration and the first read', () => {
    it('every department row of every branch day and opening is linked to its department, and the id and the legacy key agree', async () => {
      const nullLinks = await prisma.$queryRaw<{ n: bigint }[]>`SELECT (SELECT count(*) FROM branch_day_departments WHERE department_id IS NULL) + (SELECT count(*) FROM department_openings WHERE department_id IS NULL) AS n`;
      expect(Number(nullLinks[0]?.n)).toBe(0);
      const mismatches = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT (SELECT count(*) FROM branch_day_departments b JOIN departments d ON d.id = b.department_id WHERE b.department_tag IS NOT NULL AND d.key IS DISTINCT FROM b.department_tag)
             + (SELECT count(*) FROM department_openings o JOIN departments d ON d.id = o.department_id WHERE o.department_tag IS NOT NULL AND d.key IS DISTINCT FROM o.department_tag) AS n`;
      expect(Number(mismatches[0]?.n)).toBe(0);
    });

    it('a hub reader reading a branch with no day yet sees day: null and creates nothing', async () => {
      const today = await branchDayService.today(director as never, { branchId: siteId });
      expect(today.day).toBeNull();
      expect(today.branches?.some((b) => b.id === siteId)).toBe(true);
      expect(today.can).toEqual({ close: false, countOnBehalf: false });
      expect(await prisma.branchDay.count({ where: { siteId } })).toBe(0);
    });

    it('several people reading first at once make ONE day and take ONE number', async () => {
      const results = await Promise.allSettled([
        branchDayService.home(baristaHead as never),
        branchDayService.home(kitchenHead as never),
        branchDayService.today(bm as never, {}),
        branchDayService.opening(pastryMember as never, {}),
        branchDayService.getCount(labHead as never, {}),
      ]);
      expect(results.every((r) => r.status === 'fulfilled'), JSON.stringify(results.filter((r) => r.status === 'rejected'))).toBe(true);
      const days = await prisma.branchDay.findMany({ where: { siteId }, include: { departments: { include: { lines: true } } } });
      expect(days).toHaveLength(1);
      const day = days[0];
      dayId = day?.id ?? '';
      reference = day?.reference ?? '';
      expect(reference).toBe(`DAY-${code}-0001`);
      expect((await prisma.referenceCounter.findUniqueOrThrow({ where: { siteId_prefix: { siteId, prefix: 'DAY' } } })).lastNumber).toBe(1);
    });

    it('the day holds a row per ACTIVE department (the added one too, with no legacy key, the retired one not) and a line per live item', async () => {
      const day = await prisma.branchDay.findUniqueOrThrow({ where: { id: dayId }, include: { departments: { include: { lines: true, department: true } } } });
      expect(day.departments.map((d) => d.department?.name).sort()).toEqual(['Barista', 'Housekeeping', 'Kitchen', 'Pastry', 'Prep Lab', 'Service']);
      const lab = day.departments.find((d) => d.departmentId === dept['LAB']);
      expect(lab?.departmentTag).toBeNull();
      const lines = Object.fromEntries(day.departments.map((d) => [d.department?.name, d.lines.length]));
      expect(lines).toEqual({ Kitchen: 2, Pastry: 1, Barista: 2, 'Prep Lab': 1, Service: 0, Housekeeping: 0 });
      expect(day.departments.every((d) => d.status === 'NOT_STARTED')).toBe(true);
    });

    it('reading again changes nothing', async () => {
      await branchDayService.today(bm as never, {});
      await branchDayService.home(baristaHead as never);
      expect(await prisma.branchDay.count({ where: { siteId } })).toBe(1);
      expect(await prisma.branchDayLine.count({ where: { department: { branchDayId: dayId } } })).toBe(6);
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('who may call what (the department rule and the branch rule)', () => {
    it('BD1 to BD8: a head or member of an active department, and the Branch Manager on behalf; nobody else', async () => {
      expect((await branchDayService.home(baristaMember as never)).department.name).toBe('Barista');
      expect((await branchDayService.home(labHead as never)).department.name).toBe('Prep Lab');
      for (const who of [bm, director, accountant, storeManager, admin, waiter, retiredMember]) {
        await failsWith(branchDayService.home(who as never), 'NOT_YOUR_DEPARTMENT');
      }
      await failsWith(branchDayService.getCount(baristaHead as never, { departmentId: dept['KITCHEN'] }), 'NOT_YOUR_DEPARTMENT');
      expect((await branchDayService.getCount(baristaHead as never, { departmentId: dept['BARISTA'] })).department.name).toBe('Barista');
      await failsWith(branchDayService.opening(retiredMember as never, {}), 'NOT_YOUR_DEPARTMENT');
      await failsWith(branchDayService.getCount(admin as never, { departmentId: dept['BARISTA'] }), 'NOT_YOUR_DEPARTMENT');
    });

    it('the Branch Manager counts on behalf for a department of their own branch only, and must name it', async () => {
      const view = await branchDayService.getCount(bm as never, { departmentId: dept['KITCHEN'] });
      expect(view.onBehalfOfDepartment).toBe(true);
      await expect(branchDayService.getCount(bm as never, {})).rejects.toMatchObject({ statusCode: 400 });
      await failsWith(branchDayService.getCount(bm2 as never, { departmentId: dept['KITCHEN'] }), 'NOT_YOUR_BRANCH');
      await failsWith(branchDayService.getCount(bm as never, { departmentId: otherDept['BARISTA'] }), 'NOT_YOUR_BRANCH');
    });

    it('BD9 and BD10 are the head’s own: the Branch Manager and every desktop role are refused', async () => {
      for (const who of [bm, director, admin, storeManager]) {
        await failsWith(branchDayService.myHistory(who as never, { page: 1, pageSize: 50 }), 'NOT_YOUR_DEPARTMENT');
        await failsWith(branchDayService.myDay(who as never, dayId), 'NOT_YOUR_DEPARTMENT');
      }
    });

    it('BD11 to BD21: the Branch Manager reads their own branch, the hub roles every branch; heads, members and others are refused', async () => {
      for (const who of [bm, director, accountant, storeManager, admin]) {
        expect((await branchDayService.dayFile(who as never, dayId)).day.id, who.role).toBe(dayId);
        expect((await branchDayService.documents(who as never, dayId)).documents).toEqual([]);
        expect((await branchDayService.history(who as never, { page: 1, pageSize: 50 })).page.total).toBeGreaterThan(0);
      }
      for (const who of [baristaHead, baristaMember, pastryMember, waiter]) {
        await expect(branchDayService.dayFile(who as never, dayId)).rejects.toMatchObject({ statusCode: 403 });
        await expect(branchDayService.today(who as never, {})).rejects.toMatchObject({ statusCode: 403 });
        await expect(branchDayService.history(who as never, { page: 1, pageSize: 50 })).rejects.toMatchObject({ statusCode: 403 });
      }
    });

    it('a Branch Manager of another branch is refused on every endpoint that reads or writes the day by id (siteId scoping)', async () => {
      const dep = dept['BARISTA'] ?? '';
      await failsWith(branchDayService.dayFile(bm2 as never, dayId), 'NOT_YOUR_BRANCH');
      await failsWith(branchDayService.departmentFigures(bm2 as never, dayId, dep), 'NOT_YOUR_BRANCH');
      await failsWith(branchDayService.activity(bm2 as never, dayId, { limit: 5 }), 'NOT_YOUR_BRANCH');
      await failsWith(branchDayService.documents(bm2 as never, dayId), 'NOT_YOUR_BRANCH');
      await failsWith(branchDayService.entries(bm2 as never, dayId, { page: 1, pageSize: 50 }), 'NOT_YOUR_BRANCH');
      await failsWith(branchDayService.sheet(bm2 as never, dayId, {}), 'NOT_YOUR_BRANCH');
      await failsWith(branchDayService.closeSummary(bm2 as never, dayId), 'NOT_YOUR_BRANCH');
      await failsWith(branchDayService.closeDay(bm2 as never, dayId, { pin: PIN, idempotencyKey: key('c') }), 'NOT_YOUR_BRANCH');
      await failsWith(branchDayService.correctCount(bm2 as never, dayId, { departmentId: dep, itemId: item['Milk'] ?? '', closingQty: '1', reason: 'OTHER', pin: PIN, idempotencyKey: key('x') }), 'NOT_YOUR_BRANCH');
      await failsWith(branchDayService.today(bm2 as never, { branchId: siteId }), 'NOT_YOUR_BRANCH');
      await failsWith(branchDayService.history(bm2 as never, { page: 1, pageSize: 50, branchId: siteId }), 'NOT_YOUR_BRANCH');
      // a head of another branch finds no such day at all
      await expect(branchDayService.myDay(otherHead as never, dayId)).rejects.toMatchObject({ statusCode: 404 });
      // and their own history never lists this branch's days
      const mine = await branchDayService.history(bm2 as never, { page: 1, pageSize: 50 });
      expect(mine.rows.every((r) => r.branch.id === otherSiteId)).toBe(true);
    });

    it('the Director, Accountant and Store Manager can neither close nor correct (the System Admin and the Branch Manager can)', async () => {
      for (const who of [director, accountant, storeManager, waiter]) {
        await expect(branchDayService.closeSummary(who as never, dayId)).rejects.toMatchObject({ statusCode: 403 });
        await expect(branchDayService.closeDay(who as never, dayId, { pin: PIN, idempotencyKey: key('c') })).rejects.toMatchObject({ statusCode: 403 });
        await expect(
          branchDayService.correctCount(who as never, dayId, { departmentId: dept['BARISTA'] ?? '', itemId: item['Milk'] ?? '', closingQty: '1', reason: 'OTHER', pin: PIN, idempotencyKey: key('x') }),
        ).rejects.toMatchObject({ statusCode: 403 });
      }
      expect((await branchDayService.closeSummary(admin as never, dayId)).canClose).toBe(false);
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('the opening check (BD2 to BD5)', () => {
    it('BD2: last night’s signed figure (here the ledger at the start of the day), nothing accepted yet, and no money', async () => {
      const view = await branchDayService.opening(kitchenHead as never, {});
      expect(view.check).toMatchObject({ state: 'NOT_CHECKED', checkedAt: null, differences: [] });
      expect(Object.fromEntries(view.lines.map((l) => [l.itemName, l.lastNightQty]))).toEqual({ [`Flour ${tag}`]: '20', [`Oil ${tag}`]: '10' });
      expect(view.lines.every((l) => l.acceptedQty === null)).toBe(true);
      expect(keysOf(view).filter((k) => (DAY_MONEY_KEYS as readonly string[]).includes(k))).toEqual([]);
    });

    it('BD3: accepting is one tap with no PIN and no ledger row; a replay answers the first result; another key is already checked', async () => {
      const before = await ledgerCount();
      const k = key('acc');
      const first = await branchDayService.acceptOpening(kitchenHead as never, { idempotencyKey: k });
      expect(first.replayed).toBe(false);
      expect(first.view.check).toMatchObject({ state: 'ACCEPTED', onBehalf: false, differences: [] });
      expect(first.view.lines.map((l) => l.acceptedQty)).toEqual(first.view.lines.map((l) => l.lastNightQty));
      expect(await ledgerCount()).toBe(before);
      expect((await branchDayService.acceptOpening(kitchenHead as never, { idempotencyKey: k })).replayed).toBe(true);
      await failsWith(branchDayService.acceptOpening(kitchenHead as never, { idempotencyKey: key('acc') }), 'OPENING_ALREADY_CHECKED');
      expect(await prisma.departmentOpening.count({ where: { branchDayId: dayId, departmentId: dept['KITCHEN'] } })).toBe(1);
      const home = await branchDayService.home(kitchenHead as never);
      expect(home.opening.state).toBe('ACCEPTED');
    });

    it('BD4 and BD5: a recount is every item, blind and signed; a difference posts one ADJ- entry linked to the opening line; matches post none', async () => {
      const view = await branchDayService.opening(baristaHead as never, {});
      const lines = view.lines.map((l) => ({ itemId: l.itemId, countedQty: l.itemName.startsWith('Milk') ? '7' : l.lastNightQty }));
      const preview = await branchDayService.previewRecount(baristaHead as never, { lines });
      expect(preview.itemCount).toBe(2);
      expect(preview.matchedItems).toEqual([`Cream ${tag}`]);
      expect(preview.differences).toEqual([{ itemId: item['Milk'], itemName: `Milk ${tag}`, unit: 'kg', lastNightQty: '8', countedQty: '7', difference: '-1' }]);
      expect(await prisma.departmentOpening.count({ where: { branchDayId: dayId, departmentId: dept['BARISTA'] } })).toBe(0);

      await failsWith(branchDayService.recountOpening(baristaHead as never, { lines: lines.slice(0, 1), pin: PIN, idempotencyKey: key('r') }), 'COUNT_INCOMPLETE');
      await failsWith(branchDayService.recountOpening(baristaHead as never, { lines: [...lines, { itemId: item['Oil'] ?? '', countedQty: '1' }], pin: PIN, idempotencyKey: key('r') }), 'ITEM_NOT_IN_DAY');
      await failsWith(branchDayService.recountOpening(baristaHead as never, { lines, pin: '0000', idempotencyKey: key('r') }), 'INVALID_PIN');
      expect(await prisma.departmentOpening.count({ where: { branchDayId: dayId, departmentId: dept['BARISTA'] } })).toBe(0);

      const k = key('r');
      const result = await branchDayService.recountOpening(baristaHead as never, { lines, pin: PIN, idempotencyKey: k });
      expect(result.view.check).toMatchObject({ state: 'RECOUNTED', onBehalf: false });
      expect(result.view.check.differences).toHaveLength(1);
      const entries = await prisma.inventoryTransaction.findMany({ where: { siteId, openingLineId: { not: null }, locationId: loc['BARISTA'] } });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ type: 'ADJUSTMENT', inventoryItemId: item['Milk'], reason: 'Overnight variance', userId: baristaHead.id });
      expect(entries[0]?.quantity.toString()).toBe('-1');
      expect(entries[0]?.reference).toMatch(/^ADJ-\d{4}$/);
      expect(await position(loc['BARISTA'] ?? '', item['Milk'] ?? '')).toBe('7');
      expect((await branchDayService.recountOpening(baristaHead as never, { lines, pin: PIN, idempotencyKey: k })).replayed).toBe(true);
      expect(await prisma.inventoryTransaction.count({ where: { siteId, openingLineId: { not: null } } })).toBe(1);
      await failsWith(branchDayService.recountOpening(baristaHead as never, { lines, pin: PIN, idempotencyKey: key('r') }), 'OPENING_ALREADY_CHECKED');
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('the blind evening count (BD6 to BD8)', () => {
    beforeAll(async () => {
      // A delivery the Barista confirmed today (+5 milk) and one waste entry today (1 milk), as the ledger holds them.
      await prisma.inventoryTransaction.create({ data: { siteId, locationId: loc['BARISTA'] ?? '', inventoryItemId: item['Milk'] ?? '', type: 'DISPATCH_IN', quantity: D(5), unitCost: D(44), userId: storeManager.id } });
      const log = await prisma.wasteLog.create({ data: { siteId, locationId: loc['BARISTA'] ?? '', inventoryItemId: item['Milk'] ?? '', quantity: D(1), reason: 'DAMAGE_IN_STORE', unitCost: D(44), loggedById: baristaHead.id } });
      await prisma.inventoryTransaction.create({ data: { siteId, locationId: loc['BARISTA'] ?? '', inventoryItemId: item['Milk'] ?? '', type: 'WASTE', quantity: D(-1), unitCost: D(44), userId: baristaHead.id, wasteLogId: log.id } });
      // A second waste entry that was reversed counts for nothing.
      await prisma.wasteLog.create({ data: { siteId, locationId: loc['BARISTA'] ?? '', inventoryItemId: item['Milk'] ?? '', quantity: D(3), reason: 'SPOILAGE', unitCost: D(44), loggedById: baristaHead.id, reversedAt: new Date(), reversedById: baristaHead.id, reversalReason: 'WRONG_QUANTITY' } });
    });

    it('BD6: the items, units, categories and what was typed, and NOTHING to count against, no money', async () => {
      const view = await branchDayService.getCount(baristaHead as never, {});
      expect(view).toMatchObject({ state: 'NOT_COUNTED', canSign: false, onBehalfOfDepartment: false, signedAt: null });
      expect(view.summary).toMatchObject({ itemCount: 2, filledCount: 0, blankCount: 2 });
      expect(view.lines.every((l) => l.countedQty === null)).toBe(true);
      const keys = keysOf(view);
      expect(keys.filter((k) => (DAY_COUNT_BLIND_KEYS as readonly string[]).includes(k))).toEqual([]);
      expect(keys.filter((k) => (DAY_MONEY_KEYS as readonly string[]).includes(k))).toEqual([]);
      expect(JSON.stringify(view)).not.toMatch(/"(7|8|11|12)"/);
    });

    it('BD7: stores what was typed (last write wins, null clears), never says whether it matches; unknown items are refused', async () => {
      const milk = item['Milk'] ?? '';
      const saved = await branchDayService.saveCount(baristaMember as never, { lines: [{ itemId: milk, countedQty: '9' }] });
      expect(saved.view.summary).toMatchObject({ filledCount: 1, blankCount: 1 });
      expect(saved.view.canSign).toBe(false);
      expect(keysOf(saved).filter((k) => (DAY_COUNT_BLIND_KEYS as readonly string[]).includes(k) || (DAY_MONEY_KEYS as readonly string[]).includes(k))).toEqual([]);
      await branchDayService.saveCount(baristaHead as never, { lines: [{ itemId: milk, countedQty: null }] });
      expect((await branchDayService.getCount(baristaHead as never, {})).summary.filledCount).toBe(0);
      await failsWith(branchDayService.saveCount(baristaHead as never, { lines: [{ itemId: item['Oil'] ?? '', countedQty: '1' }] }), 'ITEM_NOT_IN_DAY');
      await branchDayService.saveCount(baristaHead as never, { lines: [{ itemId: milk, countedQty: '9' }] });
    });

    it('BD8: every line is filled, the PIN is the signer’s own; a replay returns the first result; a second signing is ALREADY_COUNTED', async () => {
      await failsWith(branchDayService.signCount(baristaHead as never, { pin: PIN, idempotencyKey: key('s') }), 'COUNT_INCOMPLETE');
      await branchDayService.saveCount(baristaHead as never, { lines: [{ itemId: item['Cream'] ?? '', countedQty: '5' }] });
      expect((await branchDayService.getCount(baristaHead as never, {})).canSign).toBe(true);
      await failsWith(branchDayService.signCount(baristaHead as never, { pin: '0000', idempotencyKey: key('s') }), 'INVALID_PIN');
      const k = key('s');
      const signed = await branchDayService.signCount(baristaMember as never, { pin: PIN, idempotencyKey: k });
      expect(signed).toMatchObject({ replayed: false, onBehalf: false });
      expect(signed.view.state).toBe('COUNTED');
      expect(keysOf(signed).filter((x) => (DAY_COUNT_BLIND_KEYS as readonly string[]).includes(x) || (DAY_MONEY_KEYS as readonly string[]).includes(x))).toEqual([]);
      expect((await branchDayService.signCount(baristaMember as never, { pin: PIN, idempotencyKey: k })).replayed).toBe(true);
      await failsWith(branchDayService.signCount(baristaHead as never, { pin: PIN, idempotencyKey: key('s') }), 'ALREADY_COUNTED');
      await failsWith(branchDayService.saveCount(baristaHead as never, { lines: [{ itemId: item['Milk'] ?? '', countedQty: '1' }] }), 'ALREADY_COUNTED');
      const row = await prisma.branchDayDepartment.findFirstOrThrow({ where: { branchDayId: dayId, departmentId: dept['BARISTA'] } });
      expect(row).toMatchObject({ status: 'COUNTED', countedById: baristaMember.id, onBehalf: false });
    });

    it('the Branch Manager counts and signs on behalf with their own PIN, recorded as such', async () => {
      await branchDayService.saveCount(bm as never, { departmentId: dept['KITCHEN'], lines: [{ itemId: item['Oil'] ?? '', countedQty: '8' }, { itemId: item['Flour'] ?? '', countedQty: '20' }] });
      const signed = await branchDayService.signCount(bm as never, { departmentId: dept['KITCHEN'], pin: PIN, idempotencyKey: key('s') });
      expect(signed).toMatchObject({ onBehalf: true, replayed: false });
      expect(signed.view.onBehalfOfDepartment).toBe(true);
      expect(await prisma.branchDayDepartment.findFirstOrThrow({ where: { branchDayId: dayId, departmentId: dept['KITCHEN'] } })).toMatchObject({ countedById: bm.id, onBehalf: true });
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('what blocks the close, and the close (BD13, BD14)', () => {
    let blockingDispatchId = '';
    let closeKey = '';

    it('a department not counted blocks: the summary says so, and BD14 answers DAY_NOT_READY with the blockers', async () => {
      const summary = await branchDayService.closeSummary(bm as never, dayId);
      expect(summary.canClose).toBe(false);
      expect(summary.blockers.filter((b) => b.severity === 'BLOCKS').map((b) => [b.kind, b.department?.name]).sort()).toEqual([
        ['DEPARTMENT_NOT_COUNTED', 'Pastry'],
        ['DEPARTMENT_NOT_COUNTED', 'Prep Lab'],
      ]);
      const err = await branchDayService.closeDay(bm as never, dayId, { pin: PIN, idempotencyKey: key('c') }).catch((e: unknown) => e);
      expect(err).toMatchObject({ code: 'DAY_NOT_READY', statusCode: 409 });
      expect((err as { details: { blockers: unknown[] } }).details.blockers.length).toBeGreaterThan(0);
      expect(await prisma.branchDay.findUniqueOrThrow({ where: { id: dayId } })).toMatchObject({ status: 'OPEN', closedAt: null });
    });

    it('a department with no items (Service, Housekeeping) never blocks and has no opening line', async () => {
      const today = await branchDayService.today(bm as never, {});
      const tiles = Object.fromEntries((today.day?.departments ?? []).map((t) => [t.name, t]));
      expect(tiles['Service']).toMatchObject({ state: 'COUNTED', itemCount: 0, countedAt: null, countedBy: null });
      expect(tiles['Housekeeping']?.state).toBe('COUNTED');
      expect(today.day?.blockers.some((b) => b.department?.name === 'Service')).toBe(false);
    });

    it('a delivery that left the store and is not confirmed blocks, and an open discrepancy never does', async () => {
      const requisition = await prisma.requisition.create({ data: { siteId, type: 'MORNING', reference: `REQ-${code}-${tag.slice(0, 4)}`, status: 'APPROVED', openedById: bm.id, approvedById: bm.id, approvedAt: new Date() } });
      requisitionIds.push(requisition.id);
      const dispatch = await prisma.dispatch.create({
        data: {
          siteId: hubId,
          toSiteId: siteId,
          requisitionId: requisition.id,
          departmentId: dept['KITCHEN'] ?? '',
          reference: `DSP-${code}-0231`,
          status: 'ON_THE_WAY',
          signedById: storeManager.id,
          signedAt: new Date(),
          lines: { create: [{ inventoryItemId: item['Flour'] ?? '', requestedQty: D(2), sentQty: D(2), packedTick: true, unitCostAtDispatch: D(60) }] },
        },
        include: { lines: true },
      });
      blockingDispatchId = dispatch.id;
      const summary = await branchDayService.closeSummary(bm as never, dayId);
      const blocker = summary.blockers.find((b) => b.kind === 'DELIVERY_NOT_CONFIRMED');
      expect(blocker).toMatchObject({ severity: 'BLOCKS', department: { name: 'Kitchen' }, dispatch: { reference: `DSP-${code}-0231` } });
      expect(summary.blockers.some((b) => b.kind === 'DELIVERIES_CONFIRMED')).toBe(false);
      // The delivery is confirmed with a gap that is still open: the tick carries the discrepancy and nothing blocks on it.
      await prisma.dispatch.update({ where: { id: dispatch.id }, data: { status: 'CONFIRMED', countedAt: new Date(), countedById: kitchenHead.id } });
      await prisma.discrepancy.create({ data: { siteId: hubId, toSiteId: siteId, dispatchId: dispatch.id, dispatchLineId: dispatch.lines[0]?.id ?? '', reference: `DSC-${code}-0007`, gapQty: D(-1), status: 'OPEN' } });
      const after = await branchDayService.closeSummary(bm as never, dayId);
      const confirmed = after.blockers.find((b) => b.kind === 'DELIVERIES_CONFIRMED');
      expect(confirmed).toMatchObject({ severity: 'OK', discrepancies: [{ reference: `DSC-${code}-0007` }] });
      expect(after.blockers.some((b) => b.kind === 'DELIVERY_NOT_CONFIRMED')).toBe(false);
      // The Kitchen's delivery shows on its figures as a fact, with the open gap.
      const figures = await branchDayService.departmentFigures(bm as never, dayId, dept['KITCHEN'] ?? '');
      expect(figures.department.delivery).toMatchObject({ state: 'CONFIRMED', gapCount: 1, gapOpen: true, dispatches: [{ reference: `DSP-${code}-0231` }] });
    });

    it('the Pastry member and the added department’s head count; then nothing blocks, with a note for each opening not checked', async () => {
      await branchDayService.saveCount(pastryMember as never, { lines: [{ itemId: item['Flour'] ?? '', countedQty: '5' }] });
      await branchDayService.signCount(pastryMember as never, { pin: PIN, idempotencyKey: key('s') });
      await branchDayService.saveCount(labHead as never, { lines: [{ itemId: item['Dye'] ?? '', countedQty: '4' }] });
      await branchDayService.signCount(labHead as never, { pin: PIN, idempotencyKey: key('s') });
      const summary = await branchDayService.closeSummary(bm as never, dayId);
      expect(summary.canClose).toBe(true);
      expect(summary.blockers.filter((b) => b.severity === 'BLOCKS')).toEqual([]);
      expect(summary.blockers.find((b) => b.kind === 'ALL_COUNTED')?.severity).toBe('OK');
      expect(summary.blockers.filter((b) => b.kind === 'OPENING_NOT_CHECKED').map((b) => b.department?.name).sort()).toEqual(['Pastry', 'Prep Lab']);
      // four items moved (Milk, Oil, Pastry's Flour, the Dye); Cream and the Kitchen's Flour moved nothing
      expect(summary.entryCount).toBe(4);
    });

    it('a wrong PIN, another role and a Director are refused and nothing is written', async () => {
      const before = await ledgerCount();
      await failsWith(branchDayService.closeDay(bm as never, dayId, { pin: '0000', idempotencyKey: key('c') }), 'INVALID_PIN');
      await expect(branchDayService.closeDay(director as never, dayId, { pin: PIN, idempotencyKey: key('c') })).rejects.toMatchObject({ statusCode: 403 });
      expect(await ledgerCount()).toBe(before);
      expect((await prisma.branchDay.findUniqueOrThrow({ where: { id: dayId } })).status).toBe('OPEN');
    });

    it('BD14: closes with the Branch Manager’s own PIN, one usage entry per item that moved, none for an item that did not', async () => {
      closeKey = key('close');
      const before = await ledgerCount();
      const result = await branchDayService.closeDay(bm as never, dayId, { pin: PIN, idempotencyKey: closeKey });
      expect(result).toMatchObject({ replayed: false, entryCount: 4, day: { status: 'CLOSED', reference } });
      expect(result.closedBy.id).toBe(bm.id);
      expect(result.entries.length).toBeLessThanOrEqual(5);
      expect(result.document).toMatchObject({ version: 1, kind: 'AT_THE_CLOSE', latest: true, reference });
      expect(await ledgerCount()).toBe(before + 4);

      const entries = await dayRows();
      expect(entries).toHaveLength(4);
      for (const e of entries) {
        expect(e).toMatchObject({ type: 'ADJUSTMENT', reference, reason: 'Used today', userId: bm.id, siteId });
        expect(e.branchDayLineId).not.toBeNull();
      }
      const byItem = Object.fromEntries(entries.map((e) => [e.inventoryItem.name.replace(` ${tag}`, ''), e.quantity.toString()]));
      // Milk: opening 7 (recounted) + 5 received − 1 waste − 9 counted = used 2, the ledger held 11 so the entry is −2.
      // Oil: opening 10, counted 8: −2. Flour (Pastry): 6 → 5: −1. Dye: 3 → 4: +1, a surplus, shown as it is.
      expect(byItem).toEqual({ Milk: '-2', Oil: '-2', Flour: '-1', Dye: '1' });
      // The day's entries carry the day number and take nothing from the ADJ counter: only the one opening recount did.
      expect((await prisma.referenceCounter.findUniqueOrThrow({ where: { siteId_prefix: { siteId, prefix: 'ADJ' } } })).lastNumber).toBe(1);
    });

    it('after the close the ledger equals the count for every line, and the day is balanced', async () => {
      const lines = await prisma.branchDayLine.findMany({ where: { department: { branchDayId: dayId } }, include: { department: true } });
      for (const line of lines) {
        const onHand = await position(line.department.locationId, line.inventoryItemId);
        expect(onHand, `${line.inventoryItemId}`).toBe(line.countedQty?.toString());
      }
    });

    it('freezes opening, received, waste, unit cost and Used today on each line, and the day’s totals', async () => {
      const figures = await branchDayService.departmentFigures(bm as never, dayId, dept['BARISTA'] ?? '');
      const lines = Object.fromEntries(figures.department.lines.map((l) => [l.itemName.replace(` ${tag}`, ''), l]));
      expect(lines['Milk']).toMatchObject({ openingQty: '7', receivedQty: '5', wasteQty: '1', closingQty: '9', usedQty: '2', yesterdayUsedQty: null, correction: null });
      // A reversed waste entry (3) counts for nothing, and a zero-use item reads 0.
      expect(lines['Cream']).toMatchObject({ openingQty: '5', receivedQty: '0', wasteQty: '0', closingQty: '5', usedQty: '0' });
      expect(figures.department.waste).toEqual({ entryCount: 1, items: [{ itemName: `Milk ${tag}`, reasonText: 'Damaged in store' }] });
      expect(figures.department.totals?.usedValueKes).toBeDefined();
      const dye = await branchDayService.departmentFigures(bm as never, dayId, dept['LAB'] ?? '');
      expect(dye.department.lines[0]).toMatchObject({ openingQty: '3', closingQty: '4', usedQty: '-1' });
      const day = await prisma.branchDay.findUniqueOrThrow({ where: { id: dayId } });
      // Used value: Milk 2 × 44 (the latest delivery cost) + Oil 2 × 120 + Flour 1 × 60 + Dye −1 × 500 + zero-use items.
      expect(day.usedValue?.toFixed(2)).toBe(D(2 * 44 + 2 * 120 + 60 - 500).toFixed(2));
      expect(day).toMatchObject({ status: 'CLOSED', closedById: bm.id, closeIdempotencyKey: closeKey });
    });

    it('a replay returns the first result and writes nothing; any other key is DAY_ALREADY_CLOSED; there is no reopen', async () => {
      const before = await ledgerCount();
      const replay = await branchDayService.closeDay(bm as never, dayId, { pin: PIN, idempotencyKey: closeKey });
      expect(replay).toMatchObject({ replayed: true, entryCount: 4, day: { reference } });
      await failsWith(branchDayService.closeDay(bm as never, dayId, { pin: PIN, idempotencyKey: key('c') }), 'DAY_ALREADY_CLOSED');
      expect(await ledgerCount()).toBe(before);
      expect(await prisma.inventoryTransaction.count({ where: { siteId, reference } })).toBe(4);
      expect(await prisma.branchDaySheet.count({ where: { branchDayId: dayId } })).toBe(1);
      expect(Object.keys(branchDayService)).not.toContain('reopenDay');
    });

    it('nothing counts, opens or saves on a closed day', async () => {
      await failsWith(branchDayService.signCount(bm as never, { departmentId: dept['KITCHEN'], pin: PIN, idempotencyKey: key('s') }), 'DAY_ALREADY_CLOSED');
      await failsWith(branchDayService.saveCount(bm as never, { departmentId: dept['KITCHEN'], lines: [{ itemId: item['Oil'] ?? '', countedQty: '1' }] }), 'DAY_ALREADY_CLOSED');
      await failsWith(branchDayService.acceptOpening(bm as never, { departmentId: dept['KITCHEN'], idempotencyKey: key('a') }), 'DAY_ALREADY_CLOSED');
    });

    it('waste logged after the close does not change the closed day', async () => {
      await prisma.wasteLog.create({ data: { siteId, locationId: loc['BARISTA'] ?? '', inventoryItemId: item['Cream'] ?? '', quantity: D(2), reason: 'EXPIRY', unitCost: D(250), loggedById: baristaHead.id } });
      const figures = await branchDayService.departmentFigures(bm as never, dayId, dept['BARISTA'] ?? '');
      expect(figures.department.lines.find((l) => l.itemName.startsWith('Cream'))).toMatchObject({ wasteQty: '0', usedQty: '0' });
      await prisma.dispatch.update({ where: { id: blockingDispatchId }, data: { status: 'CLOSED' } });
    });

    it('BD11 on the closed day carries who closed it, the entry count and the first five entries', async () => {
      const today = await branchDayService.today(bm as never, {});
      expect(today.day?.head.status).toBe('CLOSED');
      expect(today.day?.canClose).toBe(false);
      expect(today.day?.closed).toMatchObject({ entryCount: 4, by: { id: bm.id } });
      expect(today.day?.closed?.entries.every((e) => e.reference === reference && e.kind === 'USAGE')).toBe(true);
      expect(today.can).toEqual({ close: true, countOnBehalf: true });
      const hub = await branchDayService.today(director as never, { branchId: siteId });
      expect(hub.can).toEqual({ close: false, countOnBehalf: false });
      expect(hub.day?.closed?.entryCount).toBe(4);
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('the head’s past days (BD9, BD10) and money', () => {
    it('BD9: the department’s closed days, last 30 days by default, with no money; another department’s days are not listed', async () => {
      const history = await branchDayService.myHistory(baristaHead as never, { page: 1, pageSize: 50 });
      expect(history.department.name).toBe('Barista');
      expect(history.rows).toEqual([expect.objectContaining({ id: dayId, reference, status: 'CLOSED', itemsCounted: 2, correctedCount: 0 })]);
      expect(history.page.total).toBe(1);
      expect(keysOf(history).filter((k) => (DAY_MONEY_KEYS as readonly string[]).includes(k))).toEqual([]);
      expect((await branchDayService.myHistory(baristaHead as never, { page: 1, pageSize: 50, status: 'CORRECTED' })).rows).toEqual([]);
      const none = await branchDayService.myHistory(baristaHead as never, { page: 1, pageSize: 50, from: '2020-01-01', to: '2020-01-31' });
      expect(none.rows).toEqual([]);
    });

    it('BD10: one past day, quantities only, only the caller’s own department', async () => {
      const day = await branchDayService.myDay(baristaHead as never, dayId);
      expect(day.department.name).toBe('Barista');
      expect(day.lines).toHaveLength(2);
      expect(day.lines.find((l) => l.itemName.startsWith('Milk'))).toMatchObject({ openingQty: '7', receivedQty: '5', wasteQty: '1', closingQty: '9', usedQty: '2' });
      expect(keysOf(day).filter((k) => (DAY_MONEY_KEYS as readonly string[]).includes(k))).toEqual([]);
      expect(JSON.stringify(day)).not.toMatch(/Oil|Dye|Flour/);
    });

    it('no endpoint a head or member can reach carries money (home, opening, count, history, day)', async () => {
      const everything = [
        await branchDayService.home(baristaHead as never),
        await branchDayService.opening(baristaHead as never, {}),
        await branchDayService.getCount(baristaHead as never, {}),
        await branchDayService.myHistory(baristaHead as never, { page: 1, pageSize: 50 }),
        await branchDayService.myDay(baristaHead as never, dayId),
      ];
      expect(keysOf(everything).filter((k) => (DAY_MONEY_KEYS as readonly string[]).includes(k))).toEqual([]);
    });

    it('the Branch Manager and every desktop reader do see money', async () => {
      for (const who of [bm, director, accountant, storeManager, admin]) {
        const figures = await branchDayService.departmentFigures(who as never, dayId, dept['BARISTA'] ?? '');
        expect(figures.department.lines[0]?.unitCostKes, who.role).toBeDefined();
        expect(figures.branchUsedValueKes, who.role).toBeDefined();
        expect((await branchDayService.dayFile(who as never, dayId)).usedValueKes, who.role).toBeDefined();
      }
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('the day file, History, Activity, Documents and the sheet (BD15 to BD19, BD21)', () => {
    it('BD16: the tracker, the rail, the tab counts and what can be done', async () => {
      const file = await branchDayService.dayFile(bm as never, dayId);
      expect(file.tracker.openingsChecked).toEqual({ checked: 2, total: 6 });
      expect(file.tracker.counted.counted).toBe(6);
      expect(file.tracker.closed.by?.id).toBe(bm.id);
      expect(file.rail.map((t) => t.name)).toEqual(['Kitchen', 'Barista', 'Pastry', 'Service', 'Housekeeping', 'Prep Lab']);
      expect(file.tabCounts.documents).toBe(1);
      expect(file.can).toEqual({ correct: true, print: true });
      expect((await branchDayService.dayFile(director as never, dayId)).can).toEqual({ correct: false, print: true });
    });

    it('BD17: Activity, newest first, five by default with the whole count; the sentences are the contract’s', async () => {
      const all = await branchDayService.activity(bm as never, dayId, { limit: 50 });
      expect(all.total).toBe(all.entries.length);
      expect(all.entries[0]).toMatchObject({ type: 'DAY_CLOSED', actor: { id: bm.id } });
      expect(all.entries[0]?.sentence).toMatch(/^Closed the day · Used today KES /);
      const sentences = all.entries.map((e) => e.sentence);
      expect(sentences).toContain('Checked the opening: Kitchen, same as last night');
      expect(sentences).toContain(`Recorded the opening: Milk ${tag}, 1 less than last night (8 → 7)`);
      expect(sentences).toContain('Counted and signed: Barista, 2 items');
      expect(sentences).toContain('Counted and signed on behalf of Kitchen: 2 items');
      expect(all.entries.find((e) => e.type === 'DAY_CLOSED')?.link).toMatchObject({ kind: 'DAY', id: dayId, reference });
      const five = await branchDayService.activity(bm as never, dayId, { limit: 5 });
      expect(five.entries).toHaveLength(5);
      expect(five.total).toBe(all.total);
      expect(JSON.stringify(all)).not.toMatch(/signed with pin/i);
    });

    it('BD18 and BD21: the sheet made at the close is kept whole; printing returns the stored copy with printedAt now and writes nothing', async () => {
      const docs = await branchDayService.documents(bm as never, dayId);
      expect(docs.documents).toEqual([expect.objectContaining({ version: 1, kind: 'AT_THE_CLOSE', latest: true, reference })]);
      const printedAt = new Date('2026-12-01T10:00:00.000Z');
      const sheet = await branchDayService.sheet(bm as never, dayId, {}, printedAt);
      expect(sheet).toMatchObject({ reference, version: 1, kind: 'AT_THE_CLOSE', correctedAt: null, printedAt: printedAt.toISOString(), branch: { name: `Day test ${tag}`, code } });
      expect(sheet.departments.map((d) => [d.department.name, d.page])).toEqual([['Kitchen', 2], ['Barista', 3], ['Pastry', 4], ['Service', 5], ['Housekeeping', 6], ['Prep Lab', 7]]);
      expect(sheet.pageCount).toBe(7);
      expect(sheet.notes.openingNotChecked.sort()).toEqual(['Pastry', 'Prep Lab']);
      expect(sheet.notes.openDiscrepancies).toEqual([{ reference: `DSC-${code}-0007`, departmentName: 'Kitchen', itemName: `Flour ${tag}` }]);
      expect(sheet.qrUrl).toContain(`/app/branch/day/history/${dayId}`);
      const again = await branchDayService.sheet(bm as never, dayId, {}, new Date('2026-12-02T10:00:00.000Z'));
      expect({ ...again, printedAt: '' }).toEqual({ ...sheet, printedAt: '' });
      expect(await prisma.branchDaySheet.count({ where: { branchDayId: dayId } })).toBe(1);
      await expect(branchDayService.sheet(bm as never, dayId, { version: 9 })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('BD19: every ledger entry carrying the day number, newest first', async () => {
      const entries = await branchDayService.entries(bm as never, dayId, { page: 1, pageSize: 25 });
      expect(entries.page.total).toBe(4);
      expect(entries.rows.every((r) => r.reference === reference && r.kind === 'USAGE')).toBe(true);
    });

    it('BD15: History by day number, status and dates; the hub roles may name a branch; open days show no values', async () => {
      const mine = await branchDayService.history(bm as never, { page: 1, pageSize: 50, q: reference });
      expect(mine.rows).toHaveLength(1);
      expect(mine.rows[0]).toMatchObject({ id: dayId, reference, departmentsCounted: 6, departmentsTotal: 6, status: 'CLOSED', closedBy: { id: bm.id }, branch: { id: siteId, code } });
      expect(mine.rows[0]?.usedValueKes).toBeDefined();
      expect(mine.branches).toBeUndefined();
      expect((await branchDayService.history(bm as never, { page: 1, pageSize: 50, q: '0001' })).rows.map((r) => r.id)).toContain(dayId);
      expect((await branchDayService.history(bm as never, { page: 1, pageSize: 50, status: 'OPEN' })).rows).toEqual([]);
      const hub = await branchDayService.history(director as never, { page: 1, pageSize: 50, branchId: siteId });
      expect(hub.rows.map((r) => r.id)).toContain(dayId);
      expect(hub.branches?.some((b) => b.id === siteId)).toBe(true);
      const pageTwo = await branchDayService.history(director as never, { page: 2, pageSize: 25, branchId: siteId });
      expect(pageTwo.rows).toEqual([]);
      expect(pageTwo.page).toMatchObject({ page: 2, pageSize: 25, total: 1 });
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('correct a count (BD20)', () => {
    const correct = (who: A, over: Partial<{ departmentId: string; itemId: string; closingQty: string; reason: 'COUNTED_WRONGLY' | 'ITEM_WAS_MISSED' | 'OTHER'; note: string; pin: string; idempotencyKey: string; day: string }> = {}) =>
      branchDayService.correctCount(who as never, over.day ?? dayId, {
        departmentId: over.departmentId ?? dept['BARISTA'] ?? '',
        itemId: over.itemId ?? item['Milk'] ?? '',
        closingQty: over.closingQty ?? '10',
        reason: over.reason ?? 'COUNTED_WRONGLY',
        ...(over.note ? { note: over.note } : {}),
        pin: over.pin ?? PIN,
        idempotencyKey: over.idempotencyKey ?? key('fix'),
      });
    let firstKey = '';

    it('refuses what it should: a wrong PIN, no change, a department that never counted, an item that is not on the department’s day', async () => {
      const before = await ledgerCount();
      await failsWith(correct(bm, { pin: '0000' }), 'INVALID_PIN');
      await failsWith(correct(bm, { closingQty: '9' }), 'CORRECTION_NO_CHANGE');
      await failsWith(correct(bm, { departmentId: dept['SERVICE'] ?? '' }), 'DEPARTMENT_NOT_COUNTED');
      await failsWith(correct(bm, { departmentId: dept['PASTRY'] ?? '', itemId: item['Milk'] ?? '' }), 'ITEM_NOT_IN_DAY');
      await failsWith(correct(bm, { itemId: item['Oil'] ?? '' }), 'ITEM_NOT_IN_DAY');
      expect(await ledgerCount()).toBe(before);
      expect(await prisma.branchDayCorrection.count({ where: { branchDayId: dayId } })).toBe(0);
    });

    it('posts ONE linked entry of the change, keeps both figures, updates the totals and makes the next sheet version', async () => {
      const dayBefore = await prisma.branchDay.findUniqueOrThrow({ where: { id: dayId } });
      const before = await ledgerCount();
      firstKey = key('fix');
      const result = await correct(bm, { closingQty: '10', note: 'Counted the wrong shelf', idempotencyKey: firstKey });
      expect(result.replayed).toBe(false);
      expect(result.day.status).toBe('CORRECTED');
      expect(result.entry).toMatchObject({ kind: 'CORRECTION', quantity: '1', reference });
      expect(result.line).toMatchObject({ closingQty: '10', usedQty: '1', correction: { fromClosingQty: '9', toClosingQty: '10', fromUsedQty: '2', toUsedQty: '1', reason: 'COUNTED_WRONGLY', note: 'Counted the wrong shelf', by: { id: bm.id } } });
      expect(result.document).toMatchObject({ version: 2, kind: 'AFTER_CORRECTION', latest: true });
      expect(await ledgerCount()).toBe(before + 1);

      const entry = await prisma.inventoryTransaction.findUniqueOrThrow({ where: { id: result.entry.id }, include: { branchDayCorrection: true } });
      expect(entry).toMatchObject({ type: 'ADJUSTMENT', reference, reason: 'Count corrected: Counted wrongly', userId: bm.id, reversesTransactionId: null });
      expect(entry.branchDayLineId).not.toBeNull();
      expect(entry.branchDayCorrection).toMatchObject({ sheetVersion: 2, correctedById: bm.id });
      expect(await position(loc['BARISTA'] ?? '', item['Milk'] ?? '')).toBe('10');

      const dayAfter = await prisma.branchDay.findUniqueOrThrow({ where: { id: dayId } });
      expect(dayAfter.usedValue?.toString()).toBe(dayBefore.usedValue?.minus(44).toString());
      expect(dayAfter.closingValue?.toString()).toBe(dayBefore.closingValue?.plus(44).toString());
      // The original close, its entries and its sheet stay.
      expect(await prisma.inventoryTransaction.count({ where: { siteId, reference, branchDayCorrection: null } })).toBe(4);
      expect(await prisma.branchDaySheet.count({ where: { branchDayId: dayId } })).toBe(2);
      const sheet = await branchDayService.sheet(bm as never, dayId, {});
      expect(sheet).toMatchObject({ version: 2, kind: 'AFTER_CORRECTION' });
      expect(sheet.correctedAt).not.toBeNull();
      expect(sheet.corrections).toEqual([expect.objectContaining({ departmentName: 'Barista', fromClosingQty: '9', toClosingQty: '10', reason: 'COUNTED_WRONGLY' })]);
      const milk = sheet.departments.find((d) => d.department.name === 'Barista')?.lines.find((l) => l.itemName.startsWith('Milk'));
      expect(milk).toMatchObject({ closingQty: '10', usedQty: '1', correction: { fromClosingQty: '9', toClosingQty: '10' } });
      expect(sheet.departments.find((d) => d.department.name === 'Barista')?.corrected).toBe(true);
      // the version made at the close is kept as made
      const v1 = await branchDayService.sheet(bm as never, dayId, { version: 1 });
      expect(v1.corrections).toEqual([]);
      expect(v1.departments.find((d) => d.department.name === 'Barista')?.lines.find((l) => l.itemName.startsWith('Milk'))).toMatchObject({ closingQty: '9', correction: null });
    });

    it('a replay returns the first result and writes nothing', async () => {
      const before = await ledgerCount();
      const replay = await correct(bm, { closingQty: '10', note: 'Counted the wrong shelf', idempotencyKey: firstKey });
      expect(replay.replayed).toBe(true);
      expect(replay.entry.quantity).toBe('1');
      expect(await ledgerCount()).toBe(before);
      expect(await prisma.branchDayCorrection.count({ where: { branchDayId: dayId } })).toBe(1);
    });

    it('the same item may be corrected again, from the figure then on the line; the System Admin may correct with their own PIN', async () => {
      const second = await correct(admin, { closingQty: '11', reason: 'OTHER', idempotencyKey: key('fix') });
      expect(second.line.correction).toMatchObject({ fromClosingQty: '9', toClosingQty: '11', fromUsedQty: '2', toUsedQty: '0', by: { id: admin.id } });
      expect(second.entry.quantity).toBe('1');
      expect(second.document.version).toBe(3);
      const corrections = await prisma.branchDayCorrection.findMany({ where: { branchDayId: dayId }, orderBy: { correctedAt: 'asc' } });
      expect(corrections.map((c) => [c.fromClosingQty.toString(), c.toClosingQty.toString()])).toEqual([['9', '10'], ['10', '11']]);
      expect(await position(loc['BARISTA'] ?? '', item['Milk'] ?? '')).toBe('11');
    });

    it('Activity and the day file show the corrections; the History status reads Corrected', async () => {
      const activity = await branchDayService.activity(bm as never, dayId, { limit: 50 });
      const fixes = activity.entries.filter((e) => e.type === 'COUNT_CORRECTED');
      expect(fixes).toHaveLength(2);
      expect(fixes[0]?.link).toMatchObject({ kind: 'LEDGER_ENTRY', reference });
      expect(fixes.map((f) => f.sentence).sort()).toEqual([`Corrected a count: Milk ${tag} (Barista), closing stock 10 → 11`, `Corrected a count: Milk ${tag} (Barista), closing stock 9 → 10`]);
      expect(fixes.find((f) => f.sentence.endsWith('9 → 10'))?.detail).toBe('Reason: counted wrongly. Note: Counted the wrong shelf Signed with PIN.');
      const file = await branchDayService.dayFile(bm as never, dayId);
      expect(file.day.status).toBe('CORRECTED');
      expect(file.lastCorrection).toMatchObject({ itemName: `Milk ${tag}`, departmentName: 'Barista', fromClosingQty: '10', toClosingQty: '11' });
      expect((await branchDayService.history(bm as never, { page: 1, pageSize: 50, status: 'CORRECTED' })).rows.map((r) => r.id)).toEqual([dayId]);
      expect((await branchDayService.history(bm as never, { page: 1, pageSize: 50, status: 'CLOSED' })).rows).toEqual([]);
      expect((await branchDayService.myHistory(baristaHead as never, { page: 1, pageSize: 50 })).rows[0]).toMatchObject({ status: 'CORRECTED', correctedCount: 2 });
      expect((await branchDayService.entries(bm as never, dayId, { page: 1, pageSize: 25 })).page.total).toBe(6);
    });

    it('the window is per department: closed by the Barista’s next opening, open for the Kitchen', async () => {
      const lastNight = await branchDayService.opening(baristaHead as never, {}, tomorrow);
      const milkNight = lastNight.lines.find((l) => l.itemName.startsWith('Milk'));
      // Last night's signed figure is the closing as corrected (11), not what was first signed.
      expect(milkNight?.lastNightQty).toBe('11');
      expect(lastNight.lastCloseAt).not.toBeNull();
      await branchDayService.acceptOpening(baristaHead as never, { idempotencyKey: key('acc') }, tomorrow);
      await failsWith(correct(bm, { closingQty: '12', idempotencyKey: key('fix') }), 'CORRECTION_WINDOW_PASSED');
      const figures = await branchDayService.departmentFigures(bm as never, dayId, dept['BARISTA'] ?? '');
      expect(figures.department.can.correct).toBe(false);
      const kitchen = await branchDayService.departmentFigures(bm as never, dayId, dept['KITCHEN'] ?? '');
      expect(kitchen.department.can.correct).toBe(true);
      const fix = await correct(bm, { departmentId: dept['KITCHEN'] ?? '', itemId: item['Oil'] ?? '', closingQty: '9', reason: 'ITEM_WAS_MISSED', idempotencyKey: key('fix') });
      expect(fix.entry.quantity).toBe('1');
      expect(fix.line).toMatchObject({ closingQty: '9', usedQty: '1' });
    });

    it('a correction needs a closed day', async () => {
      const open = await prisma.branchDay.findFirstOrThrow({ where: { siteId, status: 'OPEN' } });
      await failsWith(correct(bm, { day: open.id }), 'DAY_NOT_CLOSED');
      await failsWith(branchDayService.sheet(bm as never, open.id, {}), 'DAY_NOT_CLOSED');
    });

    it('the Yesterday column: the same item’s frozen Used today the calendar day before, null when nothing closed', async () => {
      const day = await prisma.branchDay.findFirstOrThrow({ where: { siteId, status: 'OPEN' } });
      const figures = await branchDayService.departmentFigures(bm as never, day.id, dept['BARISTA'] ?? '');
      const milk = figures.department.lines.find((l) => l.itemName.startsWith('Milk'));
      // Milk's Used today on the closed day, after the two corrections (2 → 1 → 0).
      expect(milk?.yesterdayUsedQty).toBe('0');
      expect(milk).toMatchObject({ openingQty: '11', closingQty: null, usedQty: null });
      expect(figures.department.opening.state).toBe('ACCEPTED');
      const today = await branchDayService.departmentFigures(bm as never, dayId, dept['BARISTA'] ?? '');
      expect(today.department.lines[0]?.yesterdayUsedQty).toBeNull();
    });
  });

  // ------------------------------------------------------------------------------------------------------------------------------
  describe('days the old code made', () => {
    it('a day closed under the old flow reads Closed with no Used value; its file shows closing figures only and it cannot be corrected', async () => {
      const date = new Date(`${new Date(now.getTime() - 5 * DAY_MS).toISOString().slice(0, 10)}T00:00:00.000Z`);
      const old = await prisma.branchDay.create({
        data: {
          siteId,
          businessDate: date,
          status: 'CLOSED',
          reference: 'DAY-0012',
          closedById: bm.id,
          closedAt: new Date(date.getTime() + 18 * 60 * 60 * 1000),
          closingValue: D(1200),
          departments: { create: [{ departmentId: dept['KITCHEN'], departmentTag: 'KITCHEN', locationId: loc['KITCHEN'] ?? '', status: 'COUNTED', countedById: bm.id, countedAt: new Date(), lines: { create: [{ inventoryItemId: item['Oil'] ?? '', countedQty: D(4), expectedQty: D(5), unitCost: D(120) }] } }] },
        },
        include: { departments: { include: { lines: true } } },
      });
      const history = await branchDayService.history(bm as never, { page: 1, pageSize: 50, from: date.toISOString().slice(0, 10), to: date.toISOString().slice(0, 10) });
      expect(history.rows).toEqual([expect.objectContaining({ id: old.id, reference: 'DAY-0012', status: 'CLOSED', usedValueKes: null, closingValueKes: '1200.00' })]);
      const figures = await branchDayService.departmentFigures(bm as never, old.id, dept['KITCHEN'] ?? '');
      expect(figures.department.lines).toEqual([expect.objectContaining({ closingQty: '4', usedQty: null })]);
      expect(figures.department.can.correct).toBe(false);
      expect((await branchDayService.dayFile(bm as never, old.id)).can.correct).toBe(false);
      await expect(correctOld(old.id)).rejects.toMatchObject({ statusCode: 400 });
      await expect(branchDayService.sheet(bm as never, old.id, {})).rejects.toMatchObject({ statusCode: 404 });
      await expect(branchDayService.myDay(kitchenHead as never, old.id)).rejects.toMatchObject({ statusCode: 404 });
      // A head's past days leave out a day with no Used today to show.
      const mine = await branchDayService.myHistory(kitchenHead as never, { page: 1, pageSize: 50, from: date.toISOString().slice(0, 10) });
      expect(mine.rows.map((r) => r.id)).not.toContain(old.id);
      expect(mine.rows.map((r) => r.id)).toContain(dayId);
    });

    const correctOld = (id: string) =>
      branchDayService.correctCount(bm as never, id, { departmentId: dept['KITCHEN'] ?? '', itemId: item['Oil'] ?? '', closingQty: '3', reason: 'OTHER', pin: PIN, idempotencyKey: key('old') });

    it('an open day the old code made is adopted on its first read: lines for a department with none, the id link, a partial count undone', async () => {
      // Branch two, today: a day as the old code left it (no department link, no lines, one department marked counted with a blank line).
      const date = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
      const loc2 = (await deliveriesRepository.ensureDepartmentLocation(prisma, otherSiteId, otherDept['BARISTA'] ?? ''))?.id ?? '';
      const loc3 = (await deliveriesRepository.ensureDepartmentLocation(prisma, otherSiteId, otherDept['KITCHEN'] ?? ''))?.id ?? '';
      await prisma.itemDepartment.createMany({ data: [{ itemId: item['Milk'] ?? '', departmentId: otherDept['BARISTA'] ?? '' }, { itemId: item['Oil'] ?? '', departmentId: otherDept['KITCHEN'] ?? '' }] });
      const old = await prisma.branchDay.create({
        data: {
          siteId: otherSiteId,
          businessDate: date,
          reference: 'DAY-0001',
          departments: {
            create: [
              { departmentTag: 'BARISTA', locationId: loc2 },
              { departmentTag: 'KITCHEN', locationId: loc3, status: 'COUNTED', countedById: bm2.id, countedAt: new Date(), lines: { create: [{ inventoryItemId: item['Oil'] ?? '', countedQty: null, expectedQty: D(1), unitCost: D(120) }] } },
            ],
          },
        },
      });
      const today = await branchDayService.today(bm2 as never, {});
      expect(today.day?.head.id).toBe(old.id);
      const rows = await prisma.branchDayDepartment.findMany({ where: { branchDayId: old.id }, include: { lines: true } });
      expect(rows.every((r) => r.departmentId !== null)).toBe(true);
      expect(rows.find((r) => r.departmentTag === 'BARISTA')?.lines).toHaveLength(1);
      expect(rows.find((r) => r.departmentTag === 'KITCHEN')).toMatchObject({ status: 'NOT_STARTED', countedById: null });
      // The same head can now count their department on the adopted day.
      const view = await branchDayService.getCount(otherHead as never, {});
      expect(view.lines).toHaveLength(1);
    });
  });
});
