import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { inventoryService } from '../src/modules/inventory/inventory-service';
import { ForbiddenError, NotFoundError, ValidationError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const hubOrgId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const branchOrgId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const otherBranchOrgId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const managerToken = signAccessToken({
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'STORE_MANAGER',
  organizationId: hubOrgId,
});

const departmentHeadToken = signAccessToken({
  userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  role: 'DEPARTMENT_HEAD',
  organizationId: branchOrgId,
  departmentTag: 'KITCHEN',
});

const otherDepartmentHeadToken = signAccessToken({
  userId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  role: 'DEPARTMENT_HEAD',
  organizationId: otherBranchOrgId,
  departmentTag: 'BARISTA',
});

const waiterToken = signAccessToken({
  userId: '11111111-1111-4111-8111-111111111111',
  role: 'WAITER',
  organizationId: branchOrgId,
});

const centralStoreId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';

const buildRow = (overrides: Record<string, unknown> = {}) => ({
  inventoryItemId: itemId,
  itemName: 'Kabras Sugar 1kg',
  usageUnit: 'kg',
  onHandQty: '40',
  level: '100',
  isBelowLevel: true,
  ...overrides,
});

describe('Inventory restock-level routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RBAC enforcement', () => {
    it('GET /inventory/restock-levels returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/inventory/restock-levels');
      expect(res.status).toBe(401);
    });

    it('GET /inventory/restock-levels blocks waiter (403)', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/restock-levels')
        .set('Authorization', `Bearer ${waiterToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /inventory/restock-levels blocks Department Head from Central Store levels', async () => {
      vi.spyOn(inventoryService, 'listRestockLevels').mockRejectedValue(
        new ForbiddenError('Department Heads set restock levels for their own department only'),
      );
      const res = await request(app)
        .get(`/api/v1/inventory/restock-levels?locationId=${centralStoreId}`)
        .set('Authorization', `Bearer ${departmentHeadToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('happy paths', () => {
    it('GET /inventory/restock-levels (Store Manager, Central Store) returns rows with derived onHandQty', async () => {
      vi.spyOn(inventoryService, 'listRestockLevels').mockResolvedValue([buildRow()] as never);
      const res = await request(app)
        .get(`/api/v1/inventory/restock-levels?locationId=${centralStoreId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0].onHandQty).toBe('40');
      expect(res.body.data[0].isBelowLevel).toBe(true);
    });

    it('GET /inventory/restock-levels (Department Head, implicit own department) omits locationId', async () => {
      const spy = vi.spyOn(inventoryService, 'listRestockLevels').mockResolvedValue([buildRow()] as never);
      const res = await request(app)
        .get('/api/v1/inventory/restock-levels')
        .set('Authorization', `Bearer ${departmentHeadToken}`);
      expect(res.status).toBe(200);
      const [actorArg, queryArg] = spy.mock.calls[0]!;
      expect(actorArg).toMatchObject({ role: 'DEPARTMENT_HEAD', departmentTag: 'KITCHEN' });
      expect((queryArg as { locationId?: string }).locationId).toBeUndefined();
    });

    it('PUT /inventory/restock-levels bulk-saves in one atomic request', async () => {
      const spy = vi.spyOn(inventoryService, 'saveRestockLevels').mockResolvedValue([buildRow()] as never);
      const res = await request(app)
        .put('/api/v1/inventory/restock-levels')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          locationId: centralStoreId,
          levels: [
            { inventoryItemId: itemId, level: '120' },
            { inventoryItemId: '44444444-4444-4444-8444-444444444444', level: null },
          ],
        });
      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('PUT /inventory/restock-levels accepts level: null to clear a row (Flow 19)', async () => {
      vi.spyOn(inventoryService, 'saveRestockLevels').mockResolvedValue([buildRow({ level: null, isBelowLevel: false })] as never);
      const res = await request(app)
        .put('/api/v1/inventory/restock-levels')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ locationId: centralStoreId, levels: [{ inventoryItemId: itemId, level: null }] });
      expect(res.status).toBe(200);
      expect(res.body.data[0].level).toBeNull();
    });
  });

  describe('D-15 and department tenant isolation', () => {
    it('a Department Head cannot set levels scoped to a different department (service rejection surfaces as 403)', async () => {
      vi.spyOn(inventoryService, 'saveRestockLevels').mockRejectedValue(
        new ForbiddenError('You may only set restock levels for items scoped to your own department'),
      );
      const res = await request(app)
        .put('/api/v1/inventory/restock-levels')
        .set('Authorization', `Bearer ${otherDepartmentHeadToken}`)
        .send({ levels: [{ inventoryItemId: itemId, level: '10' }] });
      expect(res.status).toBe(403);
    });

    it('a non-hub Store Manager is rejected (403), not silently scoped to their own org', async () => {
      vi.spyOn(inventoryService, 'saveRestockLevels').mockRejectedValue(
        new ForbiddenError('Only the hub organization may access Central Store inventory data'),
      );
      const res = await request(app)
        .put('/api/v1/inventory/restock-levels')
        .set('Authorization', `Bearer ${departmentHeadToken}`)
        .send({ locationId: centralStoreId, levels: [{ inventoryItemId: itemId, level: '10' }] });
      expect(res.status).toBe(403);
    });
  });

  describe('validation failures (400)', () => {
    it('PUT /inventory/restock-levels rejects an empty levels array', async () => {
      const res = await request(app)
        .put('/api/v1/inventory/restock-levels')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ locationId: centralStoreId, levels: [] });
      expect(res.status).toBe(400);
    });

    it('PUT /inventory/restock-levels rejects a negative level', async () => {
      const res = await request(app)
        .put('/api/v1/inventory/restock-levels')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ locationId: centralStoreId, levels: [{ inventoryItemId: itemId, level: '-5' }] });
      expect(res.status).toBe(400);
    });

    it('PUT /inventory/restock-levels accepts a zero level (par set to zero is valid)', async () => {
      vi.spyOn(inventoryService, 'saveRestockLevels').mockResolvedValue([buildRow({ level: '0' })] as never);
      const res = await request(app)
        .put('/api/v1/inventory/restock-levels')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ locationId: centralStoreId, levels: [{ inventoryItemId: itemId, level: '0' }] });
      expect(res.status).toBe(200);
    });

    it('service ValidationError (locationId not the Central Store) surfaces as 400', async () => {
      vi.spyOn(inventoryService, 'saveRestockLevels').mockRejectedValue(
        new ValidationError('locationId must be the Central Store'),
      );
      const res = await request(app)
        .put('/api/v1/inventory/restock-levels')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ locationId: '55555555-5555-4555-8555-555555555555', levels: [{ inventoryItemId: itemId, level: '10' }] });
      expect(res.status).toBe(400);
    });
  });
});

describe('GET /inventory/central-store-location', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/v1/inventory/central-store-location');
    expect(res.status).toBe(401);
  });

  it('blocks a Department Head (403) — Store Manager only', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/central-store-location')
      .set('Authorization', `Bearer ${departmentHeadToken}`);
    expect(res.status).toBe(403);
  });

  it('returns the Central Store id for a hub Store Manager', async () => {
    vi.spyOn(inventoryService, 'getCentralStoreLocation').mockResolvedValue({ id: centralStoreId });
    const res = await request(app)
      .get('/api/v1/inventory/central-store-location')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: centralStoreId });
  });

  it('surfaces a NotFoundError as 404 when no Central Store is configured', async () => {
    vi.spyOn(inventoryService, 'getCentralStoreLocation').mockRejectedValue(
      new NotFoundError('No Central Store is configured for this organization'),
    );
    const res = await request(app)
      .get('/api/v1/inventory/central-store-location')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(404);
  });
});
