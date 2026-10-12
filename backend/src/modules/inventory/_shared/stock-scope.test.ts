/**
 * Org-scoping for Session 1 (plan §4.5): a department head can't read or
 * write another department, a Branch Manager can't reach another branch,
 * the Store Manager stays on the Central Store, and the Store Attendant is
 * refused the stock list and the ledger at the route (403).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLedgerScope } from './stock-scope';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';

vi.mock('../../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn(), findById: vi.fn() },
}));

vi.mock('../../../repositories/location-repository', () => ({
  locationRepository: { findCentralStore: vi.fn(), findBySiteTypeDepartment: vi.fn(), findById: vi.fn() },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const nyeriTownId = '22222222-2222-4222-8222-222222222222';
const centralStoreId = '55555555-5555-4555-8555-555555555555';
const townKitchenId = '66666666-6666-4666-8666-666666666666';
const highwayKitchenId = '77777777-7777-4777-8777-777777777777';

const centralStore = { id: centralStoreId, siteId: hubOrgId, type: 'CENTRAL_STORE', departmentTag: null, name: 'Central Store' };
const townKitchen = { id: townKitchenId, siteId: nyeriTownId, type: 'BRANCH_DEPARTMENT', departmentTag: 'KITCHEN', name: 'Nyeri Town — Kitchen' };

const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, siteId: hubOrgId };
const attendant = { id: 'sa1', role: 'STORE_ATTENDANT' as const, siteId: hubOrgId };
const townManager = { id: 'm1', role: 'MANAGER' as const, siteId: nyeriTownId };
const townKitchenHead = {
  id: 'dh1',
  role: 'CHEF' as const,
  siteId: nyeriTownId,
  isDepartmentHead: true,
  departmentTag: 'KITCHEN' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
  vi.mocked(branchRepository.findById).mockResolvedValue({ id: nyeriTownId, name: 'Nyeri Town' } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
  vi.mocked(locationRepository.findBySiteTypeDepartment).mockResolvedValue(townKitchen as never);
  // findById is org-scoped: a location on another org is simply not found.
  vi.mocked(locationRepository.findById).mockImplementation(async (id, siteId) =>
    (id === townKitchenId && siteId === nyeriTownId ? townKitchen : null) as never,
  );
});

describe('resolveLedgerScope', () => {
  it('department head: own department, whatever the request omits', async () => {
    const scope = await resolveLedgerScope(townKitchenHead, undefined);
    expect(scope).toMatchObject({ locationId: townKitchenId, locationOrgId: nyeriTownId, itemOrgId: hubOrgId, branchName: 'Nyeri Town' });
  });

  it('department head: another department’s location is 403', async () => {
    await expect(resolveLedgerScope(townKitchenHead, highwayKitchenId)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('Branch Manager: own branch department is allowed', async () => {
    const scope = await resolveLedgerScope(townManager, townKitchenId);
    expect(scope.locationId).toBe(townKitchenId);
  });

  it('Branch Manager: another branch’s department is 403', async () => {
    await expect(resolveLedgerScope(townManager, highwayKitchenId)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('Branch Manager: the Central Store is 403', async () => {
    await expect(resolveLedgerScope(townManager, centralStoreId)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('Store Manager: Central Store by default; any other location is 403', async () => {
    await expect(resolveLedgerScope(storeManager, undefined)).resolves.toMatchObject({ locationId: centralStoreId });
    await expect(resolveLedgerScope(storeManager, townKitchenId)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('Store Attendant: 403 in the service too (second wall behind the route)', async () => {
    await expect(resolveLedgerScope(attendant, undefined)).rejects.toMatchObject({ statusCode: 403 });
  });
});
