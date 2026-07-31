import { beforeEach, describe, expect, it, vi } from 'vitest';

// Covers STORE_ROLES_STAFF_INTEGRATION.md item 6: staffRepository.findMessagingContacts
// has its own hardcoded branch-staff role filter (separate from staff-service.ts's
// branchStaffRoles) that previously omitted STORE_MANAGER/STORE_ATTENDANT.

const findManyMock = vi.fn().mockResolvedValue([]);

vi.mock('../src/config/database', () => ({
  prisma: {
    user: {
      findMany: findManyMock,
    },
  },
}));

describe('staffRepository.findMessagingContacts', () => {
  beforeEach(() => {
    findManyMock.mockClear();
  });

  it('includes STORE_MANAGER and STORE_ATTENDANT in the branch-staff role filter', async () => {
    const { staffRepository } = await import('../src/repositories/staff-repository');

    await staffRepository.findMessagingContacts('org-1', 'user-1');

    const branchStaffCall = findManyMock.mock.calls.find(
      (call) => call[0]?.where?.organizationId === 'org-1',
    );
    expect(branchStaffCall).toBeDefined();
    expect(branchStaffCall![0].where.role.in).toEqual(expect.arrayContaining(['STORE_MANAGER', 'STORE_ATTENDANT']));
  });
});
