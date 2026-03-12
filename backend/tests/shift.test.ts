import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { shiftService } from '../src/services/shift-service';
import { signAccessToken } from '../src/utils/jwt';

const managerToken = signAccessToken({
  userId: '11111111-1111-4111-8111-111111111111',
  role: 'MANAGER',
  organizationId: '22222222-2222-4222-8222-222222222222',
});

const waiterToken = signAccessToken({
  userId: '33333333-3333-4333-8333-333333333333',
  role: 'WAITER',
  organizationId: '22222222-2222-4222-8222-222222222222',
});

const shiftId = '44444444-4444-4444-8444-444444444444';

describe('Shift routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/shifts allows manager create', async () => {
    vi.spyOn(shiftService, 'createShift').mockResolvedValue({
      id: shiftId,
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Morning',
      startTime: '06:00',
      endTime: '14:00',
      isActive: true,
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      updatedAt: new Date('2026-02-24T10:00:00.000Z'),
    });

    const response = await request(app)
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Morning',
        startTime: '06:00',
        endTime: '14:00',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe('Morning');
  });

  it('POST /api/v1/shifts blocks waiter', async () => {
    const response = await request(app)
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        name: 'Morning',
        startTime: '06:00',
        endTime: '14:00',
      });

    expect(response.status).toBe(403);
  });

  it('GET /api/v1/shifts returns branch shifts', async () => {
    vi.spyOn(shiftService, 'listShifts').mockResolvedValue([
      {
        id: shiftId,
        organizationId: '22222222-2222-4222-8222-222222222222',
        name: 'Morning',
        startTime: '06:00',
        endTime: '14:00',
        isActive: true,
        createdAt: new Date('2026-02-24T10:00:00.000Z'),
        updatedAt: new Date('2026-02-24T10:00:00.000Z'),
      },
    ]);

    const response = await request(app)
      .get('/api/v1/shifts')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
  });

  it('PATCH /api/v1/shifts/:id updates shift', async () => {
    vi.spyOn(shiftService, 'updateShift').mockResolvedValue({
      id: shiftId,
      organizationId: '22222222-2222-4222-8222-222222222222',
      name: 'Early Morning',
      startTime: '05:30',
      endTime: '13:30',
      isActive: true,
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      updatedAt: new Date('2026-02-24T11:00:00.000Z'),
    });

    const response = await request(app)
      .patch(`/api/v1/shifts/${shiftId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Early Morning',
        startTime: '05:30',
      });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Early Morning');
  });

  it('DELETE /api/v1/shifts/:id succeeds regardless of existing assignments', async () => {
    vi.spyOn(shiftService, 'deleteShift').mockResolvedValue(undefined);

    const response = await request(app)
      .delete(`/api/v1/shifts/${shiftId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
  });
});
