import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { prepTicketService } from '../src/services/prep-ticket-service';
import { ConflictError, ForbiddenError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const ticketId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const chefToken = signAccessToken({
  userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  role: 'CHEF',
  siteId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
});

const waiterToken = signAccessToken({
  userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  role: 'WAITER',
  siteId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
});

const sampleTicket = {
  id: ticketId,
  orderId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  orderDailyNumber: 12,
  orderType: 'DINE_IN' as const,
  tableNumber: '9',
  orderNotes: null,
  station: 'KITCHEN' as const,
  status: 'IN_PROGRESS' as const,
  claimedBy: {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    name: 'Chef One',
  },
  claimedAt: new Date('2026-02-24T10:01:00.000Z'),
  readyAt: null,
  items: [{ name: 'Burger', quantity: 1, notes: null }],
  createdAt: new Date('2026-02-24T10:00:00.000Z'),
};

describe('Prep ticket routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/prep-tickets forwards activeOnly query filter', async () => {
    const getByStationSpy = vi.spyOn(prepTicketService, 'getByStation').mockResolvedValue({
      tickets: [],
      pagination: {
        total: 0,
        page: 1,
        perPage: 20,
        totalPages: 1,
      },
    });

    const response = await request(app)
      .get('/api/v1/prep-tickets?activeOnly=true')
      .set('Authorization', `Bearer ${chefToken}`);

    expect(response.status).toBe(200);
    expect(getByStationSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        activeOnly: true,
        page: 1,
        perPage: 20,
      }),
    );
  });

  it('PATCH /api/v1/prep-tickets/:id/claim claims ticket', async () => {
    vi.spyOn(prepTicketService, 'claim').mockResolvedValue(sampleTicket);

    const response = await request(app)
      .patch(`/api/v1/prep-tickets/${ticketId}/claim`)
      .set('Authorization', `Bearer ${chefToken}`)
      .send({ claimedById: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('IN_PROGRESS');
  });

  it('PATCH /api/v1/prep-tickets/:id/claim returns 409 on second claim', async () => {
    vi.spyOn(prepTicketService, 'claim').mockRejectedValue(new ConflictError('This order has already been claimed.'));

    const response = await request(app)
      .patch(`/api/v1/prep-tickets/${ticketId}/claim`)
      .set('Authorization', `Bearer ${chefToken}`)
      .send({ claimedById: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });

    expect(response.status).toBe(409);
  });

  it('PATCH /api/v1/prep-tickets/:id/claim blocks wrong role', async () => {
    const response = await request(app)
      .patch(`/api/v1/prep-tickets/${ticketId}/claim`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ claimedById: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });

    expect(response.status).toBe(403);
  });

  it('PATCH /api/v1/prep-tickets/:id/ready marks ready', async () => {
    vi.spyOn(prepTicketService, 'markReady').mockResolvedValue({
      ...sampleTicket,
      status: 'READY',
      readyAt: new Date('2026-02-24T10:20:00.000Z'),
    });

    const response = await request(app)
      .patch(`/api/v1/prep-tickets/${ticketId}/ready`)
      .set('Authorization', `Bearer ${chefToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('READY');
  });

  it('PATCH /api/v1/prep-tickets/:id/ready returns 403 for wrong station role', async () => {
    vi.spyOn(prepTicketService, 'markReady').mockRejectedValue(
      new ForbiddenError('Cannot update a ticket from another station'),
    );

    const response = await request(app)
      .patch(`/api/v1/prep-tickets/${ticketId}/ready`)
      .set('Authorization', `Bearer ${chefToken}`);

    expect(response.status).toBe(403);
  });

  it('PATCH /api/v1/prep-tickets/:id/ready returns 409 when another staff member owns the ticket', async () => {
    vi.spyOn(prepTicketService, 'markReady').mockRejectedValue(
      new ConflictError('This ticket is assigned to Chef One.', 'TICKET_ASSIGNED_TO_OTHER_STAFF', {
        claimedById: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        claimedByName: 'Chef One',
      }),
    );

    const response = await request(app)
      .patch(`/api/v1/prep-tickets/${ticketId}/ready`)
      .set('Authorization', `Bearer ${chefToken}`);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TICKET_ASSIGNED_TO_OTHER_STAFF');
    expect(response.body.error.message).toBe('This ticket is assigned to Chef One.');
    expect(response.body.error.details).toEqual({
      claimedById: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      claimedByName: 'Chef One',
    });
  });
});
