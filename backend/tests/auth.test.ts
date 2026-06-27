import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { authService } from '../src/services/auth-service';
import { UnauthorizedError, ValidationError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

describe('Auth routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/auth/login returns token and cookies for valid credentials', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        name: 'Manager User',
        email: 'manager@wendo.co.ke',
        role: 'MANAGER',
        organizationId: 'org-1',
        organizationName: 'Wendo Kingz',
      },
    });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'manager@wendo.co.ke',
      password: 'Pass12345!',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBe('access-token');
    const setCookie = response.headers['set-cookie'] as string[];
    expect(setCookie.some((value) => value.startsWith('refreshToken='))).toBe(true);
  });

  it('POST /api/v1/auth/login returns 401 for invalid credentials', async () => {
    vi.spyOn(authService, 'login').mockRejectedValue(new UnauthorizedError('Invalid credentials'));

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'manager@wendo.co.ke',
      password: 'WrongPass',
    });

    expect(response.status).toBe(401);
  });

  it('POST /api/v1/auth/refresh returns token for valid cookie', async () => {
    vi.spyOn(authService, 'refresh').mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      user: {
        id: 'user-1',
        name: 'Manager User',
        email: 'manager@wendo.co.ke',
        role: 'MANAGER',
        organizationId: 'org-1',
        organizationName: 'Wendo Kingz',
      },
    });

    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', ['refreshToken=valid-refresh-token']);

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBe('new-access-token');
    expect(response.body.data.user.id).toBe('user-1');
  });

  it('POST /api/v1/auth/refresh returns 401 for missing cookie', async () => {
    const response = await request(app).post('/api/v1/auth/refresh');
    expect(response.status).toBe(401);
  });

  it('POST /api/v1/auth/logout clears cookie', async () => {
    vi.spyOn(authService, 'logout').mockResolvedValue();

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', ['refreshToken=valid-refresh-token']);

    expect(response.status).toBe(200);
    const setCookie = response.headers['set-cookie'] as string[];
    expect(setCookie.some((value) => value.startsWith('refreshToken=;'))).toBe(true);
  });

  it('POST /api/v1/auth/logout works without access token (expired session)', async () => {
    vi.spyOn(authService, 'logout').mockResolvedValue();

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', ['refreshToken=expired-session-token']);

    expect(response.status).toBe(200);
    const setCookie = response.headers['set-cookie'] as string[];
    expect(setCookie.some((value) => value.startsWith('refreshToken=;'))).toBe(true);
  });

  it('PATCH /api/v1/auth/change-password returns 400 on wrong current password', async () => {
    vi.spyOn(authService, 'changePassword').mockRejectedValue(
      new ValidationError('Current password is incorrect'),
    );
    const token = signAccessToken({
      userId: 'manager-1',
      role: 'MANAGER',
      organizationId: 'org-1',
    });

    const response = await request(app)
      .patch('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'WrongOld123',
        newPassword: 'NewSecret123!',
      });

    expect(response.status).toBe(400);
  });

  it('POST /api/v1/auth/verify-password returns 200 verified for correct password', async () => {
    vi.spyOn(authService, 'verifyPassword').mockResolvedValue();
    const token = signAccessToken({
      userId: 'waiter-1',
      role: 'WAITER',
      organizationId: 'org-1',
    });

    const response = await request(app)
      .post('/api/v1/auth/verify-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'CorrectPass123!' });

    expect(response.status).toBe(200);
    expect(response.body.data.verified).toBe(true);
  });

  it('POST /api/v1/auth/verify-password returns 401 for wrong password', async () => {
    vi.spyOn(authService, 'verifyPassword').mockRejectedValue(
      new UnauthorizedError('Password verification failed'),
    );
    const token = signAccessToken({
      userId: 'waiter-1',
      role: 'WAITER',
      organizationId: 'org-1',
    });

    const response = await request(app)
      .post('/api/v1/auth/verify-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'WrongPass' });

    expect(response.status).toBe(401);
  });

  it('POST /api/v1/auth/verify-password returns 401 when unauthenticated', async () => {
    const response = await request(app)
      .post('/api/v1/auth/verify-password')
      .send({ password: 'CorrectPass123!' });

    expect(response.status).toBe(401);
  });

  it('POST /api/v1/auth/register-device returns 200 for authenticated user', async () => {
    vi.spyOn(authService, 'registerDevice').mockResolvedValue();
    const token = signAccessToken({
      userId: 'waiter-1',
      role: 'WAITER',
      organizationId: 'org-1',
    });

    const response = await request(app)
      .post('/api/v1/auth/register-device')
      .set('Authorization', `Bearer ${token}`)
      .send({ fcmToken: 'fcm-123' });

    expect(response.status).toBe(200);
  });
});
