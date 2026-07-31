import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { supplierInvoiceService } from '../src/services/supplier-invoice-service';
import { ValidationError } from '../src/utils/errors';
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

const invoiceId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const supplierId = '11111111-1111-4111-8111-111111111111';

const buildInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: invoiceId,
  organizationId,
  supplierId,
  purchaseOrderId: null,
  referenceNumber: 'INV-001',
  amount: '5000',
  amountPaid: '0',
  status: 'UNPAID',
  invoiceDate: new Date().toISOString(),
  createdById: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  supplier: { id: supplierId, name: 'Metro Supermarket' },
  payments: [],
  ...overrides,
});

const validCreateBody = {
  supplierId,
  referenceNumber: 'INV-001',
  amount: '5000',
  invoiceDate: new Date().toISOString(),
};

describe('Supplier Invoice / AP routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Attendant has zero access — every route, not just writes (D-2, D-13, §8.3)', () => {
    it('GET /supplier-invoices blocks attendant (403)', async () => {
      const res = await request(app)
        .get('/api/v1/supplier-invoices')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /supplier-invoices/:id blocks attendant (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/supplier-invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(403);
    });

    it('POST /supplier-invoices blocks attendant (403)', async () => {
      const res = await request(app)
        .post('/api/v1/supplier-invoices')
        .set('Authorization', `Bearer ${attendantToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(403);
    });

    it('POST /supplier-invoices/:id/payments blocks attendant (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/supplier-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ amount: '1000', method: 'MPESA', paidAt: new Date().toISOString() });
      expect(res.status).toBe(403);
    });
  });

  describe('Manager access + happy path', () => {
    it('GET /supplier-invoices allows manager', async () => {
      vi.spyOn(supplierInvoiceService, 'list').mockResolvedValue([buildInvoice()] as never);
      const res = await request(app)
        .get('/api/v1/supplier-invoices')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /supplier-invoices creates an invoice (status UNPAID)', async () => {
      vi.spyOn(supplierInvoiceService, 'create').mockResolvedValue(buildInvoice() as never);
      const res = await request(app)
        .post('/api/v1/supplier-invoices')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('UNPAID');
    });

    it('rejects a non-UUID supplierId (400)', async () => {
      const res = await request(app)
        .post('/api/v1/supplier-invoices')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, supplierId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });

    it('records a partial payment -> PARTIALLY_PAID', async () => {
      vi.spyOn(supplierInvoiceService, 'recordPayment').mockResolvedValue(
        buildInvoice({ status: 'PARTIALLY_PAID', amountPaid: '2000' }) as never,
      );
      const res = await request(app)
        .post(`/api/v1/supplier-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ amount: '2000', method: 'MPESA', paidAt: new Date().toISOString() });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PARTIALLY_PAID');
    });

    it('records a full payment -> PAID', async () => {
      vi.spyOn(supplierInvoiceService, 'recordPayment').mockResolvedValue(
        buildInvoice({ status: 'PAID', amountPaid: '5000' }) as never,
      );
      const res = await request(app)
        .post(`/api/v1/supplier-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ amount: '5000', method: 'MPESA', paidAt: new Date().toISOString() });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PAID');
    });

    it('surfaces a service ValidationError (already paid) as 400', async () => {
      vi.spyOn(supplierInvoiceService, 'recordPayment').mockRejectedValue(
        new ValidationError('Invoice is already fully paid'),
      );
      const res = await request(app)
        .post(`/api/v1/supplier-invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ amount: '1000', method: 'MPESA', paidAt: new Date().toISOString() });
      expect(res.status).toBe(400);
    });
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/v1/supplier-invoices');
    expect(res.status).toBe(401);
  });
});
