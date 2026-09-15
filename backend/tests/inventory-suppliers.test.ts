import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { inventoryService } from '../src/modules/inventory/inventory-service';
import { ConflictError, NotFoundError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const hubOrgId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const managerToken = signAccessToken({
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'STORE_MANAGER',
  organizationId: hubOrgId,
});

const accountantToken = signAccessToken({
  userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'ACCOUNTANT',
  organizationId: hubOrgId,
});

const directorToken = signAccessToken({
  userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  role: 'DIRECTOR',
  organizationId: null,
});

const attendantToken = signAccessToken({
  userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  role: 'STORE_ATTENDANT',
  organizationId: hubOrgId,
});

const supplierId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';

const buildSupplier = (overrides: Record<string, unknown> = {}) => ({
  id: supplierId,
  name: 'Samrat Supermarket Ltd',
  contactName: 'Dattu',
  category: { id: categoryId, name: 'Dry items' },
  phone: '+254722160400',
  email: 'samratnyeri@gmail.com',
  location: 'Nyeri town',
  defaultPaymentTerms: 'INVOICE_TO_FOLLOW',
  retiredAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const validCreateBody = {
  name: 'Samrat Supermarket Ltd',
  contactName: 'Dattu',
  phone: '+254722160400',
  email: 'samratnyeri@gmail.com',
  location: 'Nyeri town',
};

describe('Inventory supplier routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RBAC enforcement', () => {
    it('GET /inventory/suppliers returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/inventory/suppliers');
      expect(res.status).toBe(401);
    });

    it('GET /inventory/suppliers blocks the Attendant entirely (403) — AP wall', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /inventory/suppliers allows Accountant (read)', async () => {
      vi.spyOn(inventoryService, 'listSuppliers').mockResolvedValue({
        data: [buildSupplier()],
        pagination: { total: 1, page: 1, perPage: 20, totalPages: 1 },
      } as never);
      const res = await request(app)
        .get('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /inventory/suppliers allows Director (read)', async () => {
      vi.spyOn(inventoryService, 'listSuppliers').mockResolvedValue({
        data: [buildSupplier()],
        pagination: { total: 1, page: 1, perPage: 20, totalPages: 1 },
      } as never);
      const res = await request(app)
        .get('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /inventory/suppliers blocks Accountant (write is Manager-only)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(403);
    });

    it('DELETE /inventory/suppliers/:id blocks the Attendant (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/inventory/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('happy paths (Manager)', () => {
    it('POST /inventory/suppliers creates a supplier', async () => {
      vi.spyOn(inventoryService, 'createSupplier').mockResolvedValue(buildSupplier() as never);
      const res = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Samrat Supermarket Ltd');
      expect(res.body.data.location).toBe('Nyeri town');
    });

    it('PATCH /inventory/suppliers/:id updates a supplier', async () => {
      vi.spyOn(inventoryService, 'updateSupplier').mockResolvedValue(
        buildSupplier({ phone: '+254700000000' }) as never,
      );
      const res = await request(app)
        .patch(`/api/v1/inventory/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ phone: '+254700000000' });
      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe('+254700000000');
    });

    it('DELETE /inventory/suppliers/:id retires a supplier with no live preferring items', async () => {
      vi.spyOn(inventoryService, 'retireSupplier').mockResolvedValue(
        buildSupplier({ retiredAt: new Date().toISOString() }) as never,
      );
      const res = await request(app)
        .delete(`/api/v1/inventory/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.retiredAt).not.toBeNull();
    });

    it('DELETE /inventory/suppliers/:id returns 409 with blocking item names when still preferred', async () => {
      vi.spyOn(inventoryService, 'retireSupplier').mockRejectedValue(
        new ConflictError('This supplier is still the preferred supplier for one or more live items', 'CONFLICT', {
          items: [{ id: 'item-1', name: 'Kabras Sugar 1kg' }],
        }),
      );
      const res = await request(app)
        .delete(`/api/v1/inventory/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(409);
      expect(res.body.error.details.items[0].name).toBe('Kabras Sugar 1kg');
    });

    it('POST /inventory/suppliers/:id/restore restores a retired supplier', async () => {
      vi.spyOn(inventoryService, 'restoreSupplier').mockResolvedValue(buildSupplier({ retiredAt: null }) as never);
      const res = await request(app)
        .post(`/api/v1/inventory/suppliers/${supplierId}/restore`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.retiredAt).toBeNull();
    });

    it('GET /inventory/suppliers/:id returns the profile only (no AP/invoice panel this milestone)', async () => {
      vi.spyOn(inventoryService, 'getSupplierById').mockResolvedValue(buildSupplier() as never);
      const res = await request(app)
        .get(`/api/v1/inventory/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty('invoices');
      expect(res.body.data).not.toHaveProperty('payments');
    });

    it('GET /inventory/suppliers/:id returns 404 for an unknown supplier', async () => {
      vi.spyOn(inventoryService, 'getSupplierById').mockRejectedValue(new NotFoundError('Supplier not found'));
      const res = await request(app)
        .get(`/api/v1/inventory/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(404);
    });

    it('GET /inventory/suppliers supports includeRetired filtering', async () => {
      const listSpy = vi.spyOn(inventoryService, 'listSuppliers').mockResolvedValue({
        data: [buildSupplier({ retiredAt: new Date().toISOString() })],
        pagination: { total: 1, page: 1, perPage: 20, totalPages: 1 },
      } as never);
      const res = await request(app)
        .get('/api/v1/inventory/suppliers?includeRetired=true')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(listSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ includeRetired: true }));
    });
  });

  describe('validation failures (400/409)', () => {
    it('POST /inventory/suppliers rejects missing name', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, name: '' });
      expect(res.status).toBe(400);
    });

    it('POST /inventory/suppliers rejects an invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('PATCH /inventory/suppliers/:id rejects an empty body', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('GET /inventory/suppliers/:id rejects a non-UUID id param', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/suppliers/not-a-uuid')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(400);
    });

    it('POST /inventory/suppliers rejects a duplicate live name (409)', async () => {
      vi.spyOn(inventoryService, 'createSupplier').mockRejectedValue(
        new ConflictError('A supplier with this name already exists'),
      );
      const res = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(409);
    });
  });
});
