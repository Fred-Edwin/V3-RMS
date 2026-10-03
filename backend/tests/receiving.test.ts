import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { receivingService } from '../src/modules/inventory/purchasing/receiving-service';
import { ConflictError, ForbiddenError, NotFoundError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const hubOrgId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const branchOrgId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const managerToken = signAccessToken({
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'STORE_MANAGER',
  siteId: hubOrgId,
});

const branchManagerToken = signAccessToken({
  userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  role: 'STORE_MANAGER',
  siteId: branchOrgId,
});

const attendantToken = signAccessToken({
  userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  role: 'STORE_ATTENDANT',
  siteId: hubOrgId,
});

const accountantToken = signAccessToken({
  userId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  role: 'ACCOUNTANT',
  siteId: hubOrgId,
});

const waiterToken = signAccessToken({
  userId: '99999999-9999-4999-8999-999999999999',
  role: 'WAITER',
  siteId: hubOrgId,
});

const deliveryId = '11111111-1111-4111-8111-111111111111';
const supplierId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';

const buildDeliverySummary = (overrides: Record<string, unknown> = {}) => ({
  id: deliveryId,
  reference: 'EXP-0001',
  supplierId,
  supplierName: 'Samrat Supermarket Ltd',
  paymentTerms: 'INVOICE_TO_FOLLOW',
  status: 'AWAITING',
  itemSummary: 'Milk, cream, yoghurt · 6 lines',
  lineCount: 6,
  expectedDate: null,
  estimatedTotal: '8100.00',
  isOverdue: false,
  ageLabel: 'Today',
  createdAt: new Date().toISOString(),
  ...overrides,
});

const validCreateBody = {
  supplierId,
  paymentTerms: 'INVOICE_TO_FOLLOW',
  lines: [{ inventoryItemId: itemId, quantity: '4', estimatedUnitPrice: '2025' }],
};

describe('Receiving — expected deliveries + purchasing hub routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RBAC enforcement', () => {
    it('GET /inventory/expected-deliveries returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/inventory/expected-deliveries');
      expect(res.status).toBe(401);
    });

    it('GET /inventory/expected-deliveries blocks waiter (403)', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/expected-deliveries')
        .set('Authorization', `Bearer ${waiterToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /inventory/expected-deliveries allows attendant (read-only)', async () => {
      vi.spyOn(receivingService, 'listExpectedDeliveries').mockResolvedValue([
        buildDeliverySummary({ estimatedTotal: null }),
      ] as never);
      const res = await request(app)
        .get('/api/v1/inventory/expected-deliveries')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /inventory/expected-deliveries blocks attendant (403) — read-only per plan §3.1', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/expected-deliveries')
        .set('Authorization', `Bearer ${attendantToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(403);
    });

    it('POST /inventory/expected-deliveries/:id/cancel blocks attendant (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/inventory/expected-deliveries/${deliveryId}/cancel`)
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /inventory/purchasing/summary blocks attendant entirely (403) — zero AP access, not even read', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/purchasing/summary')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /inventory/purchasing/history blocks attendant entirely (403)', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/purchasing/history')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /inventory/purchasing/summary allows Accountant (read)', async () => {
      vi.spyOn(receivingService, 'getPurchasingSummary').mockResolvedValue({
        expected: { count: 0, overdue: 0 },
        awaitingInvoice: { count: 0, oldestDays: null },
        owed: { amount: '0.00', over30Count: 0 },
      });
      const res = await request(app)
        .get('/api/v1/inventory/purchasing/summary')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('D-15 tenant isolation', () => {
    it('a non-hub Store Manager is rejected with 403, not an empty list', async () => {
      vi.spyOn(receivingService, 'listExpectedDeliveries').mockRejectedValue(
        new ForbiddenError('Only the hub organization may access Central Store inventory data'),
      );
      const res = await request(app)
        .get('/api/v1/inventory/expected-deliveries')
        .set('Authorization', `Bearer ${branchManagerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('STORE_ATTENDANT response shape', () => {
    it('omits estimatedTotal (null), not merely hides it client-side', async () => {
      vi.spyOn(receivingService, 'listExpectedDeliveries').mockResolvedValue([
        buildDeliverySummary({ estimatedTotal: null }),
      ] as never);
      const res = await request(app)
        .get('/api/v1/inventory/expected-deliveries')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0].estimatedTotal).toBeNull();
    });

    it("STORE_MANAGER's response includes estimatedTotal", async () => {
      vi.spyOn(receivingService, 'listExpectedDeliveries').mockResolvedValue([
        buildDeliverySummary(),
      ] as never);
      const res = await request(app)
        .get('/api/v1/inventory/expected-deliveries')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0].estimatedTotal).toBe('8100.00');
    });
  });

  describe('happy paths (Manager)', () => {
    it('POST /inventory/expected-deliveries creates an AWAITING record (201)', async () => {
      vi.spyOn(receivingService, 'createExpectedDelivery').mockResolvedValue(buildDeliverySummary() as never);
      const res = await request(app)
        .post('/api/v1/inventory/expected-deliveries')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
      expect(res.body.data.reference).toBe('EXP-0001');
    });

    it('POST /inventory/expected-deliveries succeeds with no supplierId — a pure shopping list (AMENDMENT 2026-09-17)', async () => {
      vi.spyOn(receivingService, 'createExpectedDelivery').mockResolvedValue(
        buildDeliverySummary({ supplierId: null, supplierName: null, paymentTerms: null }) as never,
      );
      const res = await request(app)
        .post('/api/v1/inventory/expected-deliveries')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ lines: validCreateBody.lines });
      expect(res.status).toBe(201);
      expect(res.body.data.supplierId).toBeNull();
      expect(res.body.data.paymentTerms).toBeNull();
    });

    it('POST /inventory/expected-deliveries rejects an empty lines array (400)', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/expected-deliveries')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, lines: [] });
      expect(res.status).toBe(400);
    });

    it('POST /inventory/expected-deliveries/:id/cancel returns 409 when not AWAITING', async () => {
      vi.spyOn(receivingService, 'cancelExpectedDelivery').mockRejectedValue(
        new ConflictError('Only an awaiting delivery can be cancelled'),
      );
      const res = await request(app)
        .post(`/api/v1/inventory/expected-deliveries/${deliveryId}/cancel`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(409);
    });

    it('GET /inventory/items/:id/last-price returns null when no signed receipt exists yet', async () => {
      vi.spyOn(receivingService, 'getLastPrice').mockResolvedValue(null);
      const res = await request(app)
        .get(`/api/v1/inventory/items/${itemId}/last-price`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    it('GET /inventory/items/:id/last-price 404s on an unknown item', async () => {
      vi.spyOn(receivingService, 'getLastPrice').mockRejectedValue(new NotFoundError('Inventory item not found'));
      const res = await request(app)
        .get(`/api/v1/inventory/items/${itemId}/last-price`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(404);
    });
  });
});
