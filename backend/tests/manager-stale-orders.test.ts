import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { orderService } from '../src/services/order-service';
import { ConflictError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const BRANCH = '22222222-2222-4222-8222-222222222222';

const managerToken = signAccessToken({ userId: '11111111-1111-4111-8111-111111111111', role: 'MANAGER', siteId: BRANCH });
const waiterToken = signAccessToken({ userId: '44444444-4444-4444-8444-444444444444', role: 'WAITER', siteId: BRANCH });
const chefToken = signAccessToken({ userId: '33333333-3333-4333-8333-333333333333', role: 'CHEF', siteId: BRANCH });

const orderId = '55555555-5555-4555-8555-555555555555';

describe('Manager stale-order resolution', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── GET /orders/branch-stale ──

  it('returns the branch stale-order list for a manager', async () => {
    const spy = vi.spyOn(orderService, 'getBranchStaleOrders').mockResolvedValue({
      totalOrders: 2,
      totalLiability: '1500.00',
      orders: [
        { id: 'o1', dailyNumber: 12, status: 'READY', orderDate: '2026-05-10T00:00:00.000Z', tableNumber: '4', total: '900.00', branchName: 'Kingz', waiterName: 'James' },
        { id: 'o2', dailyNumber: 18, status: 'PENDING', orderDate: '2026-05-11T00:00:00.000Z', tableNumber: null, total: '600.00', branchName: 'Kingz', waiterName: 'Mary' },
      ],
    });

    const res = await request(app)
      .get('/api/v1/orders/branch-stale')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalOrders).toBe(2);
    expect(res.body.data.totalLiability).toBe('1500.00');
    expect(res.body.data.orders[0].waiterName).toBe('James');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('blocks waiter and chef from the branch stale-order list', async () => {
    for (const token of [waiterToken, chefToken]) {
      const res = await request(app)
        .get('/api/v1/orders/branch-stale')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    }
  });

  it('requires authentication for the branch stale-order list', async () => {
    const res = await request(app).get('/api/v1/orders/branch-stale');
    expect(res.status).toBe(401);
  });

  // ── PATCH /orders/:id/force-ready ──

  it('lets a manager force a stale order ready with a reason', async () => {
    const spy = vi.spyOn(orderService, 'forceReady').mockResolvedValue({ id: orderId, status: 'READY' } as never);

    const res = await request(app)
      .patch(`/api/v1/orders/${orderId}/force-ready`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Customer paid at counter yesterday; order left open by mistake' });

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(orderId, 'Customer paid at counter yesterday; order left open by mistake', expect.objectContaining({ role: 'MANAGER' }));
  });

  it('rejects force-ready with a too-short reason (Zod)', async () => {
    const res = await request(app)
      .patch(`/api/v1/orders/${orderId}/force-ready`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'x' });
    expect(res.status).toBe(400);
  });

  it('blocks waiter from force-ready', async () => {
    const res = await request(app)
      .patch(`/api/v1/orders/${orderId}/force-ready`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ reason: 'trying to force ready' });
    expect(res.status).toBe(403);
  });

  it('surfaces a conflict when the order cannot be forced ready', async () => {
    vi.spyOn(orderService, 'forceReady').mockRejectedValue(new ConflictError('Order is already ready'));

    const res = await request(app)
      .patch(`/api/v1/orders/${orderId}/force-ready`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'already ready order test' });
    expect(res.status).toBe(409);
  });

  // ── PATCH /orders/:id/payment now allows MANAGER ──

  it('allows a manager to record payment (close)', async () => {
    const spy = vi.spyOn(orderService, 'recordPayment').mockResolvedValue({ id: orderId, status: 'CLOSED' } as never);

    const res = await request(app)
      .patch(`/api/v1/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ paymentMethod: 'CASH' });

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
