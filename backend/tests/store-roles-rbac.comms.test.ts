import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { commsService } from '../src/services/comms-service';
import { signAccessToken } from '../src/utils/jwt';

// Covers STORE_ROLES_STAFF_INTEGRATION.md item 5: STORE_MANAGER/STORE_ATTENDANT
// were added to ALL_HUMAN_ROLES in comms-routes.ts. These routes previously
// returned 403 for both roles.

const organizationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const managerToken = signAccessToken({
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'STORE_MANAGER',
  organizationId,
});

const attendantToken = signAccessToken({
  userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'STORE_ATTENDANT',
  organizationId,
});

describe('Store roles — Comms/Inbox RBAC', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe.each([
    ['STORE_MANAGER', managerToken],
    ['STORE_ATTENDANT', attendantToken],
  ] as const)('%s', (_label, token) => {
    it('GET /comms/conversations returns 200 (was 403 before role allowlist update)', async () => {
      vi.spyOn(commsService, 'getConversations').mockResolvedValue({
        conversations: [],
        nextCursor: null,
      } as never);

      const res = await request(app).get('/api/v1/comms/conversations').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(commsService.getConversations).toHaveBeenCalled();
    });

    it('GET /comms/broadcasts returns 200 (was 403 before role allowlist update)', async () => {
      vi.spyOn(commsService, 'getBroadcasts').mockResolvedValue({
        broadcasts: [],
        pagination: { total: 0, page: 1, perPage: 20 },
      } as never);

      const res = await request(app).get('/api/v1/comms/broadcasts').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(commsService.getBroadcasts).toHaveBeenCalled();
    });

    it('GET /comms/notices returns 200 (was 403 before role allowlist update)', async () => {
      vi.spyOn(commsService, 'getNotices').mockResolvedValue({
        notices: [],
        pagination: { total: 0, page: 1, perPage: 20 },
      } as never);

      const res = await request(app).get('/api/v1/comms/notices').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(commsService.getNotices).toHaveBeenCalled();
    });
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/v1/comms/conversations');
    expect(res.status).toBe(401);
  });
});
