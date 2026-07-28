import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { wasteLogService } from '../src/services/waste-log-service';
import { ValidationError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

const organizationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const managerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const attendantId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const managerToken = signAccessToken({ userId: managerId, role: 'STORE_MANAGER', organizationId });
const attendantToken = signAccessToken({ userId: attendantId, role: 'STORE_ATTENDANT', organizationId });
const waiterToken = signAccessToken({
  userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  role: 'WAITER',
  organizationId,
});

const entryId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const itemId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';

const buildEntry = (overrides: Record<string, unknown> = {}) => ({
  id: entryId,
  organizationId,
  locationId,
  inventoryItemId: itemId,
  quantity: '1.2',
  reason: 'SPOILED',
  note: null,
  loggedById: attendantId,
  loggedAt: new Date().toISOString(),
  inventoryItem: { id: itemId, name: 'Milk', usageUnit: 'l' },
  ...overrides,
});

const validCreateBody = { locationId, inventoryItemId: itemId, quantity: '1.2', reason: 'SPOILED' };

describe('Waste Log routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RBAC enforcement', () => {
    it('GET /waste-logs allows attendant', async () => {
      vi.spyOn(wasteLogService, 'list').mockResolvedValue([buildEntry()] as never);
      const res = await request(app)
        .get('/api/v1/waste-logs')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /waste-logs allows attendant to log waste', async () => {
      vi.spyOn(wasteLogService, 'create').mockResolvedValue(buildEntry() as never);
      const res = await request(app)
        .post('/api/v1/waste-logs')
        .set('Authorization', `Bearer ${attendantToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
    });

    it('POST /waste-logs blocks waiter (403)', async () => {
      const res = await request(app)
        .post('/api/v1/waste-logs')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(403);
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/waste-logs');
      expect(res.status).toBe(401);
    });
  });

  describe('create (happy path + validation)', () => {
    it('logs a waste entry', async () => {
      vi.spyOn(wasteLogService, 'create').mockResolvedValue(buildEntry() as never);
      const res = await request(app)
        .post('/api/v1/waste-logs')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
      expect(res.body.data.reason).toBe('SPOILED');
    });

    it('rejects an invalid reason enum value (400)', async () => {
      const res = await request(app)
        .post('/api/v1/waste-logs')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, reason: 'BECAUSE' });
      expect(res.status).toBe(400);
    });

    it('surfaces a service ValidationError (zero quantity) as 400', async () => {
      vi.spyOn(wasteLogService, 'create').mockRejectedValue(
        new ValidationError('Waste quantity must be greater than zero'),
      );
      const res = await request(app)
        .post('/api/v1/waste-logs')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(400);
    });
  });
});
