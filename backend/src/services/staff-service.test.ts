import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../repositories/branch-repository';
import { staffRepository } from '../repositories/staff-repository';
import { staffService } from './staff-service';
import { ForbiddenError, ValidationError } from '../utils/errors';

vi.mock('../repositories/staff-repository', () => ({
  staffRepository: {
    findByEmail: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../repositories/branch-repository', () => ({
  branchRepository: {
    findHub: vi.fn(),
  },
}));

vi.mock('../repositories/auth-repository', () => ({
  authRepository: {
    deleteAllRefreshTokensByUserId: vi.fn(),
  },
}));

vi.mock('../utils/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const branchOrgId = '22222222-2222-4222-8222-222222222222';

const admin = { id: 'admin', role: 'SYSTEM_ADMIN' as const, organizationId: null };
const branchManager = { id: 'mgr', role: 'MANAGER' as const, organizationId: branchOrgId };
const storeManager = { id: 'sm', role: 'STORE_MANAGER' as const, organizationId: hubOrgId };

const baseInput = {
  name: 'Test User',
  email: 'new.user@wendo.test',
  temporaryPassword: 'secret123',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(staffRepository.findByEmail).mockResolvedValue(null);
  vi.mocked(staffRepository.create).mockImplementation(
    async (data) =>
      ({
        ...data,
        id: 'created',
        organization: { name: 'Central Store' },
      }) as never,
  );
});

describe('staffService.createStaff — store roles are hub-org only (design doc D-15)', () => {
  it('forces store-role accounts onto the hub org even when admin sends none', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);

    await staffService.createStaff({ ...baseInput, role: 'STORE_ATTENDANT' }, admin);

    expect(staffRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: hubOrgId, role: 'STORE_ATTENDANT' }),
    );
  });

  it('rejects a store-role account aimed at a branch org', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);

    await expect(
      staffService.createStaff(
        { ...baseInput, role: 'STORE_MANAGER', organizationId: branchOrgId },
        admin,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(staffRepository.create).not.toHaveBeenCalled();
  });

  it('rejects store-role creation when no hub org is flagged', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue(null);

    await expect(
      staffService.createStaff({ ...baseInput, role: 'STORE_MANAGER' }, admin),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('branch Managers can no longer create store roles', async () => {
    await expect(
      staffService.createStaff({ ...baseInput, role: 'STORE_ATTENDANT' }, branchManager),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('staffService.createStaff — Store Manager creates attendants', () => {
  it('allows a Store Manager to create a STORE_ATTENDANT in their own org', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);

    await staffService.createStaff({ ...baseInput, role: 'STORE_ATTENDANT' }, storeManager);

    expect(staffRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: hubOrgId, role: 'STORE_ATTENDANT' }),
    );
  });

  it('forbids a Store Manager from creating any other role', async () => {
    await expect(
      staffService.createStaff({ ...baseInput, role: 'STORE_MANAGER' }, storeManager),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      staffService.createStaff({ ...baseInput, role: 'WAITER' }, storeManager),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
