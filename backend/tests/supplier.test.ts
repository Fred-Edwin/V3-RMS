import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { supplierService } from '../src/services/supplier-service';
import { NotFoundError } from '../src/utils/errors';
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

const supplierId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const itemId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const buildSupplier = (overrides: Record<string, unknown> = {}) => ({
  id: supplierId,
  organizationId,
  name: 'Metro Supermarket',
  contactName: 'Jane Doe',
  phone: '0712345678',
  email: 'jane@metro.co.ke',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  _count: { supplierItems: 3 },
  ...overrides,
});

describe('Supplier routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RBAC enforcement', () => {
    it('GET /suppliers allows attendant (read)', async () => {
      vi.spyOn(supplierService, 'list').mockResolvedValue([buildSupplier()] as never);
      const res = await request(app)
        .get('/api/v1/suppliers')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /suppliers blocks attendant (403)', async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ name: 'New Supplier' });
      expect(res.status).toBe(403);
    });

    it('PATCH /suppliers/:id blocks attendant (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ name: 'Updated' });
      expect(res.status).toBe(403);
    });

    it('DELETE /suppliers/:id blocks attendant (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(403);
    });

    it('POST /suppliers/:id/items (assign default supplier) blocks attendant (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/suppliers/${supplierId}/items`)
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ inventoryItemId: itemId, isDefault: true });
      expect(res.status).toBe(403);
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/suppliers');
      expect(res.status).toBe(401);
    });
  });

  describe('happy paths (Manager)', () => {
    it('POST /suppliers creates a supplier', async () => {
      vi.spyOn(supplierService, 'create').mockResolvedValue(buildSupplier() as never);
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Metro Supermarket', contactName: 'Jane Doe', phone: '0712345678' });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Metro Supermarket');
    });

    it('DELETE /suppliers/:id deactivates (soft delete) a supplier', async () => {
      vi.spyOn(supplierService, 'deactivate').mockResolvedValue(
        buildSupplier({ isActive: false }) as never,
      );
      const res = await request(app)
        .delete(`/api/v1/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('DELETE /suppliers/:id returns 404 for unknown supplier', async () => {
      vi.spyOn(supplierService, 'deactivate').mockRejectedValue(new NotFoundError('Supplier not found'));
      const res = await request(app)
        .delete(`/api/v1/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(404);
    });

    it('POST /suppliers/:id/items assigns a default supplier for an item', async () => {
      vi.spyOn(supplierService, 'assignSupplierItem').mockResolvedValue({
        id: 'aaaaaaaa-1111-4111-8111-111111111111',
        organizationId,
        supplierId,
        inventoryItemId: itemId,
        isDefault: true,
        lastPrice: '350.00',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      const res = await request(app)
        .post(`/api/v1/suppliers/${supplierId}/items`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ inventoryItemId: itemId, isDefault: true });
      expect(res.status).toBe(200);
      expect(res.body.data.isDefault).toBe(true);
    });
  });

  describe('validation failures (400)', () => {
    it('POST /suppliers rejects missing name', async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('POST /suppliers rejects invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Metro', email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('PATCH /suppliers/:id rejects empty body', async () => {
      const res = await request(app)
        .patch(`/api/v1/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('POST /suppliers/:id/items rejects non-UUID inventoryItemId', async () => {
      const res = await request(app)
        .post(`/api/v1/suppliers/${supplierId}/items`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ inventoryItemId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });
  });
});
