import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { clockService } from '../src/services/clock-service';
import { ConflictError, ForbiddenError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const waiterToken = signAccessToken({
  userId: '11111111-1111-4111-8111-111111111111',
  role: 'WAITER',
  organizationId: '22222222-2222-4222-8222-222222222222',
});

const managerToken = signAccessToken({
  userId: '33333333-3333-4333-8333-333333333333',
  role: 'MANAGER',
  organizationId: '22222222-2222-4222-8222-222222222222',
});

describe('Clock routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/clock/in returns 201 with GPS method', async () => {
    vi.spyOn(clockService, 'clockIn').mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      organizationId: '22222222-2222-4222-8222-222222222222',
      shiftAssignmentId: '55555555-5555-4555-8555-555555555555',
      userId: '11111111-1111-4111-8111-111111111111',
      clockInAt: new Date('2026-02-24T05:58:00.000Z'),
      clockOutAt: null,
      clockInMethod: 'GPS',
      clockOutMethod: null,
      overrideById: null,
      overrideNote: null,
      createdAt: new Date('2026-02-24T05:58:00.000Z'),
      updatedAt: new Date('2026-02-24T05:58:00.000Z'),
    });

    const response = await request(app)
      .post('/api/v1/clock/in')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        latitude: -0.4167,
        longitude: 36.95,
        shiftAssignmentId: '55555555-5555-4555-8555-555555555555',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.clockInMethod).toBe('GPS');
  });

  it('POST /api/v1/clock/in returns 403 with distance message when outside geofence', async () => {
    vi.spyOn(clockService, 'clockIn').mockRejectedValue(
      new ForbiddenError(
        'You must be at the branch to clock in. You are approximately 120 metres away.',
        'CLOCK_OUTSIDE_GEOFENCE',
        {
          distanceMetres: 120,
          allowedRadiusMetres: 50,
        },
      ),
    );

    const response = await request(app)
      .post('/api/v1/clock/in')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        latitude: -0.4,
        longitude: 36.95,
        shiftAssignmentId: '55555555-5555-4555-8555-555555555555',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain('120 metres away');
    expect(response.body.error.code).toBe('CLOCK_OUTSIDE_GEOFENCE');
    expect(response.body.error.details.distanceMetres).toBe(120);
  });

  it('POST /api/v1/clock/in returns 409 when already clocked in', async () => {
    vi.spyOn(clockService, 'clockIn').mockRejectedValue(new ConflictError('Already clocked in'));

    const response = await request(app)
      .post('/api/v1/clock/in')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        latitude: -0.4167,
        longitude: 36.95,
        shiftAssignmentId: '55555555-5555-4555-8555-555555555555',
      });

    expect(response.status).toBe(409);
  });

  it('POST /api/v1/clock/out returns 409 when not clocked in', async () => {
    vi.spyOn(clockService, 'clockOut').mockRejectedValue(new ConflictError('Not currently clocked in'));

    const response = await request(app)
      .post('/api/v1/clock/out')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({
        latitude: -0.4167,
        longitude: 36.95,
        shiftAssignmentId: '55555555-5555-4555-8555-555555555555',
      });

    expect(response.status).toBe(409);
  });

  it('POST /api/v1/clock/override returns OVERRIDE record', async () => {
    vi.spyOn(clockService, 'clockOverride').mockResolvedValue({
      record: {
        id: '44444444-4444-4444-8444-444444444444',
        organizationId: '22222222-2222-4222-8222-222222222222',
        shiftAssignmentId: '55555555-5555-4555-8555-555555555555',
        userId: '11111111-1111-4111-8111-111111111111',
        clockInAt: new Date('2026-02-24T06:05:00.000Z'),
        clockOutAt: null,
        clockInMethod: 'OVERRIDE',
        clockOutMethod: null,
        overrideById: '33333333-3333-4333-8333-333333333333',
        overrideNote: 'GPS unavailable on device',
        createdAt: new Date('2026-02-24T06:05:00.000Z'),
        updatedAt: new Date('2026-02-24T06:05:00.000Z'),
      },
      message: 'Clock-in override applied for James Kamau',
    });

    const response = await request(app)
      .post('/api/v1/clock/override')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        userId: '11111111-1111-4111-8111-111111111111',
        shiftAssignmentId: '55555555-5555-4555-8555-555555555555',
        action: 'CLOCK_IN',
        reason: 'GPS unavailable on device',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.clockInMethod).toBe('OVERRIDE');
  });
});
