import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../utils/errors';
import { listDepartmentsSchema, departmentRowSchema } from './_shared/departments-contract';

const repo = vi.hoisted(() => ({
  listBranches: vi.fn(),
  findBranch: vi.fn(),
  listByBranch: vi.fn(),
  findById: vi.fn(),
  listHeads: vi.fn(),
  countItemsByDepartment: vi.fn(),
  findByName: vi.fn(),
  create: vi.fn(),
  rename: vi.fn(),
  setStatus: vi.fn(),
}));
vi.mock('./departments-repository', () => ({ departmentsRepository: repo }));

import { departmentsService } from './departments-service';

type Actor = Parameters<typeof departmentsService.list>[0];
const SITE = 'b0000000-0000-4000-8000-000000000001';
const OTHER = 'b0000000-0000-4000-8000-000000000002';
const manager: Actor = { id: 'm1', role: 'MANAGER', siteId: SITE };
const otherManager: Actor = { id: 'm2', role: 'MANAGER', siteId: OTHER };
const director: Actor = { id: 'd1', role: 'DIRECTOR', siteId: null };
const storeManager: Actor = { id: 's1', role: 'STORE_MANAGER', siteId: 'hub' };
const sysAdmin: Actor = { id: 'a1', role: 'SYSTEM_ADMIN', siteId: null };

const dept = (id: string, name: string, extra: Partial<Record<string, unknown>> = {}) => ({
  id: `d0000000-0000-4000-8000-00000000000${id}`, siteId: SITE, name, key: id === '9' ? null : 'KITCHEN', status: 'ACTIVE', position: Number(id), retiredAt: null, ...extra,
});
const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
  return 'NO_ERROR';
};

beforeEach(() => {
  vi.resetAllMocks();
  repo.findBranch.mockImplementation(async (id: string) => ({ id, name: id === SITE ? 'Nyeri Town' : 'Karatina', code: id === SITE ? 'NYR' : 'KRT' }));
  repo.listBranches.mockResolvedValue([{ id: SITE, name: 'Nyeri Town', code: 'NYR' }, { id: OTHER, name: 'Karatina', code: 'KRT' }]);
  repo.listByBranch.mockResolvedValue([dept('1', 'Kitchen'), dept('9', 'Garden', { status: 'RETIRED', retiredAt: new Date('2026-10-05T08:00:00Z') })]);
  repo.listHeads.mockResolvedValue([{ id: 'u1', name: 'Grace Wanjiru', role: 'CHEF', departmentId: dept('1', 'Kitchen').id }]);
  repo.countItemsByDepartment.mockResolvedValue(new Map([[dept('1', 'Kitchen').id, 86]]));
  repo.findByName.mockResolvedValue(null);
  repo.findById.mockImplementation(async (id: string) => (id === dept('1', 'Kitchen').id ? dept('1', 'Kitchen') : id === dept('9', 'Garden').id ? dept('9', 'Garden', { status: 'RETIRED' }) : null));
  repo.create.mockImplementation(async (siteId: string, name: string) => dept('9', name, { siteId }));
  repo.rename.mockImplementation(async (_id: string, siteId: string, name: string) => dept('1', name, { siteId }));
  repo.setStatus.mockImplementation(async (_id: string, siteId: string, status: string) => dept('1', 'Kitchen', { siteId, status }));
});

describe('list (R23)', () => {
  it('gives a Branch Manager their own branch only, with write flags and no picker', async () => {
    const result = await departmentsService.list(manager, {});
    expect(listDepartmentsSchema.safeParse(result).success).toBe(true);
    expect(result.branch.id).toBe(SITE);
    expect(result).not.toHaveProperty('branches');
    expect(result.canAdd).toBe(true);
    expect(result.rows[0]).toMatchObject({ name: 'Kitchen', itemsTagged: 86, head: { name: 'Grace Wanjiru' }, can: { rename: true, retire: true, restore: false } });
    expect(result.rows[1]?.can).toEqual({ rename: false, retire: false, restore: true });
  });

  it('a Branch Manager cannot ask for another branch (the query is ignored)', async () => {
    expect((await departmentsService.list(manager, { branchId: OTHER })).branch.id).toBe(SITE);
  });

  it('a hub role picks a branch, gets the picker, and can only read', async () => {
    const result = await departmentsService.list(director, { branchId: OTHER });
    expect(result.branch.id).toBe(OTHER);
    expect(result.branches).toHaveLength(2);
    expect(result.canAdd).toBe(false);
    expect(result.rows.every((r) => !r.can.rename && !r.can.retire && !r.can.restore)).toBe(true);
  });

  it('takes the first branch when a hub role picks none; the System Admin can write', async () => {
    expect((await departmentsService.list(storeManager, {})).branch.id).toBe(SITE);
    expect((await departmentsService.list(sysAdmin, {})).canAdd).toBe(true);
  });
});

describe('add (R24)', () => {
  it('adds with no legacy key at the next position, on the manager\'s own branch', async () => {
    const row = await departmentsService.add(manager, { branchId: SITE, name: 'Garden' });
    expect(departmentRowSchema.safeParse(row).success).toBe(true);
    expect(repo.create).toHaveBeenCalledWith(SITE, 'Garden');
    expect(row.key).toBeNull();
  });
  it('refuses a name the branch already has (409 DEPARTMENT_NAME_TAKEN)', async () => {
    repo.findByName.mockResolvedValue({ id: 'x' });
    expect(await codeOf(departmentsService.add(manager, { branchId: SITE, name: 'kitchen' }))).toBe('DEPARTMENT_NAME_TAKEN');
  });
  it('refuses another branch (403 WRONG_BRANCH) and every read-only role', async () => {
    expect(await codeOf(departmentsService.add(otherManager, { branchId: SITE, name: 'Garden' }))).toBe('WRONG_BRANCH');
    expect(await codeOf(departmentsService.add(director, { branchId: SITE, name: 'Garden' }))).toBe('AUTHORIZATION_ERROR');
    expect(await codeOf(departmentsService.add(storeManager, { branchId: SITE, name: 'Garden' }))).toBe('AUTHORIZATION_ERROR');
  });
  it('the System Admin may add to any branch', async () => {
    expect(await codeOf(departmentsService.add(sysAdmin, { branchId: OTHER, name: 'Garden' }))).toBe('NO_ERROR');
  });
});

describe('rename, retire, restore (R25, R26)', () => {
  const kitchenId = dept('1', 'Kitchen').id;
  const gardenId = dept('9', 'Garden').id;

  it('renames without touching the legacy key (the repository is asked for the name only)', async () => {
    await departmentsService.rename(manager, kitchenId, { name: 'Main kitchen' });
    expect(repo.rename).toHaveBeenCalledWith(kitchenId, SITE, 'Main kitchen');
  });
  it('refuses a rename onto another department\'s name, and a rename of a retired one', async () => {
    repo.findByName.mockResolvedValue({ id: 'other' });
    expect(await codeOf(departmentsService.rename(manager, kitchenId, { name: 'Barista' }))).toBe('DEPARTMENT_NAME_TAKEN');
    expect(await codeOf(departmentsService.rename(manager, gardenId, { name: 'Yard' }))).toBe('DEPARTMENT_RETIRED');
  });
  it('retire and restore flip the status; doing either twice is refused', async () => {
    await departmentsService.retire(manager, kitchenId);
    expect(repo.setStatus).toHaveBeenCalledWith(kitchenId, SITE, 'RETIRED');
    expect(await codeOf(departmentsService.retire(manager, gardenId))).toBe('DEPARTMENT_RETIRED');
    await departmentsService.restore(manager, gardenId);
    expect(repo.setStatus).toHaveBeenCalledWith(gardenId, SITE, 'ACTIVE');
    expect(await codeOf(departmentsService.restore(manager, kitchenId))).toBe('DEPARTMENT_ACTIVE');
  });
  it('a manager of another branch gets 403 WRONG_BRANCH; an unknown id is not found', async () => {
    expect(await codeOf(departmentsService.retire(otherManager, kitchenId))).toBe('WRONG_BRANCH');
    expect(await codeOf(departmentsService.retire(manager, 'b0000000-0000-4000-8000-0000000000ff'))).toBe('NOT_FOUND');
  });
});
