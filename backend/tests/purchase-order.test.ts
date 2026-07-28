import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { purchaseOrderService } from '../src/services/purchase-order-service';
import { ConflictError, NotFoundError, ValidationError } from '../src/utils/errors';
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

const poId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const lineId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const itemId = '11111111-1111-4111-8111-111111111111';
const supplierId = '22222222-2222-4222-8222-222222222222';
const locationId = '33333333-3333-4333-8333-333333333333';

const buildPo = (overrides: Record<string, unknown> = {}) => ({
  id: poId,
  organizationId,
  supplierId,
  locationId,
  poNumber: 'PO-260728-AB12',
  status: 'DRAFT',
  createdById: managerToken,
  sentAt: null,
  cancelledAt: null,
  closedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  supplier: { id: supplierId, name: 'Metro Supermarket' },
  lines: [
    {
      id: lineId,
      organizationId,
      purchaseOrderId: poId,
      inventoryItemId: itemId,
      orderedQty: '10',
      receivedQty: '0',
      unitPrice: '300',
      invoicePrice: null,
      receivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inventoryItem: { id: itemId, name: 'Chicken Breast', buyUnit: 'kg' },
    },
  ],
  ...overrides,
});

const validCreateBody = {
  supplierId,
  locationId,
  lines: [{ inventoryItemId: itemId, orderedQty: '10', unitPrice: '300' }],
};

describe('Purchase Order routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RBAC enforcement', () => {
    it('GET /purchase-orders allows attendant (read)', async () => {
      vi.spyOn(purchaseOrderService, 'list').mockResolvedValue([buildPo()] as never);
      const res = await request(app)
        .get('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /purchase-orders allows attendant to create a draft', async () => {
      vi.spyOn(purchaseOrderService, 'create').mockResolvedValue(buildPo() as never);
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${attendantToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
    });

    it('POST /purchase-orders blocks waiter (403)', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(403);
    });

    it('POST /purchase-orders/:id/send blocks attendant (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/purchase-orders/${poId}/send`)
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(403);
    });

    it('POST /purchase-orders/:id/cancel blocks attendant (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/purchase-orders/${poId}/cancel`)
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(403);
    });

    it('POST /purchase-orders/:id/lines/:lineId/receive allows attendant', async () => {
      vi.spyOn(purchaseOrderService, 'receiveLine').mockResolvedValue(
        buildPo({ status: 'PARTIALLY_RECEIVED' }) as never,
      );
      const res = await request(app)
        .post(`/api/v1/purchase-orders/${poId}/lines/${lineId}/receive`)
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ receivedQty: '5', invoicePrice: '310' });
      expect(res.status).toBe(200);
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/purchase-orders');
      expect(res.status).toBe(401);
    });
  });

  describe('create (happy path + validation)', () => {
    it('creates a draft PO with nested lines', async () => {
      vi.spyOn(purchaseOrderService, 'create').mockResolvedValue(buildPo() as never);
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.lines).toHaveLength(1);
    });

    it('rejects an empty lines array (400)', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, lines: [] });
      expect(res.status).toBe(400);
    });

    it('rejects a non-UUID supplierId (400)', async () => {
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, supplierId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });

    it('surfaces a service ValidationError (unknown item) as 400', async () => {
      vi.spyOn(purchaseOrderService, 'create').mockRejectedValue(
        new ValidationError('Line references unknown inventory item: xyz'),
      );
      const res = await request(app)
        .post('/api/v1/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(400);
    });
  });

  describe('status transitions', () => {
    it('DRAFT -> SENT succeeds', async () => {
      vi.spyOn(purchaseOrderService, 'send').mockResolvedValue(
        buildPo({ status: 'SENT', sentAt: new Date().toISOString() }) as never,
      );
      const res = await request(app)
        .post(`/api/v1/purchase-orders/${poId}/send`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SENT');
    });

    it('sending a non-DRAFT PO returns 409', async () => {
      vi.spyOn(purchaseOrderService, 'send').mockRejectedValue(
        new ConflictError('Purchase order must be in DRAFT status to send'),
      );
      const res = await request(app)
        .post(`/api/v1/purchase-orders/${poId}/send`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(409);
    });

    it('sending an unknown PO returns 404', async () => {
      vi.spyOn(purchaseOrderService, 'send').mockRejectedValue(
        new NotFoundError('Purchase order not found'),
      );
      const res = await request(app)
        .post(`/api/v1/purchase-orders/${poId}/send`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(404);
    });

    it('DRAFT -> CANCELLED succeeds', async () => {
      vi.spyOn(purchaseOrderService, 'cancel').mockResolvedValue(
        buildPo({ status: 'CANCELLED', cancelledAt: new Date().toISOString() }) as never,
      );
      const res = await request(app)
        .post(`/api/v1/purchase-orders/${poId}/cancel`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('cancelling a CLOSED PO returns 409', async () => {
      vi.spyOn(purchaseOrderService, 'cancel').mockRejectedValue(
        new ConflictError('Only a DRAFT or SENT purchase order can be cancelled'),
      );
      const res = await request(app)
        .post(`/api/v1/purchase-orders/${poId}/cancel`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(409);
    });

    it('partial receipt keeps the PO PARTIALLY_RECEIVED', async () => {
      vi.spyOn(purchaseOrderService, 'receiveLine').mockResolvedValue(
        buildPo({
          status: 'PARTIALLY_RECEIVED',
          lines: [{ ...buildPo().lines[0], receivedQty: '5', invoicePrice: '310' }],
        }) as never,
      );
      const res = await request(app)
        .post(`/api/v1/purchase-orders/${poId}/lines/${lineId}/receive`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ receivedQty: '5', invoicePrice: '310' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PARTIALLY_RECEIVED');
    });

    it('full receipt closes the PO to CLOSED', async () => {
      vi.spyOn(purchaseOrderService, 'receiveLine').mockResolvedValue(
        buildPo({
          status: 'CLOSED',
          closedAt: new Date().toISOString(),
          lines: [{ ...buildPo().lines[0], receivedQty: '10', invoicePrice: '310' }],
        }) as never,
      );
      const res = await request(app)
        .post(`/api/v1/purchase-orders/${poId}/lines/${lineId}/receive`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ receivedQty: '10', invoicePrice: '310' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CLOSED');
    });

    it('receiving against a DRAFT PO returns 409', async () => {
      vi.spyOn(purchaseOrderService, 'receiveLine').mockRejectedValue(
        new ConflictError('Purchase order must be SENT or PARTIALLY_RECEIVED to record a receipt'),
      );
      const res = await request(app)
        .post(`/api/v1/purchase-orders/${poId}/lines/${lineId}/receive`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ receivedQty: '5', invoicePrice: '310' });
      expect(res.status).toBe(409);
    });
  });

});
