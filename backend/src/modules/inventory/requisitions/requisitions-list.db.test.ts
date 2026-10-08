/**
 * Back end B against a REAL database. Opt-in:
 *   cd backend && RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/requisitions/requisitions-list.db.test.ts
 * Builds its own two branches, people and requisitions and removes them. Use only the lane's own database (backend/.env).
 *
 * Covers: R1 tabs, counts and filters on real rows, tenancy between branches, a head's narrowed view and no money, the badges,
 * the urgent escalation claim (once only, reset when Urgent is set again), the retire check, the audit source (hub scope, branch
 * filter, a Branch Manager's own branch) and the production branch-code migration SQL.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { createEscalator } from '../../../jobs/requisition-urgent-escalation';
import { auditLogService } from '../audit-log/audit-log-service';
import { AuditLogQuerySchema } from '../audit-log/audit-log-validators';
import { departmentLinks } from '../departments/department-links';
import { departmentsService } from '../departments/departments-service';
import { listRequisitionsQuerySchema } from './_shared/requisitions-contract';
import { requisitionsListService } from './requisitions-list-service';
import { requisitionsRepository } from './requisitions-repository';
import { requisitionsService } from './requisitions-service';

const enabled = process.env['RUN_DB_TESTS'] === '1';
const tag = randomUUID().slice(0, 8);
const letters = (seed: string, first: string): string => `${first}${seed.replace(/[^a-f]/g, 'q').toUpperCase().slice(0, 2).padEnd(2, 'Q')}`;

describe.skipIf(!enabled)('back end B against the real database', () => {
  let hubId = '';
  let companyId = '';
  let siteA = '';
  let siteB = '';
  let kingongo = '';
  let mgrA = '';
  let mgrB = '';
  let headK = '';
  let storeMgr = '';
  let director = '';
  let kitchenId = '';
  let baristaId = '';
  let milkId = '';
  let r1 = '';
  let r2 = '';
  let r3 = '';
  let r4 = '';
  const who = (id: string, role: 'MANAGER' | 'CHEF' | 'STORE_MANAGER' | 'DIRECTOR', siteId: string | null, head = false) => ({ id, role, siteId, isDepartmentHead: head });
  const q = (over: Record<string, unknown> = {}) => listRequisitionsQuerySchema.parse(over);
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

  beforeAll(async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { type: 'CENTRAL_STORE' }, select: { id: true, companyId: true } });
    hubId = hub.id;
    companyId = hub.companyId;
    const site = (name: string, code: string | null) =>
      prisma.site.create({ data: { companyId, type: 'BRANCH', name, ...(code ? { code } : {}), address: 'x', city: 'x', latitude: 0, longitude: 0 } });
    siteA = (await site(`Alpha ${tag}`, letters(tag, 'A'))).id;
    siteB = (await site(`Bravo ${tag}`, letters(tag.split('').reverse().join(''), 'B'))).id;
    for (const id of [siteA, siteB]) await departmentLinks.provisionBranch({ id, name: 'x', code: 'set' });
    const dA = await prisma.department.findMany({ where: { siteId: siteA }, select: { id: true, key: true } });
    kitchenId = dA.find((d) => d.key === 'KITCHEN')?.id ?? '';
    baristaId = dA.find((d) => d.key === 'BARISTA')?.id ?? '';
    const user = (name: string, role: 'MANAGER' | 'CHEF' | 'STORE_MANAGER' | 'DIRECTOR', siteId: string | null, extra: Record<string, unknown> = {}) =>
      prisma.user.create({ data: { name: `${name} ${tag}`, email: `${name}-${tag}@test.invalid`, passwordHash: 'x', role, siteId, ...extra } });
    mgrA = (await user('mgra', 'MANAGER', siteA)).id;
    mgrB = (await user('mgrb', 'MANAGER', siteB)).id;
    headK = (await user('headk', 'CHEF', siteA, { isDepartmentHead: true, departmentTag: 'KITCHEN', departmentId: kitchenId })).id;
    storeMgr = (await user('store', 'STORE_MANAGER', hubId)).id;
    director = (await user('dir', 'DIRECTOR', null)).id;
    milkId = (await prisma.inventoryItem.create({ data: { siteId: hubId, name: `Milk ${tag}`, type: 'STOCKED', buyUnit: 'kg', usageUnit: 'kg', departmentTags: [], currentCost: new Prisma.Decimal(100) } })).id;

    const make = async (siteId: string, ref: string, type: 'MORNING' | 'AFTERNOON' | 'EXTRA', status: 'OPEN' | 'PENDING_APPROVAL' | 'APPROVED', openedAt: Date, extra: Record<string, unknown> = {}) =>
      (
        await prisma.requisition.create({
          data: { siteId, reference: ref, type, status, openedById: siteId === siteA ? mgrA : mgrB, openedAt, idempotencyKey: `k-${ref}-${tag}`, ...extra },
          select: { id: true },
        })
      ).id;
    const sections = async (requisitionId: string, siteId: string, kitchen: 'DRAFT' | 'SUBMITTED', barista: 'NOT_STARTED' | 'SUBMITTED') => {
      const depts = await prisma.department.findMany({ where: { siteId, key: { in: ['KITCHEN', 'BARISTA'] } }, select: { id: true, key: true } });
      const out: Record<string, string> = {};
      for (const d of depts) {
        const status = d.key === 'KITCHEN' ? kitchen : barista;
        const s = await prisma.requisitionSection.create({
          data: { requisitionId, departmentId: d.id, departmentTag: d.key, status, ...(status === 'SUBMITTED' ? { submittedAt: hoursAgo(3), submittedById: siteId === siteA ? headK : mgrB } : {}) },
          select: { id: true },
        });
        out[d.key as string] = s.id;
      }
      return out;
    };
    r1 = await make(siteA, `REQ-A-${tag}-1`, 'MORNING', 'OPEN', new Date('2026-10-01T06:00:00Z'), { urgent: true, urgentAt: hoursAgo(2), urgentNote: 'Wedding at 4' });
    await sections(r1, siteA, 'DRAFT', 'NOT_STARTED');
    r2 = await make(siteA, `REQ-A-${tag}-2`, 'AFTERNOON', 'PENDING_APPROVAL', new Date('2026-10-02T10:00:00Z'));
    await sections(r2, siteA, 'SUBMITTED', 'SUBMITTED');
    r3 = await make(siteA, `REQ-A-${tag}-3`, 'EXTRA', 'APPROVED', new Date('2026-10-03T10:00:00Z'), { approvedById: mgrA, approvedAt: hoursAgo(1) });
    const s3 = await sections(r3, siteA, 'SUBMITTED', 'SUBMITTED');
    await prisma.requisitionLine.create({
      data: { requisitionSectionId: s3['KITCHEN'] as string, inventoryItemId: milkId, requestedQty: new Prisma.Decimal(10), approvedQty: new Prisma.Decimal(10), unitCostAtApproval: new Prisma.Decimal(100) },
    });
    r4 = await make(siteB, `REQ-B-${tag}-1`, 'MORNING', 'OPEN', new Date('2026-10-01T06:00:00Z'));
    await sections(r4, siteB, 'DRAFT', 'NOT_STARTED');
  });

  afterAll(async () => {
    if (!enabled) return;
    const sites = [siteA, siteB, kingongo].filter(Boolean);
    const ids = (await prisma.requisition.findMany({ where: { siteId: { in: sites } }, select: { id: true } })).map((r) => r.id);
    await prisma.requisitionEvent.deleteMany({ where: { requisitionId: { in: ids } } });
    await prisma.requisitionLine.deleteMany({ where: { section: { requisitionId: { in: ids } } } });
    await prisma.requisitionSection.deleteMany({ where: { requisitionId: { in: ids } } });
    await prisma.requisition.deleteMany({ where: { id: { in: ids } } });
    await prisma.inventoryItem.deleteMany({ where: { id: milkId } });
    await prisma.user.deleteMany({ where: { id: { in: [mgrA, mgrB, headK, storeMgr, director] } } });
    await prisma.department.deleteMany({ where: { siteId: { in: sites } } });
    await prisma.site.deleteMany({ where: { id: { in: sites } } });
    await prisma.$disconnect();
  });

  describe('R1 on real rows', () => {
    it('a Branch Manager sees their own branch only: counts and rows', async () => {
      const result = await requisitionsListService.list(who(mgrA, 'MANAGER', siteA), q({ tab: 'collecting' }));
      expect(result.rows.map((r) => r.id)).toEqual([r1]);
      expect(result.tabCounts).toMatchObject({ collecting: 1, 'to-approve': 1, 'to-pack': 1, 'on-the-way': 0, discrepancies: 0, closed: 0 });
      expect(result.waitingForYou).toBe(1);
      expect(result.branches).toBeUndefined();
      expect(result.rows[0]).toMatchObject({ urgent: true, urgentNote: 'Wedding at 4', urgentOverHour: true, reference: `REQ-A-${tag}-1` });
      expect(result.rows[0]?.sections.map((s) => s.departmentId).sort()).toEqual([baristaId, kitchenId].sort());
    });

    it('a hub reader sees both branches, gets the picker, and the Branch filter narrows', async () => {
      const all = await requisitionsListService.list(who(director, 'DIRECTOR', null), q({ tab: 'collecting' }));
      expect(all.rows.map((r) => r.id)).toEqual(expect.arrayContaining([r1, r4]));
      expect(all.branches?.map((b) => b.id)).toEqual(expect.arrayContaining([siteA, siteB]));
      const onlyB = await requisitionsListService.list(who(director, 'DIRECTOR', null), q({ tab: 'collecting', branchId: siteB }));
      expect(onlyB.rows.map((r) => r.id)).toEqual([r4]);
    });

    it('the tabs are derived from the real dispatch rows: an approved requisition with none is To pack', async () => {
      const result = await requisitionsListService.list(who(storeMgr, 'STORE_MANAGER', hubId), q({ branchId: siteA }));
      expect(result.tab).toBe('to-pack');
      expect(result.rows.map((r) => r.id)).toEqual([r3]);
      expect(result.waitingForYou).toBeGreaterThanOrEqual(1);
      expect(result.rows[0]?.valueKes).toBe('1000.00'); // 10 x 100: the Store Manager holds requisitions.see_value
    });

    it('search, cycle, department, urgent and date filters work on real data', async () => {
      const bm = who(mgrA, 'MANAGER', siteA);
      const ids = async (over: Record<string, unknown>) => (await requisitionsListService.list(bm, q({ tab: undefined, ...over }))).page.total;
      const rows = async (tab: string, over: Record<string, unknown>) => (await requisitionsListService.list(bm, q({ tab, ...over }))).rows.map((r) => r.id);
      expect(await rows('to-pack', { q: `Milk ${tag}` })).toEqual([r3]); // by item name
      expect(await rows('collecting', { q: `REQ-A-${tag}-1` })).toEqual([r1]); // by reference
      expect(await rows('collecting', { q: 'no such thing' })).toEqual([]);
      expect(await rows('collecting', { cycle: 'MORNING' })).toEqual([r1]);
      expect(await rows('collecting', { cycle: 'EXTRA' })).toEqual([]);
      expect(await rows('collecting', { urgent: 'true' })).toEqual([r1]);
      expect(await rows('to-approve', { urgent: 'true' })).toEqual([]);
      expect(await rows('to-approve', { departmentId: baristaId })).toEqual([r2]);
      expect(await rows('to-approve', { from: '2026-10-02', to: '2026-10-02' })).toEqual([r2]);
      expect(await rows('to-approve', { from: '2026-10-03' })).toEqual([]);
      expect(await rows('to-approve', { status: 'PENDING_APPROVAL' })).toEqual([r2]);
      expect(await ids({ tab: 'to-approve', status: 'APPROVED' })).toBe(0);
    });

    it('a head sees their own department only, in their own branch, and no money', async () => {
      const result = await requisitionsListService.list(who(headK, 'CHEF', siteA, true), q({ tab: 'to-approve' }));
      expect(result.rows.map((r) => r.id)).toEqual([r2]);
      expect(result.rows[0]?.sections.map((s) => s.departmentId)).toEqual([kitchenId]);
      expect(JSON.stringify(result)).not.toMatch(/value|cost|price|kes/i);
    });

    it('the Attendant reads with no money', async () => {
      const att = await prisma.user.create({ data: { name: `att ${tag}`, email: `att-${tag}@test.invalid`, passwordHash: 'x', role: 'STORE_ATTENDANT', siteId: hubId } });
      try {
        const result = await requisitionsListService.list({ id: att.id, role: 'STORE_ATTENDANT', siteId: hubId }, q({ tab: 'to-pack', branchId: siteA }));
        expect(result.rows.length).toBeGreaterThan(0);
        expect(JSON.stringify(result.rows)).not.toMatch(/value|cost|price|kes/i);
      } finally {
        await prisma.user.delete({ where: { id: att.id } });
      }
    });
  });

  describe('R2 badges', () => {
    it('counts what waits, scoped to the branch', async () => {
      expect(await requisitionsListService.badges(who(mgrA, 'MANAGER', siteA))).toEqual({ requisitions: 1, toApprove: 1 });
      expect(await requisitionsListService.badges(who(mgrB, 'MANAGER', siteB))).toEqual({ requisitions: 0, toApprove: 0 });
      expect(await requisitionsListService.badges(who(headK, 'CHEF', siteA, true))).toEqual({ requisitions: 1 }); // r1: Kitchen is a Draft
    });
  });

  describe('urgent escalation on real rows', () => {
    it('escalates an urgent unsigned requisition once, only after the hour, and never again', async () => {
      const sent: string[] = [];
      const run = createEscalator({
        findDue: requisitionsRepository.findDueForEscalation,
        claim: requisitionsRepository.claimEscalation,
        send: async (n) => void sent.push(String(n.message.data['requisitionId'])),
      });
      await run(new Date(Date.now() - 3 * 3600_000)); // three hours ago: r1 was marked 2 hours ago, so not yet an hour old then
      expect(sent).not.toContain(r1);
      await run(new Date());
      expect(sent.filter((id) => id === r1)).toHaveLength(1);
      await run(new Date());
      expect(sent.filter((id) => id === r1)).toHaveLength(1);
      expect((await prisma.requisition.findUniqueOrThrow({ where: { id: r1 }, select: { urgentEscalatedAt: true } })).urgentEscalatedAt).not.toBeNull();
      expect(sent).not.toContain(r3); // signed
      expect(sent).not.toContain(r2); // not urgent
    });

    it('clearing Urgent and setting it again starts a new hour (the stamp is cleared)', async () => {
      const bm = who(mgrA, 'MANAGER', siteA);
      await requisitionsService.setUrgent(bm, r1, { urgent: false });
      await requisitionsService.setUrgent(bm, r1, { urgent: true, urgentNote: 'Again' });
      const row = await prisma.requisition.findUniqueOrThrow({ where: { id: r1 }, select: { urgentEscalatedAt: true, urgentNote: true, urgentAt: true } });
      expect(row.urgentEscalatedAt).toBeNull();
      expect(row.urgentNote).toBe('Again');
      expect(Date.now() - (row.urgentAt as Date).getTime()).toBeLessThan(60_000);
    });
  });

  describe('retire check and the audit source', () => {
    it('a department with a list still open in a requisition cannot be retired; once those are cancelled it can', async () => {
      const bm = who(mgrA, 'MANAGER', siteA);
      await expect(departmentsService.retire(bm, kitchenId)).rejects.toMatchObject({ statusCode: 409, code: 'DEPARTMENT_HAS_OPEN_SECTIONS' });
      await prisma.requisition.updateMany({ where: { id: { in: [r1, r2] } }, data: { status: 'CANCELLED' } });
      expect((await departmentsService.retire(bm, kitchenId)).status).toBe('RETIRED');
      expect((await departmentsService.restore(bm, kitchenId)).status).toBe('ACTIVE');
    });

    it('the REQUISITIONS area reads events of the branches: hub scope, Branch filter, and a Branch Manager sees only theirs', async () => {
      await prisma.requisition.update({ where: { id: r1 }, data: { status: 'OPEN' } });
      await prisma.requisitionEvent.createMany({
        data: [
          { requisitionId: r1, type: 'NUDGED', actorId: mgrA, actorRoleLabel: 'Branch Manager', sectionId: (await prisma.requisitionSection.findFirstOrThrow({ where: { requisitionId: r1, departmentId: kitchenId }, select: { id: true } })).id },
          { requisitionId: r4, type: 'APPROVED', actorId: mgrB, actorRoleLabel: 'Branch Manager', fromValue: '12', toValue: 'BRANCH_MANAGER' },
        ],
      });
      const list = (a: ReturnType<typeof who>, over: Record<string, unknown> = {}) => auditLogService.list(a as never, AuditLogQuerySchema.parse({ area: 'REQUISITIONS', perPage: 100, ...over }));
      const hub = await list(who(director, 'DIRECTOR', null));
      const whats = hub.entries.map((e) => e.what);
      expect(whats).toContain(`Nudged Kitchen · REQ-A-${tag}-1`);
      expect(whats).toContain(`Approved REQ-B-${tag}-1 · 12 lines · signed with PIN`);
      expect(hub.entries.find((e) => e.what.startsWith('Nudged Kitchen'))?.record).toMatchObject({ kind: 'REQUISITION', id: r1 });
      const onlyB = await list(who(director, 'DIRECTOR', null), { branchId: siteB });
      expect(onlyB.entries.map((e) => e.what)).toEqual([`Approved REQ-B-${tag}-1 · 12 lines · signed with PIN`]);
      const mine = await list(who(mgrA, 'MANAGER', siteA));
      expect(mine.entries.map((e) => e.what)).toContain(`Nudged Kitchen · REQ-A-${tag}-1`);
      expect(mine.entries.map((e) => e.what).join('|')).not.toContain(`REQ-B-${tag}`);
      await expect(list(who(mgrA, 'MANAGER', siteA), { branchId: siteB })).rejects.toMatchObject({ statusCode: 403 });
      expect(JSON.stringify(hub.entries)).not.toMatch(/pin\s*\d|account/i);
    });
  });

  describe('the production branch-code migration SQL', () => {
    it('renames the code of a King\'ong\'o branch to KNG with its references, and leaves a branch that already has the right code alone', async () => {
      const taken = await prisma.site.findFirst({ where: { code: 'KNG' }, select: { id: true } });
      if (taken) return; // the lane database already has a KNG branch; the rename would (correctly) refuse, nothing to prove here
      kingongo = (await prisma.site.create({ data: { companyId, type: 'BRANCH', name: `King'ong'o ${tag}`, code: 'KGO', address: 'x', city: 'x', latitude: 0, longitude: 0 } })).id;
      await prisma.requisition.create({ data: { siteId: kingongo, reference: 'REQ-KGO-0007', type: 'MORNING', status: 'OPEN', openedById: mgrA, idempotencyKey: `k-kgo-${tag}` } });
      const sql = readFileSync(resolve(__dirname, '../../../../prisma/schema/migrations/20261008150000_requisitions_urgent_note/migration.sql'), 'utf8');
      const block = sql.slice(sql.indexOf('DO $$'));
      await prisma.$executeRawUnsafe(block);
      expect((await prisma.site.findUniqueOrThrow({ where: { id: kingongo }, select: { code: true } })).code).toBe('KNG');
      expect((await prisma.requisition.findFirstOrThrow({ where: { siteId: kingongo }, select: { reference: true } })).reference).toBe('REQ-KNG-0007');
      await prisma.$executeRawUnsafe(block); // running it again changes nothing
      expect((await prisma.requisition.findFirstOrThrow({ where: { siteId: kingongo }, select: { reference: true } })).reference).toBe('REQ-KNG-0007');
    });
  });
});
