import { beforeEach, describe, expect, it, vi } from 'vitest';
import { departmentRepository } from '../repositories/department-repository';
import { departmentService } from './department-service';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

vi.mock('../repositories/department-repository', () => ({
  departmentRepository: {
    findSite: vi.fn(),
    findHeadByDepartment: vi.fn(),
    listMembersByDepartment: vi.fn(),
    findEligibleStaff: vi.fn(),
    findStaffById: vi.fn(),
    assignHead: vi.fn(),
    unassignHead: vi.fn(),
  },
}));

const branchOrgId = '11111111-1111-4111-8111-111111111111';
const otherBranchOrgId = '22222222-2222-4222-8222-222222222222';
const hubOrgId = '33333333-3333-4333-8333-333333333333';
const staffId = '44444444-4444-4444-8444-444444444444';
const headId = '55555555-5555-4555-8555-555555555555';

const managerActor = { id: 'm1', role: 'MANAGER' as const, siteId: branchOrgId };
const directorActor = { id: 'd1', role: 'DIRECTOR' as const, siteId: null };
const otherBranchManager = { id: 'm2', role: 'MANAGER' as const, siteId: otherBranchOrgId };

const branchOrg = { id: branchOrgId, name: 'Branch A', isHub: false, isActive: true };
const hubOrg = { id: hubOrgId, name: 'Central Store', isHub: true, isActive: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('departmentService.assignHead', () => {
  it('assigns a department head at the manager\'s own branch', async () => {
    vi.mocked(departmentRepository.findSite).mockResolvedValue(branchOrg as never);
    vi.mocked(departmentRepository.findStaffById).mockResolvedValue({
      id: staffId,
      siteId: branchOrgId,
      isActive: true,
      role: 'WAITER',
    } as never);
    vi.mocked(departmentRepository.assignHead).mockResolvedValue({
      id: staffId,
      role: 'WAITER',
      isDepartmentHead: true,
      departmentTag: 'KITCHEN',
    } as never);

    const result = await departmentService.assignHead(managerActor, branchOrgId, 'KITCHEN', staffId);

    expect(departmentRepository.assignHead).toHaveBeenCalledWith(staffId, 'KITCHEN');
    // Marker model: the person keeps their real role; only the head marker + tag change.
    expect(result.role).toBe('WAITER');
    expect(result.isDepartmentHead).toBe(true);
  });

  it('rejects a manager assigning a head at a different branch', async () => {
    await expect(
      departmentService.assignHead(otherBranchManager, branchOrgId, 'KITCHEN', staffId),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(departmentRepository.assignHead).not.toHaveBeenCalled();
  });

  it('allows a Director to assign a head at any branch', async () => {
    vi.mocked(departmentRepository.findSite).mockResolvedValue(branchOrg as never);
    vi.mocked(departmentRepository.findStaffById).mockResolvedValue({
      id: staffId,
      siteId: branchOrgId,
      isActive: true,
      role: 'WAITER',
    } as never);
    vi.mocked(departmentRepository.assignHead).mockResolvedValue({ id: staffId } as never);

    await departmentService.assignHead(directorActor, branchOrgId, 'PASTRY', staffId);

    expect(departmentRepository.assignHead).toHaveBeenCalledWith(staffId, 'PASTRY');
  });

  it('rejects assignment against the hub organization — the hub has no departments', async () => {
    vi.mocked(departmentRepository.findSite).mockResolvedValue(hubOrg as never);

    await expect(
      departmentService.assignHead(directorActor, hubOrgId, 'KITCHEN', staffId),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(departmentRepository.assignHead).not.toHaveBeenCalled();
  });

  it('rejects assigning a staff member not found at this branch', async () => {
    vi.mocked(departmentRepository.findSite).mockResolvedValue(branchOrg as never);
    vi.mocked(departmentRepository.findStaffById).mockResolvedValue(null);

    await expect(
      departmentService.assignHead(managerActor, branchOrgId, 'KITCHEN', staffId),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(departmentRepository.assignHead).not.toHaveBeenCalled();
  });

  it('rejects assigning an inactive staff member', async () => {
    vi.mocked(departmentRepository.findSite).mockResolvedValue(branchOrg as never);
    vi.mocked(departmentRepository.findStaffById).mockResolvedValue({
      id: staffId,
      siteId: branchOrgId,
      isActive: false,
      role: 'WAITER',
    } as never);

    await expect(
      departmentService.assignHead(managerActor, branchOrgId, 'KITCHEN', staffId),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('departmentService.unassignHead — marker cleared (Q3)', () => {
  it('clears the head marker and department tag, leaving the base role intact', async () => {
    vi.mocked(departmentRepository.findSite).mockResolvedValue(branchOrg as never);
    vi.mocked(departmentRepository.findHeadByDepartment).mockResolvedValue({
      id: headId,
      role: 'BARISTA',
      isDepartmentHead: true,
      departmentTag: 'BARISTA',
    } as never);
    vi.mocked(departmentRepository.unassignHead).mockResolvedValue({
      id: headId,
      role: 'BARISTA',
      isDepartmentHead: false,
      departmentTag: null,
    } as never);

    const result = await departmentService.unassignHead(managerActor, branchOrgId, 'BARISTA');

    expect(departmentRepository.unassignHead).toHaveBeenCalledWith(headId);
    expect(result.role).toBe('BARISTA');
    expect(result.isDepartmentHead).toBe(false);
    expect(result.departmentTag).toBeNull();
  });

  it('rejects unassigning when no head is currently assigned', async () => {
    vi.mocked(departmentRepository.findSite).mockResolvedValue(branchOrg as never);
    vi.mocked(departmentRepository.findHeadByDepartment).mockResolvedValue(null);

    await expect(
      departmentService.unassignHead(managerActor, branchOrgId, 'BARISTA'),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(departmentRepository.unassignHead).not.toHaveBeenCalled();
  });

  it('rejects a manager unassigning a head at a different branch', async () => {
    await expect(
      departmentService.unassignHead(otherBranchManager, branchOrgId, 'BARISTA'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(departmentRepository.unassignHead).not.toHaveBeenCalled();
  });
});

describe('departmentService.listDepartments', () => {
  it('rejects a manager listing departments for a different branch', async () => {
    await expect(
      departmentService.listDepartments(otherBranchManager, branchOrgId),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('returns all five departments with head and members', async () => {
    vi.mocked(departmentRepository.findSite).mockResolvedValue(branchOrg as never);
    vi.mocked(departmentRepository.findHeadByDepartment).mockResolvedValue(null);
    vi.mocked(departmentRepository.listMembersByDepartment).mockResolvedValue([] as never);

    const result = await departmentService.listDepartments(managerActor, branchOrgId);

    expect(result).toHaveLength(5);
    expect(result.map((d) => d.departmentTag)).toEqual([
      'KITCHEN',
      'PASTRY',
      'BARISTA',
      'SERVICE',
      'HOUSEKEEPING',
    ]);
    // `members` replaces the old `staffCount` — it is the roster line's data
    // and its length is the count.
    expect(result[0]).toHaveProperty('members', []);
    expect(result[0]).not.toHaveProperty('staffCount');
  });

  it('threads each department\'s members through from the repository', async () => {
    const kitchenMembers = [
      { id: 'u1', name: 'Ann Njeri', role: 'CHEF' },
      { id: 'u2', name: 'Ben Otieno', role: 'CHEF' },
    ];
    vi.mocked(departmentRepository.findSite).mockResolvedValue(branchOrg as never);
    vi.mocked(departmentRepository.findHeadByDepartment).mockResolvedValue(null);
    vi.mocked(departmentRepository.listMembersByDepartment).mockImplementation(
      async (_orgId, tag) => (tag === 'KITCHEN' ? (kitchenMembers as never) : ([] as never)),
    );

    const result = await departmentService.listDepartments(managerActor, branchOrgId);

    const kitchen = result.find((d) => d.departmentTag === 'KITCHEN');
    expect(kitchen?.members).toEqual(kitchenMembers);
  });
});
