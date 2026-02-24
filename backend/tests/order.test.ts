import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { orderService } from '../src/services/order-service';
import { ConflictError, ValidationError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const waiterToken = signAccessToken({
  userId: '11111111-1111-4111-8111-111111111111',
  role: 'WAITER',
  organizationId: '22222222-2222-4222-8222-222222222222',
});

const chefToken = signAccessToken({
  userId: '33333333-3333-4333-8333-333333333333',
  role: 'CHEF',
  organizationId: '22222222-2222-4222-8222-222222222222',
});

const kitchenDisplayToken = signAccessToken({
  userId: '88888888-8888-4888-8888-888888888888',
  role: 'KITCHEN_DISPLAY',
  organizationId: '22222222-2222-4222-8222-222222222222',
});

const orderId = '44444444-4444-4444-8444-444444444444';

const sampleOrder = {
  id: orderId,
  organizationId: '22222222-2222-4222-8222-222222222222',
  dailyNumber: 1,
  orderDate: '2026-02-24',
  type: 'DINE_IN' as const,
  status: 'PENDING' as const,
  tableNumber: '4',
  notes: null,
  subtotal: '700.00',
  deliveryFee: '0.00',
  total: '700.00',
  paymentMethod: null,
  paidAt: null,
  closedAt: null,
  createdAt: new Date('2026-02-24T10:00:00.000Z'),
  updatedAt: new Date('2026-02-24T10:00:00.000Z'),
  createdBy: { id: '11111111-1111-4111-8111-111111111111', name: 'Waiter One' },
  deliveryZone: null,
  items: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      menuItemId: '66666666-6666-4666-8666-666666666666',
      name: 'Latte',
      quantity: 2,
      unitPrice: '350.00',
      subtotal: '700.00',
      notes: null,
    },
  ],
  prepTickets: [
    {
      id: '77777777-7777-4777-8777-777777777777',
      orderId,
      station: 'BARISTA' as const,
      status: 'PENDING' as const,
      claimedById: null,
      claimedBy: null,
      claimedAt: null,
      readyAt: null,
      items: [{ name: 'Latte', quantity: 2, notes: null }],
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      updatedAt: new Date('2026-02-24T10:00:00.000Z'),
    },
  ],
};

describe('Order routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/orders creates an order for waiter', async () => {
    vi.spyOn(orderService, 'create').mockResolvedValue(sampleOrder);

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        type: 'DINE_IN',
        tableNumber: '4',
        items: [{ menuItemId: '66666666-6666-4666-8666-666666666666', quantity: 2, notes: null }],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.dailyNumber).toBe(1);
  });

  it('POST /api/v1/orders returns 400 for empty items', async () => {
    vi.spyOn(orderService, 'create').mockRejectedValue(new ValidationError('items must have at least 1 item'));

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        type: 'TAKE_AWAY',
        items: [],
      });

    expect(response.status).toBe(400);
  });

  it('POST /api/v1/orders blocks chef role', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${chefToken}`)
      .send({
        type: 'TAKE_AWAY',
        items: [{ menuItemId: '66666666-6666-4666-8666-666666666666', quantity: 1, notes: null }],
      });

    expect(response.status).toBe(403);
  });

  it('PATCH /api/v1/orders/:id/items returns 409 when preparation has started', async () => {
    vi.spyOn(orderService, 'updateItems').mockRejectedValue(
      new ConflictError('Order cannot be modified. Preparation has already started at all stations.'),
    );

    const response = await request(app)
      .patch(`/api/v1/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        items: [{ menuItemId: '66666666-6666-4666-8666-666666666666', quantity: 1 }],
      });

    expect(response.status).toBe(409);
  });

  it('PATCH /api/v1/orders/:id/payment returns 409 when order is not ready', async () => {
    vi.spyOn(orderService, 'recordPayment').mockRejectedValue(
      new ConflictError('Payment can only be recorded when the order is ready.'),
    );

    const response = await request(app)
      .patch(`/api/v1/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ paymentMethod: 'MPESA' });

    expect(response.status).toBe(409);
  });

  it('PATCH /api/v1/orders/:id/cancel cancels a pending order', async () => {
    vi.spyOn(orderService, 'cancel').mockResolvedValue({
      ...sampleOrder,
      status: 'CANCELLED',
    });

    const response = await request(app)
      .patch(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ reason: 'Customer left' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('CANCELLED');
  });

  it('GET /api/v1/orders/active allows kitchen display role', async () => {
    vi.spyOn(orderService, 'getActive').mockResolvedValue([sampleOrder]);

    const response = await request(app)
      .get('/api/v1/orders/active')
      .set('Authorization', `Bearer ${kitchenDisplayToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
