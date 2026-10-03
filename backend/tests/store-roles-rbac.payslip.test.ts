import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { payslipService } from '../src/services/payslip-service';
import { signAccessToken } from '../src/utils/jwt';

// Covers STORE_ROLES_STAFF_INTEGRATION.md item 2: STORE_MANAGER/STORE_ATTENDANT
// were added to ALL_HUMAN_ROLES in payslip-routes.ts. These routes previously
// returned 403 for both roles.

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

describe('Store roles — payslip self-service RBAC', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe.each([
    ['STORE_MANAGER', managerToken],
    ['STORE_ATTENDANT', attendantToken],
  ] as const)('%s', (_label, token) => {
    it('GET /payslips/my returns 200 (was 403 before role allowlist update)', async () => {
      vi.spyOn(payslipService, 'listMine').mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        perPage: 20,
      } as never);

      const res = await request(app).get('/api/v1/payslips/my').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(payslipService.listMine).toHaveBeenCalled();
    });

    it('GET /payslips/:id returns 200 (was 403 before role allowlist update)', async () => {
      vi.spyOn(payslipService, 'getById').mockResolvedValue({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } as never);

      const res = await request(app)
        .get('/api/v1/payslips/dddddddd-dddd-4ddd-8ddd-dddddddddddd')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(payslipService.getById).toHaveBeenCalled();
    });
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/v1/payslips/my');
    expect(res.status).toBe(401);
  });
});
