import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import * as hrService from '../src/services/hr-service';
import { signAccessToken } from '../src/utils/jwt';

// Covers STORE_ROLES_STAFF_INTEGRATION.md item 3: STORE_MANAGER/STORE_ATTENDANT
// were added to ALL_STAFF in hr-routes.ts. These self-service leave routes
// previously returned 403 for both roles.

const siteId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const managerToken = signAccessToken({
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'STORE_MANAGER',
  siteId,
});

const attendantToken = signAccessToken({
  userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'STORE_ATTENDANT',
  siteId,
});

describe('Store roles — leave self-service RBAC', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe.each([
    ['STORE_MANAGER', managerToken],
    ['STORE_ATTENDANT', attendantToken],
  ] as const)('%s', (_label, token) => {
    it('GET /hr/leave/balances/my returns 200 (was 403 before role allowlist update)', async () => {
      vi.spyOn(hrService, 'getLeaveBalances').mockResolvedValue([] as never);

      const res = await request(app).get('/api/v1/hr/leave/balances/my').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(hrService.getLeaveBalances).toHaveBeenCalled();
    });

    it('GET /hr/leave/requests/my returns 200 (was 403 before role allowlist update)', async () => {
      vi.spyOn(hrService, 'getMyLeaveRequests').mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      } as never);

      const res = await request(app).get('/api/v1/hr/leave/requests/my').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(hrService.getMyLeaveRequests).toHaveBeenCalled();
    });
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/v1/hr/leave/balances/my');
    expect(res.status).toBe(401);
  });
});
