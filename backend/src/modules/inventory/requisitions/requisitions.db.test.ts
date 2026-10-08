/**
 * Block 1 against a REAL database (no mocks of the data layer). Opt-in:
 *   cd backend && RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/requisitions/requisitions.db.test.ts
 * It builds its own branch, departments, users and items, and removes everything it made. It never touches existing rows except to
 * READ the migration's back-fills. Use only the lane's own database (backend/.env).
 *
 * Covers: the migration back-fills, the dual-write, the reference counter under two parallel starts, one open requisition per
 * cycle under a race, tenancy (a file is invisible from another branch), and that the OLD dispatch queue still lists an
 * approved requisition (and hides a pending addition's lines).
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { dispatchRepository } from '../dispatch/dispatch-repository';
import { departmentLinks } from '../departments/department-links';
import { LOCK_WAIT_MS, takeDbTestLock } from '../_shared/db-test-lock';
import { requisitionsRepository } from './requisitions-repository';
import { requisitionsService } from './requisitions-service';

const enabled = process.env['RUN_DB_TESTS'] === '1';
const tag = randomUUID().slice(0, 8);

// The back-fill checks below read the whole database, so this file waits its turn behind any other database test file
// (`requisitions-list.db.test.ts` builds branches and requisitions that would otherwise show up in those reads).
let releaseDbLock: () => Promise<void> = async () => undefined;
beforeAll(async () => {
  if (enabled) releaseDbLock = await takeDbTestLock();
}, LOCK_WAIT_MS);
afterAll(async () => {
  await releaseDbLock();
});

describe.skipIf(!enabled)('the migration back-fills (read-only checks of what the migration left)', () => {
  it('every branch has its five departments, keyed by the legacy value, and a unique code', async () => {
    const branches = await prisma.site.findMany({ where: { type: 'BRANCH' }, select: { id: true, code: true, departments: { select: { key: true, name: true, status: true } } } });
    const seeded = branches.filter((b) => b.departments.length > 0);
    expect(seeded.length).toBeGreaterThan(0);
    for (const b of seeded) {
      expect(b.code).toMatch(/^[A-Z]{3}$/);
      expect(b.departments.filter((d) => d.key !== null).map((d) => d.key).sort()).toEqual(['BARISTA', 'HOUSEKEEPING', 'KITCHEN', 'PASTRY', 'SERVICE']);
    }
    expect(new Set(branches.map((b) => b.code)).size).toBe(branches.length);
    const hub = await prisma.site.findFirst({ where: { type: 'CENTRAL_STORE' }, select: { code: true } });
    expect(hub?.code).toBeNull();
  });

  it('every staff member, branch-department location and section with an enum has the matching department id', async () => {
    const users = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM users u WHERE u.department_tag IS NOT NULL AND (u.department_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM departments d WHERE d.id = u.department_id AND d.organization_id = u.organization_id AND d.key = u.department_tag))`;
    const locations = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM locations l WHERE l.department_tag IS NOT NULL AND (l.department_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM departments d WHERE d.id = l.department_id AND d.organization_id = l.organization_id AND d.key = l.department_tag))`;
    const sections = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM requisition_sections s JOIN requisitions r ON r.id = s.requisition_id
       WHERE s.department_tag IS NOT NULL AND (s.department_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM departments d WHERE d.id = s.department_id AND d.organization_id = r.organization_id AND d.key = s.department_tag))`;
    expect([users[0]?.n, locations[0]?.n, sections[0]?.n]).toEqual([0n, 0n, 0n]);
  });

  it('every item tag has an ItemDepartment row in each branch it applies to', async () => {
    const missing = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM inventory_items i
        CROSS JOIN LATERAL unnest(i.department_tags) AS t(tag)
        JOIN organizations io ON io.id = i.organization_id
        JOIN departments d ON d.key = t.tag AND (io.type <> 'BRANCH' OR d.organization_id = i.organization_id)
       WHERE NOT EXISTS (SELECT 1 FROM item_departments x WHERE x.item_id = i.id AND x.department_id = d.id)`;
    expect(missing[0]?.n).toBe(0n);
  });

  it('every requisition has a REQ-{code}-{nnnn} reference, gap-free per branch in opened order, and the counter matches', async () => {
    const rows = await prisma.requisition.findMany({ select: { siteId: true, reference: true, openedAt: true }, orderBy: [{ siteId: 'asc' }, { openedAt: 'asc' }, { id: 'asc' }] });
    const bySite = new Map<string, string[]>();
    for (const r of rows) bySite.set(r.siteId, [...(bySite.get(r.siteId) ?? []), r.reference]);
    for (const [siteId, refs] of bySite) {
      const code = (await prisma.site.findUnique({ where: { id: siteId }, select: { code: true } }))?.code;
      const numbers = refs.map((r) => Number(r.split('-')[2]));
      expect(refs.every((r) => new RegExp(`^REQ-${code}-\\d{4}$`).test(r))).toBe(true);
      // Numbers taken by new requisitions follow the back-filled ones; the back-fill itself has no gaps.
      expect(numbers.slice(0, 1)[0]).toBe(1);
      const counter = await prisma.referenceCounter.findUnique({ where: { siteId_prefix: { siteId, prefix: 'REQ' } }, select: { lastNumber: true } });
      expect(counter?.lastNumber).toBeGreaterThanOrEqual(Math.max(...numbers));
    }
    expect(await prisma.requisition.count({ where: { type: { in: ['EVENING', 'AD_HOC'] } } })).toBe(0);
  });
});

describe.skipIf(!enabled)('Block 1 writes against the real database', () => {
  let companyId = '';
  let hubId = '';
  let siteId = '';
  let otherSiteId = '';
  let managerId = '';
  let headId = '';
  let otherManagerId = '';
  let kitchenId = '';
  let baristaId = '';
  let milkId = '';
  let creamId = '';
  const createdRequisitions: string[] = [];
  const actor = (id: string, role: 'MANAGER' | 'CHEF', site: string) => ({ id, role, siteId: site, isDepartmentHead: role === 'CHEF' });

  beforeAll(async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { type: 'CENTRAL_STORE' }, select: { id: true, companyId: true } });
    hubId = hub.id;
    companyId = hub.companyId;
    const mk = async (name: string, code: string) =>
      prisma.site.create({ data: { companyId, type: 'BRANCH', name: `${name} ${tag}`, code, address: 'x', city: 'x', latitude: 0, longitude: 0 } });
    siteId = (await mk('Test branch', `T${tag.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, 'Q')}Z`.slice(0, 3))).id;
    otherSiteId = (await mk('Other branch', `U${tag.slice(2, 4).toUpperCase().replace(/[^A-Z]/g, 'Q')}Z`.slice(0, 3))).id;
    await departmentLinks.provisionBranch({ id: siteId, name: 'x', code: 'set' });
    const depts = await prisma.department.findMany({ where: { siteId }, select: { id: true, key: true } });
    kitchenId = depts.find((d) => d.key === 'KITCHEN')?.id ?? '';
    baristaId = depts.find((d) => d.key === 'BARISTA')?.id ?? '';
    const user = (name: string, role: 'MANAGER' | 'CHEF', extra: Record<string, unknown> = {}) =>
      prisma.user.create({ data: { name, email: `${name}-${tag}@test.invalid`, passwordHash: 'x', role, siteId, ...extra } });
    managerId = (await user('mgr', 'MANAGER')).id;
    headId = (await user('head', 'CHEF', { isDepartmentHead: true, departmentTag: 'KITCHEN', departmentId: kitchenId })).id;
    otherManagerId = (await user('other', 'MANAGER', { siteId: otherSiteId })).id;
    const item = (name: string) => prisma.inventoryItem.create({ data: { siteId: hubId, name: `${name} ${tag}`, type: 'STOCKED', buyUnit: 'kg', usageUnit: 'kg', departmentTags: [], currentCost: new Prisma.Decimal(100) } });
    milkId = (await item('Milk')).id;
    creamId = (await item('Cream')).id;
    // Tag the items the way the catalog hook does, in one transaction, so the dual-write is exercised for real.
    await prisma.$transaction(async (tx) => {
      await tx.inventoryItem.updateMany({ where: { id: { in: [milkId, creamId] } }, data: { departmentTags: ['KITCHEN'] } });
      await departmentLinks.syncItemTags({ id: milkId, siteId: hubId }, ['KITCHEN'], tx);
      await departmentLinks.syncItemTags({ id: creamId, siteId: hubId }, ['KITCHEN'], tx);
    });
  });

  afterAll(async () => {
    if (!enabled) return;
    const reqs = await prisma.requisition.findMany({ where: { siteId: { in: [siteId, otherSiteId] } }, select: { id: true } });
    const ids = reqs.map((r) => r.id);
    await prisma.requisitionEvent.deleteMany({ where: { requisitionId: { in: ids } } });
    await prisma.requisitionLine.deleteMany({ where: { section: { requisitionId: { in: ids } } } });
    await prisma.requisitionAddition.deleteMany({ where: { requisitionId: { in: ids } } });
    await prisma.requisitionSection.deleteMany({ where: { requisitionId: { in: ids } } });
    await prisma.requisition.deleteMany({ where: { id: { in: ids } } });
    await prisma.referenceCounter.deleteMany({ where: { siteId: { in: [siteId, otherSiteId] } } });
    await prisma.itemDepartment.deleteMany({ where: { itemId: { in: [milkId, creamId] } } });
    await prisma.inventoryItem.deleteMany({ where: { id: { in: [milkId, creamId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [managerId, headId, otherManagerId] } } });
    await prisma.department.deleteMany({ where: { siteId: { in: [siteId, otherSiteId] } } });
    await prisma.site.deleteMany({ where: { id: { in: [siteId, otherSiteId] } } });
    await prisma.$disconnect();
  });

  it('dual-write: tagging an item writes the id link; an untagged department loses it; links to an added department are kept', async () => {
    expect((await prisma.itemDepartment.findMany({ where: { itemId: milkId, department: { siteId } }, select: { departmentId: true } })).map((r) => r.departmentId)).toEqual([kitchenId]);
    const added = await prisma.department.create({ data: { siteId, name: `Garden ${tag}`, position: 9 } });
    await prisma.itemDepartment.create({ data: { itemId: milkId, departmentId: added.id } });
    await prisma.$transaction((tx) => departmentLinks.syncItemTags({ id: milkId, siteId: hubId }, ['BARISTA'], tx));
    const after = (await prisma.itemDepartment.findMany({ where: { itemId: milkId, department: { siteId } }, select: { departmentId: true } })).map((r) => r.departmentId).sort();
    expect(after).toEqual([added.id, baristaId].sort()); // KITCHEN dropped, BARISTA added, the added department untouched
    await prisma.$transaction((tx) => departmentLinks.syncItemTags({ id: milkId, siteId: hubId }, ['KITCHEN'], tx));
    await prisma.itemDepartment.deleteMany({ where: { departmentId: added.id } });
    await prisma.department.delete({ where: { id: added.id } });
  });

  it('two parallel starts for different cycles get different, consecutive numbers', async () => {
    const [a, b] = await Promise.all([
      requisitionsService.start(actor(managerId, 'MANAGER', siteId), { cycle: 'MORNING', idempotencyKey: `idem-m-${tag}` }),
      requisitionsService.start(actor(managerId, 'MANAGER', siteId), { cycle: 'AFTERNOON', idempotencyKey: `idem-a-${tag}` }),
    ]);
    createdRequisitions.push(a.requisitionId, b.requisitionId);
    expect(a.reference).not.toBe(b.reference);
    expect([a.reference, b.reference].sort()).toEqual([expect.stringMatching(/-0001$/), expect.stringMatching(/-0002$/)]);
    expect(a.reference).toMatch(/^REQ-[A-Z]{3}-000[12]$/);
  });

  it('two parallel starts for the SAME cycle: one wins, the other is a 409', async () => {
    const results = await Promise.allSettled([
      requisitionsService.start(actor(headId, 'CHEF', siteId), { cycle: 'EXTRA', idempotencyKey: `idem-x1-${tag}` }),
      requisitionsService.start(actor(managerId, 'MANAGER', siteId), { cycle: 'EXTRA', idempotencyKey: `idem-x2-${tag}` }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    expect(lost?.reason).toMatchObject({ code: 'REQUISITION_ALREADY_OPEN', statusCode: 409 });
    // The number was taken inside the transaction that rolled back, so the sequence has no gap.
    const refs = (await prisma.requisition.findMany({ where: { siteId }, select: { reference: true } })).map((r) => Number(r.reference.slice(-4))).sort();
    expect(refs).toEqual([1, 2, 3]);
  });

  it('a repeated start key returns the first requisition and makes no second one', async () => {
    const again = await requisitionsService.start(actor(managerId, 'MANAGER', siteId), { cycle: 'MORNING', idempotencyKey: `idem-m-${tag}` });
    expect(again.replayed).toBe(true);
    expect(await prisma.requisition.count({ where: { siteId } })).toBe(3);
  });

  it('a new requisition has a section per active department, dual-written, with the events', async () => {
    const rec = await prisma.requisition.findFirstOrThrow({ where: { siteId, type: 'MORNING' }, include: { sections: true, events: true } });
    expect(rec.sections).toHaveLength(5);
    const kitchen = rec.sections.find((s) => s.departmentId === kitchenId);
    expect(kitchen?.departmentTag).toBe('KITCHEN');
    expect(rec.sections.filter((s) => s.status === 'SKIPPED').length).toBe(4); // only Kitchen has tagged items; the rest are Skipped by rule
    expect(rec.events.map((e) => e.type)).toEqual(['STARTED']);
  });

  it('tenancy: a file is invisible from another branch and visible to a hub reader', async () => {
    const id = (await prisma.requisition.findFirstOrThrow({ where: { siteId, type: 'MORNING' }, select: { id: true } })).id;
    expect(await requisitionsRepository.findFile(id, { siteId: otherSiteId })).toBeNull();
    expect((await requisitionsRepository.findFile(id, { siteId }))?.id).toBe(id);
    expect((await requisitionsRepository.findFile(id, { anyBranch: true }))?.id).toBe(id);
    // The service trusts the person's stored branch, not the token: a manager who really belongs to the other branch gets "not found".
    await expect(requisitionsService.getFile(actor(otherManagerId, 'MANAGER', otherSiteId), id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('the old dispatch queue still lists an approved requisition, and hides a pending addition\'s lines', async () => {
    const id = (await prisma.requisition.findFirstOrThrow({ where: { siteId, type: 'MORNING' }, select: { id: true } })).id;
    const kitchenSection = await prisma.requisitionSection.findFirstOrThrow({ where: { requisitionId: id, departmentId: kitchenId } });
    const addition = await prisma.requisitionAddition.create({ data: { requisitionId: id, departmentId: kitchenId, addedById: headId, sentPinSignedAt: new Date() } });
    await prisma.requisitionLine.createMany({
      data: [
        { requisitionSectionId: kitchenSection.id, inventoryItemId: milkId, requestedQty: new Prisma.Decimal(5), approvedQty: new Prisma.Decimal(5) },
        { requisitionSectionId: kitchenSection.id, inventoryItemId: creamId, requestedQty: new Prisma.Decimal(2), additionId: addition.id },
      ],
    });
    await prisma.requisition.update({ where: { id }, data: { status: 'APPROVED', approvedById: managerId, approvedAt: new Date() } });

    const queue = await dispatchRepository.findQueueByBranchOrgIds([siteId], 10);
    const listed = queue.find((r) => r.id === id);
    expect(listed).toBeDefined();
    expect(listed?.sections.find((s) => s.departmentTag === 'KITCHEN')?.lines).toHaveLength(1); // the pending addition's line is not packed yet
    const fulfil = await dispatchRepository.findRequisitionForFulfil(id, [siteId]);
    expect(fulfil?.sections.find((s) => s.departmentTag === 'KITCHEN')?.lines).toHaveLength(1);

    await prisma.requisitionAddition.update({ where: { id: addition.id }, data: { status: 'APPROVED', approvedById: managerId, approvedAt: new Date() } });
    const after = await dispatchRepository.findRequisitionForFulfil(id, [siteId]);
    expect(after?.sections.find((s) => s.departmentTag === 'KITCHEN')?.lines).toHaveLength(2); // approved, it joins the unsigned dispatch
  });

  it('a department added in Block 1 has no legacy key and is invisible to the old dispatch', async () => {
    const id = (await prisma.requisition.findFirstOrThrow({ where: { siteId, type: 'AFTERNOON' }, select: { id: true } })).id;
    const added = await prisma.department.create({ data: { siteId, name: `Terrace ${tag}`, position: 10 } });
    await prisma.requisitionSection.create({ data: { requisitionId: id, departmentId: added.id, departmentTag: null, status: 'SUBMITTED' } });
    await prisma.requisition.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date(), approvedById: managerId } });
    const fulfil = await dispatchRepository.findRequisitionForFulfil(id, [siteId]);
    expect(fulfil?.sections.every((s) => s.departmentTag !== null)).toBe(true);
    expect(fulfil?.sections.some((s) => s.id && s.departmentTag === 'KITCHEN')).toBe(true);
  });
});
