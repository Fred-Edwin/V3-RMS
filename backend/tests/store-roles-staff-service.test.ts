import { beforeEach, describe, expect, it, vi } from 'vitest';
import { staffRepository } from '../src/repositories/staff-repository';
import { staffService } from '../src/services/staff-service';

// Covers STORE_ROLES_STAFF_INTEGRATION.md item 6: a branch MANAGER's staff
// list and a cross-branch DIRECTOR/HR_MANAGER's messaging contact list must
// include STORE_MANAGER/STORE_ATTENDANT, which were previously absent from
// staff-service.ts's hand-maintained role arrays.

const organizationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('Store roles — staff directory visibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("listStaff scopes a MANAGER's branch query to include STORE_MANAGER/STORE_ATTENDANT", async () => {
    const spy = vi.spyOn(staffRepository, 'findMany').mockResolvedValue([]);

    await staffService.listStaff({
      id: 'manager-1',
      role: 'MANAGER',
      organizationId,
    } as never);

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedRoles: expect.arrayContaining(['STORE_MANAGER', 'STORE_ATTENDANT']),
      }),
    );
  });

  it("getMessagingContacts for a DIRECTOR includes STORE_MANAGER/STORE_ATTENDANT in cross-branch allowedRoles", async () => {
    const spy = vi.spyOn(staffRepository, 'findMany').mockResolvedValue([]);

    await staffService.getMessagingContacts({
      id: 'director-1',
      role: 'DIRECTOR',
      organizationId: null,
    } as never);

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedRoles: expect.arrayContaining(['STORE_MANAGER', 'STORE_ATTENDANT']),
      }),
    );
  });

  it('getMessagingContacts for a branch MANAGER delegates to findMessagingContacts (branch-scoped query includes Store roles)', async () => {
    const spy = vi.spyOn(staffRepository, 'findMessagingContacts').mockResolvedValue([]);

    await staffService.getMessagingContacts({
      id: 'manager-1',
      role: 'MANAGER',
      organizationId,
    } as never);

    expect(spy).toHaveBeenCalledWith(organizationId, 'manager-1');
  });
});
