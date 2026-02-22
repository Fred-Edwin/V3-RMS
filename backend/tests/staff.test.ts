import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { staffService } from '../src/services/staff-service';
import { authService } from '../src/services/auth-service';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

describe('Staff routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/staff allows manager to create own-branch staff', async () => {
    vi.spyOn(staffService, 'createStaff').mockResolvedValue({
      id: 'user-1',
      name: 'Grace',
      email: 'grace@wendo.co.ke',
      phone: '+254700000001',
      role: 'WAITER',
      isActive: true,
      organizationId: 'org-1',
      createdAt: new Date(),
      organization: { name: 'Wendo Kingz' },
      organizationName: 'Wendo Kingz',
    });
    const token = signAccessToken({
      userId: 'manager-1',
      role: 'MANAGER',
      organizationId: 'org-1',
    });

    const response = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Grace',
        email: 'grace@wendo.co.ke',
        phone: '+254700000001',
        role: 'WAITER',
        temporaryPassword: 'TempPass123!',
      });

    expect(response.status).toBe(201);
  });

  it('POST /api/v1/staff blocks manager creating for another branch', async () => {
    vi.spyOn(staffService, 'createStaff').mockRejectedValue(
      new ForbiddenError('Managers can only create staff in their own branch'),
    );
    const token = signAccessToken({
      userId: 'manager-1',
      role: 'MANAGER',
      organizationId: 'org-1',
    });

    const response = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Grace',
        email: 'grace@wendo.co.ke',
        role: 'WAITER',
        temporaryPassword: 'TempPass123!',
        organizationId: '11111111-1111-4111-8111-111111111111',
      });

    expect(response.status).toBe(403);
  });

  it('POST /api/v1/staff returns 409 for duplicate email', async () => {
    vi.spyOn(staffService, 'createStaff').mockRejectedValue(new ConflictError('Email is already in use'));
    const token = signAccessToken({
      userId: 'manager-1',
      role: 'MANAGER',
      organizationId: 'org-1',
    });

    const response = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Grace',
        email: 'grace@wendo.co.ke',
        role: 'WAITER',
        temporaryPassword: 'TempPass123!',
      });

    expect(response.status).toBe(409);
  });

  it('GET /api/v1/staff returns manager scoped data', async () => {
    vi.spyOn(staffService, 'listStaff').mockResolvedValue([
      {
        id: 'user-1',
        name: 'Grace',
        email: 'grace@wendo.co.ke',
        phone: '+254700000001',
        role: 'WAITER',
        isActive: true,
        organizationId: 'org-1',
        createdAt: new Date(),
        organization: { name: 'Wendo Kingz' },
        organizationName: 'Wendo Kingz',
      },
    ]);
    const token = signAccessToken({
      userId: 'manager-1',
      role: 'MANAGER',
      organizationId: 'org-1',
    });

    const response = await request(app).get('/api/v1/staff').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].organizationId).toBe('org-1');
  });

  it('GET /api/v1/staff returns director cross-branch data', async () => {
    vi.spyOn(staffService, 'listStaff').mockResolvedValue([
      {
        id: 'user-1',
        name: 'Grace',
        email: 'grace@wendo.co.ke',
        phone: '+254700000001',
        role: 'WAITER',
        isActive: true,
        organizationId: 'org-1',
        createdAt: new Date(),
        organization: { name: 'Wendo Kingz' },
        organizationName: 'Wendo Kingz',
      },
      {
        id: 'user-2',
        name: 'James',
        email: 'james@wendo.co.ke',
        phone: '+254700000002',
        role: 'CHEF',
        isActive: true,
        organizationId: 'org-2',
        createdAt: new Date(),
        organization: { name: 'Wendo Town' },
        organizationName: 'Wendo Town',
      },
    ]);
    const token = signAccessToken({
      userId: 'director-1',
      role: 'DIRECTOR',
      organizationId: null,
    });

    const response = await request(app)
      .get('/api/v1/staff?organizationId=11111111-1111-4111-8111-111111111111')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });

  it('PATCH /api/v1/staff/:id/deactivate then /auth/login returns 401', async () => {
    vi.spyOn(staffService, 'deactivateStaff').mockResolvedValue({
      id: 'user-1',
      name: 'Grace',
      email: 'grace@wendo.co.ke',
      phone: '+254700000001',
      role: 'WAITER',
      isActive: false,
      organizationId: 'org-1',
      createdAt: new Date(),
      organization: { name: 'Wendo Kingz' },
      organizationName: 'Wendo Kingz',
    });
    vi.spyOn(authService, 'login').mockRejectedValue(new UnauthorizedError('Account deactivated'));
    const managerToken = signAccessToken({
      userId: 'manager-1',
      role: 'MANAGER',
      organizationId: 'org-1',
    });

    const deactivateResponse = await request(app)
      .patch('/api/v1/staff/user-1/deactivate')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(deactivateResponse.status).toBe(200);

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'grace@wendo.co.ke',
      password: 'TempPass123!',
    });

    expect(loginResponse.status).toBe(401);
  });
});
