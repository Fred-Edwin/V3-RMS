import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { staffService } from '../src/services/staff-service';
import { authService } from '../src/services/auth-service';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const STAFF_UUID = '11111111-1111-4111-8111-000000000001';
const ORG_UUID = '11111111-1111-4111-8111-111111111111';
const MANAGER_UUID = '22222222-2222-4222-8222-000000000001';
const WAITER_UUID = '33333333-3333-4333-8333-000000000001';

describe('Staff routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/staff allows manager to create own-branch staff', async () => {
    vi.spyOn(staffService, 'createStaff').mockResolvedValue({
      id: STAFF_UUID,
      name: 'Grace',
      email: 'grace@wendo.co.ke',
      phone: '+254700000001',
      role: 'WAITER',
      isActive: true,
      siteId: ORG_UUID,
      createdAt: new Date(),
      site: { name: 'Wendo Kingz' },
      siteName: 'Wendo Kingz',
    });
    const token = signAccessToken({
      userId: MANAGER_UUID,
      role: 'MANAGER',
      siteId: ORG_UUID,
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
      userId: MANAGER_UUID,
      role: 'MANAGER',
      siteId: ORG_UUID,
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
      userId: MANAGER_UUID,
      role: 'MANAGER',
      siteId: ORG_UUID,
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
        id: STAFF_UUID,
        name: 'Grace',
        email: 'grace@wendo.co.ke',
        phone: '+254700000001',
        role: 'WAITER',
        isActive: true,
        siteId: ORG_UUID,
        createdAt: new Date(),
        site: { name: 'Wendo Kingz' },
        siteName: 'Wendo Kingz',
      },
    ]);
    const token = signAccessToken({
      userId: MANAGER_UUID,
      role: 'MANAGER',
      siteId: ORG_UUID,
    });

    const response = await request(app).get('/api/v1/staff').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].organizationId).toBe(ORG_UUID);
  });

  it('GET /api/v1/staff returns director cross-branch data', async () => {
    vi.spyOn(staffService, 'listStaff').mockResolvedValue([
      {
        id: STAFF_UUID,
        name: 'Grace',
        email: 'grace@wendo.co.ke',
        phone: '+254700000001',
        role: 'WAITER',
        isActive: true,
        siteId: ORG_UUID,
        createdAt: new Date(),
        site: { name: 'Wendo Kingz' },
        siteName: 'Wendo Kingz',
      },
      {
        id: '44444444-4444-4444-8444-000000000001',
        name: 'Diana',
        email: 'diana@wendo.co.ke',
        phone: '+254700000002',
        role: 'CHEF',
        isActive: true,
        siteId: '55555555-5555-4555-8555-111111111111',
        createdAt: new Date(),
        site: { name: 'Wendo Branch 2' },
        siteName: 'Wendo Branch 2',
      },
    ]);
    const token = signAccessToken({
      userId: '66666666-6666-4666-8666-000000000001',
      role: 'DIRECTOR',
      siteId: null,
    });

    const response = await request(app)
      .get('/api/v1/staff')
      .set('Authorization', `Bearer ${token}`)
      .query({ organizationId: ORG_UUID });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });

  it('PATCH /api/v1/staff/:id/deactivate then /auth/login returns 401', async () => {
    vi.spyOn(staffService, 'deactivateStaff').mockResolvedValue({
      id: STAFF_UUID,
      name: 'Grace',
      email: 'grace@wendo.co.ke',
      phone: '+254700000001',
      role: 'WAITER',
      isActive: false,
      siteId: ORG_UUID,
      createdAt: new Date(),
      site: { name: 'Wendo Kingz' },
      siteName: 'Wendo Kingz',
    });
    vi.spyOn(authService, 'login').mockRejectedValue(new UnauthorizedError('Account deactivated'));
    const managerToken = signAccessToken({
      userId: MANAGER_UUID,
      role: 'MANAGER',
      siteId: ORG_UUID,
    });

    const deactivateResponse = await request(app)
      .patch(`/api/v1/staff/${STAFF_UUID}/deactivate`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(deactivateResponse.status).toBe(200);

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'grace@wendo.co.ke',
      password: 'TempPass123!',
    });

    expect(loginResponse.status).toBe(401);
  });

  it('PATCH /api/v1/staff/:id updates email — 200', async () => {
    vi.spyOn(staffService, 'updateStaff').mockResolvedValue({
      id: STAFF_UUID,
      name: 'Grace',
      email: 'grace.new@wendo.co.ke',
      phone: '+254700000001',
      role: 'WAITER',
      isActive: true,
      siteId: ORG_UUID,
      createdAt: new Date(),
      site: { name: 'Wendo Kingz' },
      siteName: 'Wendo Kingz',
    });
    const token = signAccessToken({
      userId: MANAGER_UUID,
      role: 'MANAGER',
      siteId: ORG_UUID,
    });

    const response = await request(app)
      .patch(`/api/v1/staff/${STAFF_UUID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'grace.new@wendo.co.ke' });

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe('grace.new@wendo.co.ke');
  });

  it('PATCH /api/v1/staff/:id with duplicate email — 409', async () => {
    vi.spyOn(staffService, 'updateStaff').mockRejectedValue(
      new ConflictError('Email is already in use'),
    );
    const token = signAccessToken({
      userId: MANAGER_UUID,
      role: 'MANAGER',
      siteId: ORG_UUID,
    });

    const response = await request(app)
      .patch(`/api/v1/staff/${STAFF_UUID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'taken@wendo.co.ke' });

    expect(response.status).toBe(409);
  });

  it('PATCH /api/v1/staff/:id/reset-password — 200', async () => {
    vi.spyOn(staffService, 'resetPassword').mockResolvedValue(undefined);
    const token = signAccessToken({
      userId: MANAGER_UUID,
      role: 'MANAGER',
      siteId: ORG_UUID,
    });

    const response = await request(app)
      .patch(`/api/v1/staff/${STAFF_UUID}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ temporaryPassword: 'NewPass123!' });

    expect(response.status).toBe(200);
    expect(staffService.resetPassword).toHaveBeenCalledWith(
      STAFF_UUID,
      'NewPass123!',
      expect.objectContaining({ role: 'MANAGER' }),
    );
  });

  it('PATCH /api/v1/staff/:id/reset-password — 403 for waiter', async () => {
    const token = signAccessToken({
      userId: WAITER_UUID,
      role: 'WAITER',
      siteId: ORG_UUID,
    });

    const response = await request(app)
      .patch(`/api/v1/staff/${STAFF_UUID}/reset-password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ temporaryPassword: 'NewPass123!' });

    expect(response.status).toBe(403);
  });

  it('DELETE /api/v1/staff/:id with no dependencies — 200', async () => {
    vi.spyOn(staffService, 'hardDeleteStaff').mockResolvedValue(undefined);
    const token = signAccessToken({
      userId: MANAGER_UUID,
      role: 'MANAGER',
      siteId: ORG_UUID,
    });

    const response = await request(app)
      .delete(`/api/v1/staff/${STAFF_UUID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  it('DELETE /api/v1/staff/:id with dependencies — 409', async () => {
    vi.spyOn(staffService, 'hardDeleteStaff').mockRejectedValue(
      new ConflictError('Cannot delete staff account — linked to 3 order(s), 5 shift assignment(s). Deactivate instead.'),
    );
    const token = signAccessToken({
      userId: MANAGER_UUID,
      role: 'MANAGER',
      siteId: ORG_UUID,
    });

    const response = await request(app)
      .delete(`/api/v1/staff/${STAFF_UUID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(409);
  });
});
