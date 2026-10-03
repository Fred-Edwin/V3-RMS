import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { supplierService } from '../src/modules/inventory/suppliers/supplier-service';
import { ConflictError, NotFoundError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const hubOrgId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const managerToken = signAccessToken({
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'STORE_MANAGER',
  siteId: hubOrgId,
});

const accountantToken = signAccessToken({
  userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'ACCOUNTANT',
  siteId: hubOrgId,
});

const directorToken = signAccessToken({
  userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  role: 'DIRECTOR',
  siteId: null,
});

const attendantToken = signAccessToken({
  userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  role: 'STORE_ATTENDANT',
  siteId: hubOrgId,
});

const supplierId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';

const buildSupplier = (overrides: Record<string, unknown> = {}) => ({
  id: supplierId,
  name: 'Samrat Supermarket Ltd',
  code: 'SUPPLIER-0001',
  status: 'ACTIVE',
  category: { id: categoryId, name: 'Dry items' },
  address: 'Nyeri town',
  primaryContact: { id: '33333333-3333-4333-8333-333333333333', name: 'Dattu', role: 'OTHER', phone: '+254722160400', whatsapp: null, email: 'samratnyeri@gmail.com' },
  defaultPaymentTerms: 'INVOICE_TO_FOLLOW',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const validCreateBody = {
  name: 'Samrat Supermarket Ltd',
  address: 'Nyeri town',
  contacts: [{ name: 'Dattu', role: 'OTHER', phone: '+254722160400', email: 'samratnyeri@gmail.com', isPrimary: true }],
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

    it('GET /inventory/suppliers gives the Attendant the stripped list (suppliers expansion)', async () => {
      const stripped = { id: supplierId, code: 'SUPPLIER-0001', name: 'Samrat', type: 'REGULAR', primaryPhone: '0722' };
      vi.spyOn(supplierService, 'listSuppliers').mockResolvedValue({
        data: [stripped],
        pagination: { total: 1, page: 1, perPage: 20, totalPages: 1 },
      } as never);
      const res = await request(app)
        .get('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0]).toEqual(stripped);
    });

    it.each([
      ['get', (id: string) => `/api/v1/inventory/suppliers/${id}`],
      ['get', (id: string) => `/api/v1/inventory/suppliers/${id}/payment-methods`],
      ['get', (id: string) => `/api/v1/inventory/suppliers/${id}/documents`],
      ['get', (id: string) => `/api/v1/inventory/suppliers/${id}/summary`],
      ['patch', (id: string) => `/api/v1/inventory/suppliers/${id}/status`],
    ] as const)('the Attendant is blocked on %s %#', async (method, path) => {
      const res = await request(app)[method](path(supplierId)).set('Authorization', `Bearer ${attendantToken}`).send({});
      expect(res.status).toBe(403);
    });

    it('POST /inventory/suppliers/quick allows the Attendant and blocks the Accountant', async () => {
      vi.spyOn(supplierService, 'quickAddSupplier').mockResolvedValue({ id: supplierId } as never);
      const ok = await request(app)
        .post('/api/v1/inventory/suppliers/quick')
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ name: 'Roadside', phone: '0700000000' });
      expect(ok.status).toBe(201);
      const no = await request(app)
        .post('/api/v1/inventory/suppliers/quick')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({ name: 'Roadside', phone: '0700000000' });
      expect(no.status).toBe(403);
    });

    it('payment methods: the Director may read but not write; the Accountant may write', async () => {
      const body = { type: 'CASH', reason: 'Supplier asked for it' };
      const denied = await request(app)
        .post(`/api/v1/inventory/suppliers/${supplierId}/payment-methods`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(body);
      expect(denied.status).toBe(403);
      vi.spyOn(supplierService, 'createPayMethod').mockResolvedValue({ id: 'm' } as never);
      const ok = await request(app)
        .post(`/api/v1/inventory/suppliers/${supplierId}/payment-methods`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send(body);
      expect(ok.status).toBe(201);
    });

    it('GET /inventory/suppliers allows Accountant (read)', async () => {
      vi.spyOn(supplierService, 'listSuppliers').mockResolvedValue({
        data: [buildSupplier()],
        pagination: { total: 1, page: 1, perPage: 20, totalPages: 1 },
      } as never);
      const res = await request(app)
        .get('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /inventory/suppliers allows Director (read)', async () => {
      vi.spyOn(supplierService, 'listSuppliers').mockResolvedValue({
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

    it('PATCH /inventory/suppliers/:id/status blocks the Attendant (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/suppliers/${supplierId}/status`)
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ status: 'ON_HOLD' });
      expect(res.status).toBe(403);
    });

    it('the old archive and restore aliases are gone (404)', async () => {
      const del = await request(app).delete(`/api/v1/inventory/suppliers/${supplierId}`).set('Authorization', `Bearer ${managerToken}`);
      const restore = await request(app).post(`/api/v1/inventory/suppliers/${supplierId}/restore`).set('Authorization', `Bearer ${managerToken}`);
      expect(del.status).toBe(404);
      expect(restore.status).toBe(404);
    });
  });

  describe('happy paths (Manager)', () => {
    it('POST /inventory/suppliers creates a supplier', async () => {
      vi.spyOn(supplierService, 'createSupplier').mockResolvedValue(buildSupplier() as never);
      const res = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Samrat Supermarket Ltd');
      expect(res.body.data.address).toBe('Nyeri town');
    });

    it('PATCH /inventory/suppliers/:id updates a supplier', async () => {
      vi.spyOn(supplierService, 'updateSupplier').mockResolvedValue(
        buildSupplier({ address: 'Karatina' }) as never,
      );
      const res = await request(app)
        .patch(`/api/v1/inventory/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ address: 'Karatina' });
      expect(res.status).toBe(200);
      expect(res.body.data.address).toBe('Karatina');
    });

    it('PATCH /inventory/suppliers/:id/status returns 409 with the open-invoice count when archiving is blocked', async () => {
      vi.spyOn(supplierService, 'updateStatus').mockRejectedValue(
        new ConflictError('This supplier still has unpaid invoices and cannot be archived', 'SUPPLIER_HAS_OPEN_INVOICES', {
          openInvoices: 2,
        }),
      );
      const res = await request(app)
        .patch(`/api/v1/inventory/suppliers/${supplierId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'ARCHIVED' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SUPPLIER_HAS_OPEN_INVOICES');
      expect(res.body.error.details.openInvoices).toBe(2);
    });

    it('PATCH /inventory/suppliers/:id/status rejects an unknown status', async () => {
      const res = await request(app)
        .patch(`/api/v1/inventory/suppliers/${supplierId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'DELETED' });
      expect(res.status).toBe(400);
    });

    it('PATCH /inventory/suppliers/:id/status archives and restores', async () => {
      const spy = vi.spyOn(supplierService, 'updateStatus').mockResolvedValue(buildSupplier({ status: 'ARCHIVED' }) as never);
      const archived = await request(app)
        .patch(`/api/v1/inventory/suppliers/${supplierId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'ARCHIVED', reason: 'Closed down.' });
      expect(archived.status).toBe(200);
      expect(archived.body.data.status).toBe('ARCHIVED');
      expect(spy).toHaveBeenCalledWith(expect.anything(), supplierId, { status: 'ARCHIVED', reason: 'Closed down.' });
    });

    it('GET /inventory/suppliers/:id returns the profile only (no AP/invoice panel this milestone)', async () => {
      vi.spyOn(supplierService, 'getSupplierById').mockResolvedValue(buildSupplier() as never);
      const res = await request(app)
        .get(`/api/v1/inventory/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty('invoices');
      expect(res.body.data).not.toHaveProperty('payments');
    });

    it('GET /inventory/suppliers/:id returns 404 for an unknown supplier', async () => {
      vi.spyOn(supplierService, 'getSupplierById').mockRejectedValue(new NotFoundError('Supplier not found'));
      const res = await request(app)
        .get(`/api/v1/inventory/suppliers/${supplierId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(404);
    });

    it('GET /inventory/suppliers supports includeRetired filtering', async () => {
      const listSpy = vi.spyOn(supplierService, 'listSuppliers').mockResolvedValue({
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

    it('POST /inventory/suppliers rejects an invalid contact email', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, contacts: [{ name: 'Dattu', role: 'OTHER', email: 'not-an-email', isPrimary: true }] });
      expect(res.status).toBe(400);
    });

    it('POST /inventory/suppliers needs an address', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Roadside', phone: '0700000000' });
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

    it('POST /inventory/suppliers rejects a duplicate name + phone (409) unless confirmed', async () => {
      const spy = vi.spyOn(supplierService, 'createSupplier').mockRejectedValue(
        new ConflictError('A supplier with this name and phone already exists', 'DUPLICATE_SUPPLIER', { matches: [] }),
      );
      const res = await request(app)
        .post('/api/v1/inventory/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(409);
    });
  });

  describe('documents (multipart)', () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const url = `/api/v1/inventory/suppliers/${supplierId}/documents`;

    it('POST uploads a file with its fields', async () => {
      const spy = vi.spyOn(supplierService, 'uploadDocument').mockResolvedValue({ id: 'd1' } as never);
      const res = await request(app)
        .post(url)
        .set('Authorization', `Bearer ${managerToken}`)
        .field('docType', 'INVOICE')
        .attach('file', png, 'scan.png');
      expect(res.status).toBe(201);
      expect(spy).toHaveBeenCalledWith(
        expect.anything(),
        supplierId,
        expect.objectContaining({ originalname: 'scan.png' }),
        expect.objectContaining({ docType: 'INVOICE' }),
      );
    });

    it('POST rejects an unknown docType (400)', async () => {
      const res = await request(app)
        .post(url)
        .set('Authorization', `Bearer ${managerToken}`)
        .field('docType', 'SELFIE')
        .attach('file', png, 'scan.png');
      expect(res.status).toBe(400);
    });

    it('POST answers 422 for a file over 10 MB', async () => {
      const spy = vi.spyOn(supplierService, 'uploadDocument');
      const res = await request(app)
        .post(url)
        .set('Authorization', `Bearer ${managerToken}`)
        .field('docType', 'INVOICE')
        .attach('file', Buffer.alloc(10 * 1024 * 1024 + 10), 'huge.pdf');
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
      expect(spy).not.toHaveBeenCalled();
    });

    it('POST is closed to the Director and the Attendant; GET download is closed to the Attendant', async () => {
      for (const token of [directorToken, attendantToken]) {
        const res = await request(app).post(url).set('Authorization', `Bearer ${token}`).field('docType', 'INVOICE');
        expect(res.status).toBe(403);
      }
      const dl = await request(app)
        .get(`${url}/33333333-3333-4333-8333-333333333333/download`)
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(dl.status).toBe(403);
    });

    it('GET download returns the signed-URL envelope for the Director', async () => {
      vi.spyOn(supplierService, 'getDocumentDownload').mockResolvedValue({
        url: 'https://signed.example/x', expiresAt: new Date().toISOString(), fileName: 'scan.png',
      } as never);
      const res = await request(app)
        .get(`${url}/33333333-3333-4333-8333-333333333333/download`)
        .set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.url).toBe('https://signed.example/x');
    });
  });
});
