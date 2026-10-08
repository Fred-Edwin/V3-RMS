import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/database', () => ({ prisma: {} }));

import { departmentLinks, ORIGINAL_DEPARTMENTS } from './department-links';

type Db = Parameters<typeof departmentLinks.syncItemTags>[2];

const fakeDb = (siteType: 'BRANCH' | 'CENTRAL_STORE', taken: string[] = []) => {
  const db = {
    site: { findFirst: vi.fn(async (args: { where: { id?: string; code?: string } }) => (args.where.code ? (taken.includes(args.where.code) ? { id: 'x' } : null) : { type: siteType })), update: vi.fn() },
    itemDepartment: { deleteMany: vi.fn(), createMany: vi.fn() },
    department: { findMany: vi.fn(async () => [{ id: 'd1' }, { id: 'd2' }]), findFirst: vi.fn(async () => ({ id: 'dk' })), createMany: vi.fn() },
  };
  return db;
};
const asDb = (db: ReturnType<typeof fakeDb>): Db => db as unknown as Db;

describe('departmentLinks.syncItemTags (the dual-write)', () => {
  it('a Central Store item is tagged in every branch; the links to added departments (key null) are never deleted', async () => {
    const db = fakeDb('CENTRAL_STORE');
    await departmentLinks.syncItemTags({ id: 'i1', siteId: 'hub' }, ['KITCHEN'], asDb(db));
    expect(db.itemDepartment.deleteMany).toHaveBeenCalledWith({ where: { itemId: 'i1', department: { key: { not: null, notIn: ['KITCHEN'] } } } });
    expect(db.department.findMany).toHaveBeenCalledWith({ where: { key: { in: ['KITCHEN'] }, site: { type: 'BRANCH' } }, select: { id: true } });
    expect(db.itemDepartment.createMany).toHaveBeenCalledWith({ data: [{ itemId: 'i1', departmentId: 'd1' }, { itemId: 'i1', departmentId: 'd2' }], skipDuplicates: true });
  });

  it('a branch item is tagged only in its own branch', async () => {
    const db = fakeDb('BRANCH');
    await departmentLinks.syncItemTags({ id: 'i1', siteId: 'b1' }, ['BARISTA'], asDb(db));
    expect(db.department.findMany).toHaveBeenCalledWith({ where: { key: { in: ['BARISTA'] }, siteId: 'b1' }, select: { id: true } });
  });

  it('clearing every tag removes the original-five links and creates none', async () => {
    const db = fakeDb('CENTRAL_STORE');
    await departmentLinks.syncItemTags({ id: 'i1', siteId: 'hub' }, [], asDb(db));
    expect(db.itemDepartment.deleteMany).toHaveBeenCalledOnce();
    expect(db.itemDepartment.createMany).not.toHaveBeenCalled();
  });
});

describe('departmentLinks.idForKey', () => {
  it('is null for no key and finds the branch\'s department otherwise', async () => {
    const db = fakeDb('BRANCH');
    expect(await departmentLinks.idForKey('b1', null, asDb(db))).toBeNull();
    expect(await departmentLinks.idForKey('b1', 'KITCHEN', asDb(db))).toBe('dk');
    expect(db.department.findFirst).toHaveBeenCalledWith({ where: { siteId: 'b1', key: 'KITCHEN' }, select: { id: true } });
  });
});

describe('departmentLinks.provisionBranch (a new branch)', () => {
  it('gives the branch a three-letter code from its name and the five original departments', async () => {
    const db = fakeDb('BRANCH');
    await departmentLinks.provisionBranch({ id: 'b1', name: 'Mwea' }, asDb(db));
    expect(db.site.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { code: 'MWE' } });
    const created = (db.department.createMany.mock.calls[0]?.[0] as { data: Array<{ name: string; key: string; position: number }> }).data;
    expect(created.map((d) => d.name)).toEqual(ORIGINAL_DEPARTMENTS.map((d) => d.name));
    expect(created.map((d) => d.key)).toEqual(['KITCHEN', 'BARISTA', 'PASTRY', 'SERVICE', 'HOUSEKEEPING']);
  });
  it('changes the last letter when the code is taken, and keeps a code it already has', async () => {
    const taken = fakeDb('BRANCH', ['MWE']);
    await departmentLinks.provisionBranch({ id: 'b1', name: 'Mwea' }, asDb(taken));
    expect(taken.site.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { code: 'MWA' } });
    const keeps = fakeDb('BRANCH');
    await departmentLinks.provisionBranch({ id: 'b1', name: 'Mwea', code: 'ZZZ' }, asDb(keeps));
    expect(keeps.site.update).not.toHaveBeenCalled();
  });
});
