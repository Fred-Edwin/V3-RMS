import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { inventoryService } from '../src/modules/inventory/catalog/inventory-service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const hubOrgId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const branchOrgId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const managerToken = signAccessToken({
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'STORE_MANAGER',
  organizationId: hubOrgId,
});

const branchManagerToken = signAccessToken({
  userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  role: 'STORE_MANAGER',
  organizationId: branchOrgId,
});

const attendantToken = signAccessToken({
  userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  role: 'STORE_ATTENDANT',
  organizationId: hubOrgId,
});

const waiterToken = signAccessToken({
  userId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  role: 'WAITER',
  organizationId: hubOrgId,
});

const itemId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';

const buildCategory = (overrides: Record<string, unknown> = {}) => ({
  id: categoryId,
  name: 'Dry items',
  itemCount: 12,
  retiredAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const buildItem = (overrides: Record<string, unknown> = {}) => ({
  id: itemId,
  name: 'Kabras Sugar 1kg',
  type: 'RAW_INGREDIENT',
  categoryId,
  preferredSupplierId: null,
  buyUnit: 'kg',
  usageUnit: 'kg',
  conversionFactor: '1',
  packSize: null,
  departmentTags: [],
  category: { id: categoryId, name: 'Dry items' },
  preferredSupplier: null,
  currentCost: '155',
  retiredAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const catalogMeta = {
  itemsTracked: 23,
  typesRepresented: 3,
  categoryCount: 2,
  retiredCategoryCount: 0,
  departmentCount: 5,
  supplierCount: 2,
};

const validCreateBody = {
  name: 'Kabras Sugar 1kg',
  type: 'RAW_INGREDIENT',
  buyUnit: 'kg',
  usageUnit: 'kg',
  conversionFactor: '1',
  departmentTags: [],
};

describe('Inventory catalog routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RBAC enforcement', () => {
    it('GET /inventory/items returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/inventory/items');
      expect(res.status).toBe(401);
    });

    it('GET /inventory/items blocks waiter (403)', async () => {
      const res = await request(app).get('/api/v1/inventory/items').set('Authorization', `Bearer ${waiterToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /inventory/items allows attendant (read)', async () => {
      vi.spyOn(inventoryService, 'listItems').mockResolvedValue({
        data: [buildItem()],
        pagination: { total: 1, page: 1, perPage: 20, totalPages: 1 },
        meta: catalogMeta,
      } as never);
      const res = await request(app).get('/api/v1/inventory/items').set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /inventory/items admits the attendant to the service (B12); the type rule is the service’s', async () => {
      const spy = vi.spyOn(inventoryService, 'createItem').mockResolvedValue({ item: buildItem(), warnings: [] } as never);
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${attendantToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
      expect(spy.mock.calls[0]![0]).toMatchObject({ role: 'STORE_ATTENDANT' });
    });

    it('POST /inventory/items surfaces the attendant’s PREPPED refusal as 403', async () => {
      vi.spyOn(inventoryService, 'createItem').mockRejectedValue(new ForbiddenError('Store Attendants can add stocked and raw-ingredient items only'));
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ ...validCreateBody, type: 'PREPPED' });
      expect(res.status).toBe(403);
    });

    it('POST /inventory/items still blocks a waiter (403)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(403);
    });

    it('PATCH /inventory/items/:id still blocks the attendant (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ name: 'Renamed' });
      expect(res.status).toBe(403);
    });

    it('DELETE /inventory/items/:id blocks attendant (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /inventory/categories blocks waiter (403)', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${waiterToken}`);
      expect(res.status).toBe(403);
    });

    it('POST /inventory/categories blocks attendant (403)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ name: 'Dry items' });
      expect(res.status).toBe(403);
    });
  });

  describe('D-15 tenant isolation', () => {
    it('a non-hub Store Manager is rejected with 403, not an empty list', async () => {
      vi.spyOn(inventoryService, 'listItems').mockRejectedValue(
        new ForbiddenError('Only the hub organization may access Central Store inventory data'),
      );
      const res = await request(app)
        .get('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${branchManagerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('happy paths (Manager)', () => {
    it('GET /inventory/items returns the KPI meta strip', async () => {
      vi.spyOn(inventoryService, 'listItems').mockResolvedValue({
        data: [buildItem()],
        pagination: { total: 1, page: 1, perPage: 20, totalPages: 1 },
        meta: catalogMeta,
      } as never);
      const res = await request(app).get('/api/v1/inventory/items').set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual(catalogMeta);
    });

    it('POST /inventory/items creates an item and returns the mutation envelope', async () => {
      vi.spyOn(inventoryService, 'createItem').mockResolvedValue({ item: buildItem(), warnings: [] } as never);
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
      expect(res.body.data.item.name).toBe('Kabras Sugar 1kg');
      expect(res.body.data.warnings).toEqual([]);
    });

    it('POST /inventory/items surfaces a duplicate-name warning with 200-equivalent success (201, not an error status)', async () => {
      vi.spyOn(inventoryService, 'createItem').mockResolvedValue({
        item: buildItem(),
        warnings: [{ code: 'DUPLICATE_ITEM_NAME', message: 'Another item is already named "Kabras Sugar 1kg".' }],
      } as never);
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
      expect(res.body.data.warnings[0].code).toBe('DUPLICATE_ITEM_NAME');
    });

    it('PATCH /inventory/items/:id updates an item', async () => {
      vi.spyOn(inventoryService, 'updateItem').mockResolvedValue({
        item: buildItem({ name: 'Kabras Sugar 2kg' }),
        warnings: [],
      } as never);
      const res = await request(app)
        .patch(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Kabras Sugar 2kg' });
      expect(res.status).toBe(200);
      expect(res.body.data.item.name).toBe('Kabras Sugar 2kg');
    });

    it('DELETE /inventory/items/:id retires (soft delete) an item', async () => {
      vi.spyOn(inventoryService, 'retireItem').mockResolvedValue(
        buildItem({ retiredAt: new Date().toISOString() }) as never,
      );
      const res = await request(app)
        .delete(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.retiredAt).not.toBeNull();
    });

    it('DELETE /inventory/items/:id returns 404 for unknown item', async () => {
      vi.spyOn(inventoryService, 'retireItem').mockRejectedValue(new NotFoundError('Inventory item not found'));
      const res = await request(app)
        .delete(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(404);
    });

    it('POST /inventory/items/:id/restore restores a retired item', async () => {
      vi.spyOn(inventoryService, 'restoreItem').mockResolvedValue(buildItem({ retiredAt: null }) as never);
      const res = await request(app)
        .post(`/api/v1/inventory/items/${itemId}/restore`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.retiredAt).toBeNull();
    });

    it('GET /inventory/items supports includeRetired filtering', async () => {
      const listSpy = vi.spyOn(inventoryService, 'listItems').mockResolvedValue({
        data: [buildItem({ retiredAt: new Date().toISOString() })],
        pagination: { total: 1, page: 1, perPage: 20, totalPages: 1 },
        meta: catalogMeta,
      } as never);
      const res = await request(app)
        .get('/api/v1/inventory/items?includeRetired=true')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(listSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ includeRetired: true }));
    });

    it('GET /inventory/items supports pagination params', async () => {
      const listSpy = vi.spyOn(inventoryService, 'listItems').mockResolvedValue({
        data: [],
        pagination: { total: 0, page: 2, perPage: 10, totalPages: 1 },
        meta: catalogMeta,
      } as never);
      const res = await request(app)
        .get('/api/v1/inventory/items?page=2&perPage=10')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(listSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ page: 2, perPage: 10 }),
      );
    });

    it('GET /inventory/categories returns per-category live item counts', async () => {
      vi.spyOn(inventoryService, 'listCategories').mockResolvedValue([buildCategory()] as never);
      const res = await request(app)
        .get('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0].itemCount).toBe(12);
    });

    it('PATCH /inventory/categories/:id renames a category', async () => {
      vi.spyOn(inventoryService, 'renameCategory').mockResolvedValue(buildCategory({ name: 'Fresh produce' }) as never);
      const res = await request(app)
        .patch(`/api/v1/inventory/categories/${categoryId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Fresh produce' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Fresh produce');
    });
  });

  describe('validation failures (400/409)', () => {
    it('POST /inventory/items rejects a RAW_INGREDIENT item with department tags (400)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, departmentTags: ['KITCHEN'] });
      expect(res.status).toBe(400);
      expect(res.body.error.details?.[0]?.path ?? res.body.error.details).toBeDefined();
    });

    it('POST /inventory/items rejects missing name', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, name: '' });
      expect(res.status).toBe(400);
    });

    it('POST /inventory/items rejects invalid type enum', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, type: 'NOT_A_TYPE' });
      expect(res.status).toBe(400);
    });

    it('POST /inventory/items rejects zero conversionFactor', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, conversionFactor: '0' });
      expect(res.status).toBe(400);
    });

    it('POST /inventory/items rejects both categoryId and categoryName', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, categoryId, categoryName: 'Dry items' });
      expect(res.status).toBe(400);
    });

    it('PATCH /inventory/items/:id rejects empty body', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('GET /inventory/items/:id rejects a non-UUID id param', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/items/not-a-uuid')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(400);
    });

    it('service ConflictError (type-change stranding department stock) surfaces as 409', async () => {
      vi.spyOn(inventoryService, 'updateItem').mockRejectedValue(
        new ConflictError('This item holds stock at a department location'),
      );
      const res = await request(app)
        .patch(`/api/v1/inventory/items/${itemId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ type: 'RAW_INGREDIENT' });
      expect(res.status).toBe(409);
    });

    it('POST /inventory/categories rejects a duplicate live name (409)', async () => {
      vi.spyOn(inventoryService, 'createCategory').mockRejectedValue(
        new ConflictError('A category with this name already exists'),
      );
      const res = await request(app)
        .post('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Dry items' });
      expect(res.status).toBe(409);
    });

    it('service ValidationError (unknown preferredSupplierId) surfaces as 400', async () => {
      vi.spyOn(inventoryService, 'createItem').mockRejectedValue(
        new ValidationError('preferredSupplierId does not reference a known supplier'),
      );
      const res = await request(app)
        .post('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, preferredSupplierId: '99999999-9999-4999-8999-999999999999' });
      expect(res.status).toBe(400);
    });
  });
});
