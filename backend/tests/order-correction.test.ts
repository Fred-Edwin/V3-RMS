import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { orderCorrectionService } from '../src/services/order-correction-service';
import { ConflictError, NotFoundError, ValidationError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const systemAdminToken = signAccessToken({
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'SYSTEM_ADMIN',
  organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
});

const waiterToken = signAccessToken({
  userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'WAITER',
  organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
});

const chefToken = signAccessToken({
  userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  role: 'CHEF',
  organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
});

const managerToken = signAccessToken({
  userId: '55555555-5555-4555-8555-555555555555',
  role: 'MANAGER',
  organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
});

const orderId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const itemId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const ticketId = '44444444-4444-4444-8444-444444444444';
const splitLineId = '66666666-6666-4666-8666-666666666666';

const sampleListResult = {
  orders: [
    {
      id: orderId,
      dailyNumber: 42,
      orderDate: '2026-05-14',
      type: 'DINE_IN',
      status: 'CLOSED',
      tableNumber: '5',
      paymentMethod: 'MPESA',
      mpesaCode: 'QKA123XY',
      total: '700.00',
      createdAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      organizationName: 'Wendo Coffee Bistro',
      createdByName: 'Waiter One',
    },
  ],
  pagination: { total: 1, page: 1, perPage: 20, totalPages: 1 },
};

const sampleDetail = {
  id: orderId,
  dailyNumber: 42,
  orderDate: '2026-05-14',
  type: 'DINE_IN',
  status: 'CLOSED',
  tableNumber: '5',
  notes: null,
  paymentMethod: 'MPESA',
  mpesaCode: 'QKA123XY',
  subtotal: '700.00',
  deliveryFee: '0.00',
  total: '700.00',
  createdAt: new Date().toISOString(),
  closedAt: new Date().toISOString(),
  organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  organizationName: 'Wendo Coffee Bistro',
  createdByName: 'Waiter One',
  items: [
    {
      id: itemId,
      menuItemId: '11111111-1111-4111-8111-111111111111',
      name: 'Latte',
      quantity: 2,
      unitPrice: '350.00',
      subtotal: '700.00',
      notes: null,
    },
  ],
  prepTickets: [{ id: '22222222-2222-4222-8222-222222222222', station: 'BARISTA', status: 'READY', sequence: 1 }],
  pendingAuthRequestId: null,
};

const sampleAuditLog = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    type: 'ORDER_CORRECTION',
    actor: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'System Admin' },
    details: { action: 'CORRECT_MPESA_CODE', field: 'mpesaCode', before: 'QKA000YY', after: 'QKA123XY', reason: 'Customer provided correct code' },
    createdAt: new Date().toISOString(),
  },
];

describe('Order Correction routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── RBAC: every endpoint must block non-SYSTEM_ADMIN ────────────────────

  describe('RBAC enforcement', () => {
    it('GET /admin/order-corrections blocks waiter (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/order-corrections')
        .set('Authorization', `Bearer ${waiterToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /admin/order-corrections blocks chef (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/order-corrections')
        .set('Authorization', `Bearer ${chefToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /admin/order-corrections/:id blocks non-admin (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/order-corrections/${orderId}`)
        .set('Authorization', `Bearer ${waiterToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /admin/order-corrections/:id/audit-log blocks non-admin (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/order-corrections/${orderId}/audit-log`)
        .set('Authorization', `Bearer ${waiterToken}`);
      expect(res.status).toBe(403);
    });

    it('PATCH /admin/order-corrections/:id/mpesa-code blocks non-admin (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/mpesa-code`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ mpesaCode: 'QKA123XY', reason: 'Customer provided correct code for the wrong entry' });
      expect(res.status).toBe(403);
    });

    it('PATCH /admin/order-corrections/:id/payment-method blocks non-admin (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/payment-method`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ paymentMethod: 'CASH', reason: 'Payment method was entered incorrectly at close' });
      expect(res.status).toBe(403);
    });

    it('POST /admin/order-corrections/:id/force-ready blocks non-admin (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/force-ready`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ reason: 'Ghost rejected ticket is blocking; kitchen confirmed all items done' });
      expect(res.status).toBe(403);
    });

    it('POST /admin/order-corrections/:id/revert-auth blocks non-admin (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/revert-auth`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ reason: 'House account auth will not be used; customer paid cash instead' });
      expect(res.status).toBe(403);
    });

    it('PATCH /admin/order-corrections/:id/items/:itemId/remove blocks non-admin (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/items/${itemId}/remove`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ reason: 'Item was added by mistake and customer refused to pay for it' });
      expect(res.status).toBe(403);
    });

    it('POST /admin/order-corrections/:id/tickets/:ticketId/revert-rejected blocks non-admin (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/tickets/${ticketId}/revert-rejected`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ reason: 'Barista accidentally rejected the ticket; please re-attempt the item' });
      expect(res.status).toBe(403);
    });

    it('PATCH /admin/order-corrections/:id/total blocks non-admin (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/total`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ newTotal: 500, reason: 'Manager approved discount after order was closed already' });
      expect(res.status).toBe(403);
    });

    it('POST /admin/order-corrections/:id/split-lines blocks non-admin (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/split-lines`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ label: 'Guest 1', amount: 500, method: 'CASH', reason: 'Split line was recorded with the wrong method at close' });
      expect(res.status).toBe(403);
    });

    it('DELETE /admin/order-corrections/:id/split-lines/:lineId blocks non-admin (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/order-corrections/${orderId}/split-lines/${splitLineId}`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({ reason: 'Split line was recorded with the wrong method at close' });
      expect(res.status).toBe(403);
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/v1/admin/order-corrections');
      expect(res.status).toBe(401);
    });

    it('allows MANAGER through the route layer (service still enforces branch scope)', async () => {
      vi.spyOn(orderCorrectionService, 'listOrders').mockResolvedValue(sampleListResult);

      const res = await request(app)
        .get('/api/v1/admin/order-corrections')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ── List orders ──────────────────────────────────────────────────────────

  describe('GET /admin/order-corrections', () => {
    it('returns paginated order list for SYSTEM_ADMIN', async () => {
      vi.spyOn(orderCorrectionService, 'listOrders').mockResolvedValue(sampleListResult);

      const res = await request(app)
        .get('/api/v1/admin/order-corrections')
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toHaveLength(1);
      expect(res.body.data.pagination.total).toBe(1);
    });

    it('forwards query filters to service', async () => {
      const spy = vi.spyOn(orderCorrectionService, 'listOrders').mockResolvedValue(sampleListResult);

      await request(app)
        .get('/api/v1/admin/order-corrections?status=CLOSED&page=2&perPage=10')
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CLOSED', page: 2, perPage: 10 }),
        expect.objectContaining({ role: 'SYSTEM_ADMIN' }),
      );
    });
  });

  // ── Get order detail ─────────────────────────────────────────────────────

  describe('GET /admin/order-corrections/:id', () => {
    it('returns order detail including items and prep tickets', async () => {
      vi.spyOn(orderCorrectionService, 'getOrderDetail').mockResolvedValue(sampleDetail);

      const res = await request(app)
        .get(`/api/v1/admin/order-corrections/${orderId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(orderId);
      expect(res.body.data.items).toHaveLength(1);
    });

    it('returns 404 when order is not found', async () => {
      vi.spyOn(orderCorrectionService, 'getOrderDetail').mockRejectedValue(new NotFoundError('Order not found'));

      const res = await request(app)
        .get(`/api/v1/admin/order-corrections/${orderId}`)
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── Audit log ────────────────────────────────────────────────────────────

  describe('GET /admin/order-corrections/:id/audit-log', () => {
    it('returns audit entries for the order', async () => {
      vi.spyOn(orderCorrectionService, 'getAuditLog').mockResolvedValue(sampleAuditLog);

      const res = await request(app)
        .get(`/api/v1/admin/order-corrections/${orderId}/audit-log`)
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe('ORDER_CORRECTION');
    });
  });

  // ── Correct M-Pesa code ──────────────────────────────────────────────────

  describe('PATCH /admin/order-corrections/:id/mpesa-code', () => {
    const validBody = { mpesaCode: 'QKA123XY', reason: 'Customer provided the correct M-Pesa code after entry error' };

    it('corrects the M-Pesa code successfully', async () => {
      vi.spyOn(orderCorrectionService, 'correctMpesaCode').mockResolvedValue(undefined);

      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/mpesa-code`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 409 when order is outside the 7-day correction window', async () => {
      vi.spyOn(orderCorrectionService, 'correctMpesaCode').mockRejectedValue(
        new ConflictError('Corrections are only allowed on orders created within the last 7 days'),
      );

      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/mpesa-code`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 409 when order is not CLOSED', async () => {
      vi.spyOn(orderCorrectionService, 'correctMpesaCode').mockRejectedValue(
        new ConflictError('M-Pesa code correction is only allowed on CLOSED orders'),
      );

      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/mpesa-code`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 400 for non-alphanumeric M-Pesa code', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/mpesa-code`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({ mpesaCode: 'invalid code!', reason: 'Some reason that is long enough to pass validation here' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when reason is too short', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/mpesa-code`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({ mpesaCode: 'QKA123XY', reason: 'short' });

      expect(res.status).toBe(400);
    });
  });

  // ── Correct payment method ───────────────────────────────────────────────

  describe('PATCH /admin/order-corrections/:id/payment-method', () => {
    const validBody = { paymentMethod: 'CASH', reason: 'Payment method was entered incorrectly when closing the order' };

    it('corrects payment method successfully', async () => {
      vi.spyOn(orderCorrectionService, 'correctPaymentMethod').mockResolvedValue(undefined);

      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/payment-method`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(200);
    });

    it('returns 409 when new method equals current method', async () => {
      vi.spyOn(orderCorrectionService, 'correctPaymentMethod').mockRejectedValue(
        new ValidationError('New payment method is the same as the current one'),
      );

      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/payment-method`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(400);
    });

    it('returns 409 when correction window exceeded', async () => {
      vi.spyOn(orderCorrectionService, 'correctPaymentMethod').mockRejectedValue(
        new ConflictError('Corrections are only allowed on orders created within the last 7 days'),
      );

      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/payment-method`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });
  });

  // ── Force order READY ────────────────────────────────────────────────────

  describe('POST /admin/order-corrections/:id/force-ready', () => {
    const validBody = { reason: 'Ghost rejected ticket is blocking; kitchen confirmed all items are ready' };

    it('forces the order to READY successfully', async () => {
      vi.spyOn(orderCorrectionService, 'forceOrderReady').mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/force-ready`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('READY');
    });

    it('returns 409 when order is not IN_PROGRESS', async () => {
      vi.spyOn(orderCorrectionService, 'forceOrderReady').mockRejectedValue(
        new ConflictError('Order must be IN_PROGRESS to force READY'),
      );

      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/force-ready`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 409 when non-rejected tickets are not yet READY', async () => {
      vi.spyOn(orderCorrectionService, 'forceOrderReady').mockRejectedValue(
        new ConflictError('All non-rejected prep tickets must already be READY before forcing the order to READY'),
      );

      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/force-ready`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 409 when there are no rejected tickets', async () => {
      vi.spyOn(orderCorrectionService, 'forceOrderReady').mockRejectedValue(
        new ConflictError('No rejected ticket found — order should transition to READY automatically'),
      );

      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/force-ready`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });
  });

  // ── Revert AWAITING_AUTHORIZATION ────────────────────────────────────────

  describe('POST /admin/order-corrections/:id/revert-auth', () => {
    const validBody = { reason: 'House account auth will not be used; customer decided to pay cash instead' };

    it('reverts auth and returns order to READY', async () => {
      vi.spyOn(orderCorrectionService, 'revertAwaitingAuth').mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/revert-auth`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('READY');
    });

    it('returns 409 when order is not AWAITING_AUTHORIZATION', async () => {
      vi.spyOn(orderCorrectionService, 'revertAwaitingAuth').mockRejectedValue(
        new ConflictError('Order must be AWAITING_AUTHORIZATION to revert'),
      );

      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/revert-auth`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 409 when no pending auth request exists', async () => {
      vi.spyOn(orderCorrectionService, 'revertAwaitingAuth').mockRejectedValue(
        new ConflictError('No pending house account auth request found on this order'),
      );

      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/revert-auth`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });
  });

  // ── Remove order item ────────────────────────────────────────────────────

  describe('PATCH /admin/order-corrections/:id/items/:itemId/remove', () => {
    const validBody = { reason: 'Item was added by mistake and customer refused to pay; confirmed with manager' };

    it('removes item and recalculates total', async () => {
      vi.spyOn(orderCorrectionService, 'removeOrderItem').mockResolvedValue(undefined);

      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/items/${itemId}/remove`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('recalculated');
    });

    it('returns 409 when order is CANCELLED', async () => {
      vi.spyOn(orderCorrectionService, 'removeOrderItem').mockRejectedValue(
        new ConflictError('Cannot remove items from a CANCELLED order'),
      );

      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/items/${itemId}/remove`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 409 when trying to remove the last item', async () => {
      vi.spyOn(orderCorrectionService, 'removeOrderItem').mockRejectedValue(
        new ConflictError('Cannot remove the last item from an order'),
      );

      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/items/${itemId}/remove`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 404 when item is not found on the order', async () => {
      vi.spyOn(orderCorrectionService, 'removeOrderItem').mockRejectedValue(
        new NotFoundError('Order item not found'),
      );

      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/items/${itemId}/remove`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(404);
    });
  });

  // ── Revert rejected ticket ───────────────────────────────────────────────

  describe('POST /admin/order-corrections/:id/tickets/:ticketId/revert-rejected', () => {
    const validBody = { reason: 'Barista accidentally rejected the ticket; kitchen confirmed item not yet made' };

    it('reverts rejected ticket to PENDING successfully', async () => {
      vi.spyOn(orderCorrectionService, 'revertRejectedTicket').mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/tickets/${ticketId}/revert-rejected`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('PENDING');
    });

    it('returns 404 when ticket is not found on the order', async () => {
      vi.spyOn(orderCorrectionService, 'revertRejectedTicket').mockRejectedValue(
        new NotFoundError('Prep ticket not found on this order'),
      );

      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/tickets/${ticketId}/revert-rejected`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(404);
    });

    it('returns 409 when ticket is not REJECTED', async () => {
      vi.spyOn(orderCorrectionService, 'revertRejectedTicket').mockRejectedValue(
        new ConflictError('Ticket is READY — only REJECTED tickets can be reverted'),
      );

      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/tickets/${ticketId}/revert-rejected`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 409 when correction window exceeded', async () => {
      vi.spyOn(orderCorrectionService, 'revertRejectedTicket').mockRejectedValue(
        new ConflictError('Corrections are only allowed on orders created within the last 7 days'),
      );

      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/tickets/${ticketId}/revert-rejected`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });
  });

  // ── Adjust order total ───────────────────────────────────────────────────

  describe('PATCH /admin/order-corrections/:id/total', () => {
    const validBody = { newTotal: 500, reason: 'Manager approved post-close discount; receipt to be reprinted' };

    it('adjusts order total successfully', async () => {
      vi.spyOn(orderCorrectionService, 'adjustOrderTotal').mockResolvedValue(undefined);

      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/total`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(200);
    });

    it('returns 409 when order is CANCELLED', async () => {
      vi.spyOn(orderCorrectionService, 'adjustOrderTotal').mockRejectedValue(
        new ConflictError('Cannot adjust the total of a CANCELLED order'),
      );

      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/total`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 400 when newTotal is negative', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/total`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send({ newTotal: -100, reason: 'Manager approved post-close discount; receipt to be reprinted' });

      expect(res.status).toBe(400);
    });

    it('returns 409 when correction window exceeded', async () => {
      vi.spyOn(orderCorrectionService, 'adjustOrderTotal').mockRejectedValue(
        new ConflictError('Corrections are only allowed on orders created within the last 7 days'),
      );

      const res = await request(app)
        .patch(`/api/v1/admin/order-corrections/${orderId}/total`)
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });
  });

  // ── Split payment lines ──────────────────────────────────────────────────

  describe('POST /admin/order-corrections/:id/split-lines', () => {
    const validSplitBody = {
      label: 'Guest 1',
      amount: 500,
      method: 'CASH',
      reason: 'Split line was recorded with the wrong method at close',
    };

    it('adds a corrected split line for MANAGER', async () => {
      vi.spyOn(orderCorrectionService, 'addSplitLine').mockResolvedValue({
        id: splitLineId,
        orderId,
        label: 'Guest 1',
        amount: '500.00',
        method: 'CASH',
        mpesaCode: null,
        paidAt: new Date(),
        createdAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/split-lines`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validSplitBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('returns 409 when the new line would exceed the order total', async () => {
      vi.spyOn(orderCorrectionService, 'addSplitLine').mockRejectedValue(
        new ConflictError('Adding KES 500 would exceed the order total of KES 900.00'),
      );

      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/split-lines`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validSplitBody);

      expect(res.status).toBe(409);
    });

    it('returns 400 when mpesaCode is missing for method MPESA', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/order-corrections/${orderId}/split-lines`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ label: 'Guest 1', amount: 500, method: 'MPESA', reason: 'Split line was recorded incorrectly at close' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /admin/order-corrections/:id/split-lines/:lineId', () => {
    const validBody = { reason: 'Split line was recorded with the wrong method at close' };

    it('removes a split line for MANAGER', async () => {
      vi.spyOn(orderCorrectionService, 'removeSplitLine').mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/v1/admin/order-corrections/${orderId}/split-lines/${splitLineId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 409 when order is not CLOSED', async () => {
      vi.spyOn(orderCorrectionService, 'removeSplitLine').mockRejectedValue(
        new ConflictError('Split payment line correction is only allowed on CLOSED orders'),
      );

      const res = await request(app)
        .delete(`/api/v1/admin/order-corrections/${orderId}/split-lines/${splitLineId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 409 when removing the last remaining split line', async () => {
      vi.spyOn(orderCorrectionService, 'removeSplitLine').mockRejectedValue(
        new ConflictError('Cannot remove the last payment line from a split order'),
      );

      const res = await request(app)
        .delete(`/api/v1/admin/order-corrections/${orderId}/split-lines/${splitLineId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 404 when the split line is not found on the order', async () => {
      vi.spyOn(orderCorrectionService, 'removeSplitLine').mockRejectedValue(
        new NotFoundError('Payment line not found'),
      );

      const res = await request(app)
        .delete(`/api/v1/admin/order-corrections/${orderId}/split-lines/${splitLineId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validBody);

      expect(res.status).toBe(404);
    });
  });
});
