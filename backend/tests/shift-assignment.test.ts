import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { shiftAssignmentService } from '../src/services/shift-assignment-service';
import { ConflictError, ValidationError } from '../src/utils/errors';
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

const assignmentId = '44444444-4444-4444-8444-444444444444';

describe('Shift assignment routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/shift-assignments allows manager assign', async () => {
    vi.spyOn(shiftAssignmentService, 'createAssignment').mockResolvedValue({
      id: assignmentId,
      organizationId: '22222222-2222-4222-8222-222222222222',
      userId: '33333333-3333-4333-8333-333333333333',
      shiftId: '55555555-5555-4555-8555-555555555555',
      date: new Date('2026-02-25T00:00:00.000Z'),
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      updatedAt: new Date('2026-02-24T10:00:00.000Z'),
    });

    const response = await request(app)
      .post('/api/v1/shift-assignments')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        userId: '33333333-3333-4333-8333-333333333333',
        shiftId: '55555555-5555-4555-8555-555555555555',
        date: '2026-02-25',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe(assignmentId);
  });

  it('POST /api/v1/shift-assignments returns 409 for duplicate', async () => {
    vi.spyOn(shiftAssignmentService, 'createAssignment').mockRejectedValue(
      new ConflictError('Staff member already assigned to this shift on this date'),
    );

    const response = await request(app)
      .post('/api/v1/shift-assignments')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        userId: '33333333-3333-4333-8333-333333333333',
        shiftId: '55555555-5555-4555-8555-555555555555',
        date: '2026-02-25',
      });

    expect(response.status).toBe(409);
  });

  it('GET /api/v1/shift-assignments returns staff-scoped assignments for waiter', async () => {
    vi.spyOn(shiftAssignmentService, 'listAssignments').mockResolvedValue([
      {
        id: assignmentId,
        organizationId: '22222222-2222-4222-8222-222222222222',
        userId: '33333333-3333-4333-8333-333333333333',
        shiftId: '55555555-5555-4555-8555-555555555555',
        date: new Date('2026-02-25T00:00:00.000Z'),
        createdAt: new Date('2026-02-24T10:00:00.000Z'),
        updatedAt: new Date('2026-02-24T10:00:00.000Z'),
        shift: {
          id: '55555555-5555-4555-8555-555555555555',
          name: 'Morning',
          startTime: '06:00',
          endTime: '14:00',
          isActive: true,
        },
        user: {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Waiter One',
          role: 'WAITER',
          isActive: true,
        },
        clockRecord: null,
      },
    ]);

    const response = await request(app)
      .get('/api/v1/shift-assignments?startDate=2026-02-24&endDate=2026-02-28')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].user.role).toBe('WAITER');
  });

  it('DELETE /api/v1/shift-assignments/:id returns 400 for today/past assignment', async () => {
    vi.spyOn(shiftAssignmentService, 'deleteAssignment').mockRejectedValue(
      new ValidationError('Cannot delete past or current shift assignments'),
    );

    const response = await request(app)
      .delete(`/api/v1/shift-assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(400);
  });
});
