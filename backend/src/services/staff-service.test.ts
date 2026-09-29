import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../repositories/branch-repository';
import { staffRepository } from '../repositories/staff-repository';
import { staffService } from './staff-service';
import { authRepository } from '../repositories/auth-repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

vi.mock('../repositories/staff-repository', () => ({
  staffRepository: {
    findByEmail: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findTeamWithPinStatus: vi.fn(),
    updatePassword: vi.fn(),
    setActive: vi.fn(),
    clearPin: vi.fn(),
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

const attendantRow = {
  id: 'att-1',
  name: 'Susan Achieng',
  email: 'susan@wendo.test',
  phone: null,
  role: 'STORE_ATTENDANT' as const,
  isActive: true,
  organizationId: hubOrgId,
  createdAt: new Date(),
  organization: { name: 'Central Store' },
};

describe('staffService — Store Manager team scope', () => {
  it('lists only hub-org attendants (with PIN status) for a Store Manager', async () => {
    vi.mocked(staffRepository.findTeamWithPinStatus).mockResolvedValue([
      { ...attendantRow, hasPin: false },
    ] as never);

    const team = await staffService.listStaff(storeManager, { role: 'WAITER', organizationId: branchOrgId });

    // Caller-supplied role/org filters are ignored — scope is fixed.
    expect(staffRepository.findTeamWithPinStatus).toHaveBeenCalledWith(hubOrgId, ['STORE_ATTENDANT'], undefined);
    expect(team[0]).toMatchObject({ id: 'att-1', hasPin: false });
    expect(team[0]).not.toHaveProperty('pinHash');
  });

  it('scopes reset-password to hub-org attendants', async () => {
    vi.mocked(staffRepository.findById).mockResolvedValue(attendantRow as never);

    await staffService.resetPassword('att-1', 'newsecret1', storeManager);

    expect(staffRepository.findById).toHaveBeenCalledWith('att-1', hubOrgId, ['STORE_ATTENDANT']);
    expect(staffRepository.updatePassword).toHaveBeenCalledWith('att-1', 'hashed', hubOrgId, ['STORE_ATTENDANT']);
    expect(authRepository.deleteAllRefreshTokensByUserId).toHaveBeenCalledWith('att-1');
  });

  it('cannot reset the password of anyone outside the scope (branch staff, other store managers)', async () => {
    vi.mocked(staffRepository.findById).mockResolvedValue(null);

    await expect(staffService.resetPassword('waiter-1', 'newsecret1', storeManager)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(staffRepository.updatePassword).not.toHaveBeenCalled();
  });

  it('scopes deactivate and reactivate to hub-org attendants', async () => {
    vi.mocked(staffRepository.setActive).mockResolvedValue({ count: 1 } as never);
    vi.mocked(staffRepository.findById).mockResolvedValue(attendantRow as never);

    await staffService.deactivateStaff('att-1', storeManager);
    await staffService.reactivateStaff('att-1', storeManager);

    expect(staffRepository.setActive).toHaveBeenNthCalledWith(1, 'att-1', false, hubOrgId, ['STORE_ATTENDANT']);
    expect(staffRepository.setActive).toHaveBeenNthCalledWith(2, 'att-1', true, hubOrgId, ['STORE_ATTENDANT']);
  });

  it('404s deactivate when the target is out of scope', async () => {
    vi.mocked(staffRepository.setActive).mockResolvedValue({ count: 0 } as never);

    await expect(staffService.deactivateStaff('mgr-2', storeManager)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses a Store Manager with no organization', async () => {
    const orphan = { id: 'sm2', role: 'STORE_MANAGER' as const, organizationId: null };

    await expect(staffService.listStaff(orphan)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(staffService.resetPin('att-1', orphan)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('staffService.resetPin', () => {
  it('clears the PIN of a hub-org attendant', async () => {
    vi.mocked(staffRepository.findById).mockResolvedValue(attendantRow as never);
    vi.mocked(staffRepository.clearPin).mockResolvedValue({ count: 1 } as never);

    await staffService.resetPin('att-1', storeManager);

    expect(staffRepository.findById).toHaveBeenCalledWith('att-1', hubOrgId, ['STORE_ATTENDANT']);
    expect(staffRepository.clearPin).toHaveBeenCalledWith('att-1', hubOrgId, ['STORE_ATTENDANT']);
  });

  it('404s for a target outside the Store Manager scope and clears nothing', async () => {
    vi.mocked(staffRepository.findById).mockResolvedValue(null);

    await expect(staffService.resetPin('waiter-1', storeManager)).rejects.toBeInstanceOf(NotFoundError);
    expect(staffRepository.clearPin).not.toHaveBeenCalled();
  });

  it('lets a System Admin reset any account PIN within its own org', async () => {
    vi.mocked(staffRepository.findById).mockResolvedValue(attendantRow as never);
    vi.mocked(staffRepository.clearPin).mockResolvedValue({ count: 1 } as never);

    await staffService.resetPin('att-1', admin);

    expect(staffRepository.clearPin).toHaveBeenCalledWith('att-1', hubOrgId, ['STORE_ATTENDANT']);
  });
});
