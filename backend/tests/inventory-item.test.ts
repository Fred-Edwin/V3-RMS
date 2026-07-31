import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { inventoryItemService } from '../src/services/inventory-item-service';
import { NotFoundError, ValidationError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const organizationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const managerToken = signAccessToken({
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'STORE_MANAGER',
  organizationId,
});

const attendantToken = signAccessToken({
  userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'STORE_ATTENDANT',
  organizationId,
});

const waiterToken = signAccessToken({
  userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  role: 'WAITER',
  organizationId,
});

const itemId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const locationId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const buildItem = (overrides: Record<string, unknown> = {}) => ({
  id: itemId,
  organizationId,
  name: 'Chicken Breast',
  type: 'RAW',
  buyUnit: 'kg',
  usageUnit: 'g',
  conversionFactor: '1000',
  reorderLevel: '10',
  departmentTags: ['KITCHEN'],
  currentCost: '350.5',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const validCreateBody = {
  name: 'Chicken Breast',
  type: 'RAW',
  buyUnit: 'kg',
  usageUnit: 'g',
  conversionFactor: '1000',
  reorderLevel: '10',
  departmentTags: ['KITCHEN'],
};

describe('Inventory Item routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RBAC enforcement', () => {
    it('GET /inventory-items blocks waiter (403)', async () => {
      const res = await request(app)
        .get('/api/v1/inventory-items')
        .set('Authorization', `Bearer ${waiterToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /inventory-items returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/inventory-items');
      expect(res.status).toBe(401);
    });

    it('GET /inventory-items allows attendant (read)', async () => {
      vi.spyOn(inventoryItemService, 'list').mockResolvedValue([buildItem()] as never);
      const res = await request(app)
        .get('/api/v1/inventory-items')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /inventory-items blocks attendant (403)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory-items')
        .set('Authorization', `Bearer ${attendantToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(403);
    });

    it('PATCH /inventory-items/:id blocks attendant (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory-items/${itemId}`)
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ name: 'Updated' });
      expect(res.status).toBe(403);
    });

    it('DELETE /inventory-items/:id blocks attendant (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/inventory-items/${itemId}`)
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('happy paths (Manager)', () => {
    it('POST /inventory-items creates an item', async () => {
      vi.spyOn(inventoryItemService, 'create').mockResolvedValue(buildItem() as never);
      const res = await request(app)
        .post('/api/v1/inventory-items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Chicken Breast');
      expect(res.body.data.currentCost).toBeDefined();
    });

    it('currentCost is never accepted from the client (not client-settable)', async () => {
      vi.spyOn(inventoryItemService, 'create').mockImplementation(async (_actor, input) => {
        // Assert the service never receives a currentCost field, even if sent.
        expect((input as Record<string, unknown>).currentCost).toBeUndefined();
        return buildItem() as never;
      });
      const res = await request(app)
        .post('/api/v1/inventory-items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, currentCost: '999999' });
      expect(res.status).toBe(201);
    });

    it('PATCH /inventory-items/:id updates an item', async () => {
      vi.spyOn(inventoryItemService, 'update').mockResolvedValue(
        buildItem({ name: 'Updated Chicken' }) as never,
      );
      const res = await request(app)
        .patch(`/api/v1/inventory-items/${itemId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Updated Chicken' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Chicken');
    });

    it('DELETE /inventory-items/:id deactivates (soft delete) an item', async () => {
      vi.spyOn(inventoryItemService, 'deactivate').mockResolvedValue(
        buildItem({ isActive: false }) as never,
      );
      const res = await request(app)
        .delete(`/api/v1/inventory-items/${itemId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('DELETE /inventory-items/:id returns 404 for unknown item', async () => {
      vi.spyOn(inventoryItemService, 'deactivate').mockRejectedValue(
        new NotFoundError('Inventory item not found'),
      );
      const res = await request(app)
        .delete(`/api/v1/inventory-items/${itemId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(404);
    });

    it('GET /inventory-items/low-stock returns low-stock items derived from the ledger', async () => {
      vi.spyOn(inventoryItemService, 'listLowStock').mockResolvedValue([
        { ...buildItem(), onHandQty: '3' } as never,
      ]);
      const res = await request(app)
        .get(`/api/v1/inventory-items/low-stock?locationId=${locationId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0].onHandQty).toBe('3');
    });

    it('GET /inventory-items?locationId=... passes locationId through to the service (Stock on Hand)', async () => {
      const listSpy = vi
        .spyOn(inventoryItemService, 'list')
        .mockResolvedValue([{ ...buildItem(), onHandQty: '48.7' }] as never);
      const res = await request(app)
        .get(`/api/v1/inventory-items?locationId=${locationId}`)
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0].onHandQty).toBe('48.7');
      expect(listSpy).toHaveBeenCalledWith(expect.anything(), undefined, locationId);
    });

    it('GET /inventory-items without locationId still works (onHandQty simply absent)', async () => {
      vi.spyOn(inventoryItemService, 'list').mockResolvedValue([buildItem()] as never);
      const res = await request(app)
        .get('/api/v1/inventory-items')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0].onHandQty).toBeUndefined();
    });

    it('GET /inventory-items/:id/transactions returns the item\'s movement history (Stock on Hand side panel)', async () => {
      const txSpy = vi.spyOn(inventoryItemService, 'getTransactions').mockResolvedValue([
        { id: 'tx-1', type: 'RECEIVE', quantity: '10', unitCost: '350.5', createdAt: new Date().toISOString() },
      ] as never);
      const res = await request(app)
        .get(`/api/v1/inventory-items/${itemId}/transactions?locationId=${locationId}`)
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0].type).toBe('RECEIVE');
      expect(txSpy).toHaveBeenCalledWith(expect.anything(), itemId, locationId);
    });

    it('GET /inventory-items/:id/transactions rejects missing locationId (400)', async () => {
      const res = await request(app)
        .get(`/api/v1/inventory-items/${itemId}/transactions`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('validation failures (400)', () => {
    it('POST /inventory-items rejects missing name', async () => {
      const res = await request(app)
        .post('/api/v1/inventory-items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, name: '' });
      expect(res.status).toBe(400);
    });

    it('POST /inventory-items rejects invalid type enum', async () => {
      const res = await request(app)
        .post('/api/v1/inventory-items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, type: 'NOT_A_TYPE' });
      expect(res.status).toBe(400);
    });

    it('POST /inventory-items rejects non-decimal conversionFactor', async () => {
      const res = await request(app)
        .post('/api/v1/inventory-items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, conversionFactor: 'abc' });
      expect(res.status).toBe(400);
    });

    it('POST /inventory-items rejects zero conversionFactor', async () => {
      const res = await request(app)
        .post('/api/v1/inventory-items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, conversionFactor: '0' });
      expect(res.status).toBe(400);
    });

    it('PATCH /inventory-items/:id rejects empty body', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory-items/${itemId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('GET /inventory-items/:id rejects non-UUID id param', async () => {
      const res = await request(app)
        .get('/api/v1/inventory-items/not-a-uuid')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(400);
    });

    it('service ValidationError (unknown defaultSupplierId) surfaces as 400', async () => {
      vi.spyOn(inventoryItemService, 'create').mockRejectedValue(
        new ValidationError('defaultSupplierId does not reference a known supplier'),
      );
      const res = await request(app)
        .post('/api/v1/inventory-items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, defaultSupplierId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
      expect(res.status).toBe(400);
    });
  });
});
