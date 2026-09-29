import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { authService } from '../src/services/auth-service';
import { staffService } from '../src/services/staff-service';
import { signAccessToken } from '../src/utils/jwt';

// Pre-Demo Fixes: a Store Manager runs their own team (Team + My PIN), so the
// staff routes admit STORE_MANAGER — scoped to hub-org attendants in the
// service — and every role can read/set their own PIN status.

const hubOrgId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const targetId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const tokenFor = (role: Parameters<typeof signAccessToken>[0]['role']) =>
  signAccessToken({ userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role, organizationId: hubOrgId });

const storeManagerToken = tokenFor('STORE_MANAGER');
const attendantToken = tokenFor('STORE_ATTENDANT');
const waiterToken = tokenFor('WAITER');
const adminToken = tokenFor('SYSTEM_ADMIN');

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('Store Manager team management — RBAC gates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('PATCH /staff/:id/reset-pin', () => {
    it('allows STORE_MANAGER and calls the service', async () => {
      const spy = vi.spyOn(staffService, 'resetPin').mockResolvedValue(undefined);

      const res = await request(app).patch(`/api/v1/staff/${targetId}/reset-pin`).set(bearer(storeManagerToken));

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith(targetId, expect.objectContaining({ role: 'STORE_MANAGER' }));
      expect(JSON.stringify(res.body)).not.toMatch(/pin_?hash/i);
    });

    it('allows SYSTEM_ADMIN', async () => {
      vi.spyOn(staffService, 'resetPin').mockResolvedValue(undefined);

      const res = await request(app).patch(`/api/v1/staff/${targetId}/reset-pin`).set(bearer(adminToken));

      expect(res.status).toBe(200);
    });

    it.each([
      ['STORE_ATTENDANT', attendantToken],
      ['WAITER', waiterToken],
    ] as const)('forbids %s', async (_role, token) => {
      const spy = vi.spyOn(staffService, 'resetPin').mockResolvedValue(undefined);

      const res = await request(app).patch(`/api/v1/staff/${targetId}/reset-pin`).set(bearer(token));

      expect(res.status).toBe(403);
      expect(spy).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated caller', async () => {
      const res = await request(app).patch(`/api/v1/staff/${targetId}/reset-pin`);
      expect(res.status).toBe(401);
    });

    it('rejects a non-UUID id', async () => {
      const res = await request(app).patch('/api/v1/staff/not-a-uuid/reset-pin').set(bearer(storeManagerToken));
      expect(res.status).toBe(400);
    });
  });

  describe.each([
    ['reset-password', { temporaryPassword: 'newsecret1' }],
    ['deactivate', undefined],
    ['reactivate', undefined],
  ] as const)('PATCH /staff/:id/%s', (action, body) => {
    const spyFor = () => {
      if (action === 'reset-password') return vi.spyOn(staffService, 'resetPassword').mockResolvedValue(undefined);
      if (action === 'deactivate') {
        return vi.spyOn(staffService, 'deactivateStaff').mockResolvedValue({ id: targetId, isActive: false } as never);
      }
      return vi.spyOn(staffService, 'reactivateStaff').mockResolvedValue({ id: targetId, isActive: true } as never);
    };

    it('allows STORE_MANAGER', async () => {
      const spy = spyFor();

      const res = await request(app)
        .patch(`/api/v1/staff/${targetId}/${action}`)
        .set(bearer(storeManagerToken))
        .send(body);

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalled();
    });

    it('still forbids STORE_ATTENDANT', async () => {
      const spy = spyFor();

      const res = await request(app)
        .patch(`/api/v1/staff/${targetId}/${action}`)
        .set(bearer(attendantToken))
        .send(body);

      expect(res.status).toBe(403);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('PATCH reset-password validates the temporary password (min 8)', async () => {
    const res = await request(app)
      .patch(`/api/v1/staff/${targetId}/reset-password`)
      .set(bearer(storeManagerToken))
      .send({ temporaryPassword: 'short' });

    expect(res.status).toBe(400);
  });

  it('GET /staff/:id allows STORE_MANAGER, forbids STORE_ATTENDANT', async () => {
    const spy = vi.spyOn(staffService, 'getStaff').mockResolvedValue({ id: targetId } as never);

    const ok = await request(app).get(`/api/v1/staff/${targetId}`).set(bearer(storeManagerToken));
    const denied = await request(app).get(`/api/v1/staff/${targetId}`).set(bearer(attendantToken));

    expect(ok.status).toBe(200);
    expect(denied.status).toBe(403);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('GET /staff passes the STORE_MANAGER actor to the service and returns hasPin rows', async () => {
    const spy = vi.spyOn(staffService, 'listStaff').mockResolvedValue([{ id: targetId, hasPin: false }] as never);

    const res = await request(app).get('/api/v1/staff').set(bearer(storeManagerToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: targetId, hasPin: false }]);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ role: 'STORE_MANAGER' }), expect.anything());
  });

  it('POST /staff lets STORE_MANAGER create an attendant', async () => {
    const spy = vi.spyOn(staffService, 'createStaff').mockResolvedValue({ id: targetId } as never);

    const res = await request(app)
      .post('/api/v1/staff')
      .set(bearer(storeManagerToken))
      .send({ name: 'Mary Njeri', email: 'mary@wendo.co.ke', role: 'STORE_ATTENDANT', temporaryPassword: 'welcome123' });

    expect(res.status).toBe(201);
    expect(spy).toHaveBeenCalled();
  });
});

describe('My signing PIN — /users/me/pin-status and /users/me/pin', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['STORE_MANAGER', storeManagerToken],
    ['STORE_ATTENDANT', attendantToken],
    ['WAITER', waiterToken],
  ] as const)('GET pin-status returns only { hasPin } for %s', async (_role, token) => {
    vi.spyOn(authService, 'getPinStatus').mockResolvedValue({ hasPin: true });

    const res = await request(app).get('/api/v1/users/me/pin-status').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ hasPin: true });
  });

  it('GET pin-status requires authentication', async () => {
    const res = await request(app).get('/api/v1/users/me/pin-status');
    expect(res.status).toBe(401);
  });

  it('POST pin forwards the current password for a change', async () => {
    const spy = vi.spyOn(authService, 'setPin').mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/users/me/pin')
      .set(bearer(attendantToken))
      .send({ pin: '4821', currentPassword: 'welcome123' });

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ pin: '4821', currentPassword: 'welcome123' }));
  });

  it('POST pin rejects a non-4-digit PIN', async () => {
    const res = await request(app).post('/api/v1/users/me/pin').set(bearer(attendantToken)).send({ pin: '12' });
    expect(res.status).toBe(400);
  });

  it('POST pin requires authentication', async () => {
    const res = await request(app).post('/api/v1/users/me/pin').send({ pin: '4821' });
    expect(res.status).toBe(401);
  });
});
