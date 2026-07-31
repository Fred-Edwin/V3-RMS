import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { stockCountService } from '../src/services/stock-count-service';
import { ConflictError, NotFoundError } from '../src/utils/errors';
import { signAccessToken } from '../src/utils/jwt';

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

const waiterToken = signAccessToken({
  userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  role: 'WAITER',
  organizationId,
});

const countId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const lineId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const itemId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';

const buildCountWithExpected = (overrides: Record<string, unknown> = {}) => ({
  id: countId,
  organizationId,
  locationId,
  label: 'Weekly Count',
  status: 'IN_PROGRESS',
  scheduledDate: new Date().toISOString(),
  createdById: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  submittedById: null,
  submittedAt: null,
  approvedById: null,
  approvedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lines: [
    {
      id: lineId,
      organizationId,
      stockCountId: countId,
      inventoryItemId: itemId,
      sequence: 1,
      expectedQty: '10',
      countedQty: null,
      gapQty: null,
      inventoryItem: { id: itemId, name: 'Chicken Breast', usageUnit: 'kg' },
    },
  ],
  ...overrides,
});

const buildBlindCount = (overrides: Record<string, unknown> = {}) => {
  const full = buildCountWithExpected(overrides);
  return {
    ...full,
    lines: full.lines.map((line: Record<string, unknown>) => {
      const { expectedQty: _expectedQty, gapQty: _gapQty, ...rest } = line;
      return rest;
    }),
  };
};

const validCreateBody = {
  locationId,
  label: 'Weekly Count',
  scheduledDate: new Date().toISOString(),
  inventoryItemIds: [itemId],
};

describe('Stock Count routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RBAC enforcement', () => {
    it('GET /stock-counts allows attendant (read)', async () => {
      vi.spyOn(stockCountService, 'list').mockResolvedValue([buildBlindCount()] as never);
      const res = await request(app)
        .get('/api/v1/stock-counts')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /stock-counts (session creation) allows attendant — revised 2026-07-30, no longer Manager-only', async () => {
      vi.spyOn(stockCountService, 'create').mockResolvedValue(buildBlindCount() as never);
      const res = await request(app)
        .post('/api/v1/stock-counts')
        .set('Authorization', `Bearer ${attendantToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
    });

    it('POST /stock-counts blocks waiter (403)', async () => {
      const res = await request(app)
        .post('/api/v1/stock-counts')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(403);
    });

    it('POST /stock-counts/:id/submit allows attendant', async () => {
      vi.spyOn(stockCountService, 'submitCounts').mockResolvedValue(
        buildBlindCount({ status: 'SUBMITTED' }) as never,
      );
      const res = await request(app)
        .post(`/api/v1/stock-counts/${countId}/submit`)
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ lines: [{ lineId, countedQty: '9.5' }] });
      expect(res.status).toBe(200);
    });

    it('POST /stock-counts/:id/approve blocks attendant (403) — Manager-only', async () => {
      const res = await request(app)
        .post(`/api/v1/stock-counts/${countId}/approve`)
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(403);
    });

    it('PATCH /stock-counts/:id/lines blocks attendant (403) — Manager-only', async () => {
      const res = await request(app)
        .patch(`/api/v1/stock-counts/${countId}/lines`)
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ lines: [{ lineId, countedQty: '9.5' }] });
      expect(res.status).toBe(403);
    });

    it('PATCH /stock-counts/:id/lines allows manager to correct a SUBMITTED session', async () => {
      vi.spyOn(stockCountService, 'correctLines').mockResolvedValue(
        buildCountWithExpected({ status: 'SUBMITTED' }) as never,
      );
      const res = await request(app)
        .patch(`/api/v1/stock-counts/${countId}/lines`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ lines: [{ lineId, countedQty: '9.5' }] });
      expect(res.status).toBe(200);
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/stock-counts');
      expect(res.status).toBe(401);
    });
  });

  describe('D-14 blind counting', () => {
    it('Manager response includes expectedQty', async () => {
      vi.spyOn(stockCountService, 'getById').mockResolvedValue(buildCountWithExpected() as never);
      const res = await request(app)
        .get(`/api/v1/stock-counts/${countId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.lines[0]).toHaveProperty('expectedQty', '10');
    });

    it('Attendant response omits expectedQty entirely (not null/falsy — the key itself is absent)', async () => {
      vi.spyOn(stockCountService, 'getById').mockResolvedValue(buildBlindCount() as never);
      const res = await request(app)
        .get(`/api/v1/stock-counts/${countId}`)
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
      expect(Object.prototype.hasOwnProperty.call(res.body.data.lines[0], 'expectedQty')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(res.body.data.lines[0], 'gapQty')).toBe(false);
    });

    it('Attendant list response also omits expectedQty on every line', async () => {
      vi.spyOn(stockCountService, 'list').mockResolvedValue([buildBlindCount()] as never);
      const res = await request(app)
        .get('/api/v1/stock-counts')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
      for (const count of res.body.data) {
        for (const line of count.lines) {
          expect(Object.prototype.hasOwnProperty.call(line, 'expectedQty')).toBe(false);
        }
      }
    });
  });

  describe('create (happy path + validation)', () => {
    it('Manager creates a count session', async () => {
      vi.spyOn(stockCountService, 'create').mockResolvedValue(buildCountWithExpected() as never);
      const res = await request(app)
        .post('/api/v1/stock-counts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
      expect(res.body.data.lines).toHaveLength(1);
    });

    it('rejects an empty inventoryItemIds array (400)', async () => {
      const res = await request(app)
        .post('/api/v1/stock-counts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, inventoryItemIds: [] });
      expect(res.status).toBe(400);
    });
  });

  describe('submit / approve', () => {
    it('submitting a non-IN_PROGRESS count returns 409', async () => {
      vi.spyOn(stockCountService, 'submitCounts').mockRejectedValue(
        new ConflictError('Stock count must be IN_PROGRESS to submit counts'),
      );
      const res = await request(app)
        .post(`/api/v1/stock-counts/${countId}/submit`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ lines: [{ lineId, countedQty: '9.5' }] });
      expect(res.status).toBe(409);
    });

    it('approving a non-SUBMITTED count returns 409', async () => {
      vi.spyOn(stockCountService, 'approve').mockRejectedValue(
        new ConflictError('Stock count must be SUBMITTED to approve'),
      );
      const res = await request(app)
        .post(`/api/v1/stock-counts/${countId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(409);
    });

    it('approving an unknown count returns 404', async () => {
      vi.spyOn(stockCountService, 'approve').mockRejectedValue(
        new NotFoundError('Stock count not found'),
      );
      const res = await request(app)
        .post(`/api/v1/stock-counts/${countId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(404);
    });

    it('Manager approves a submitted count', async () => {
      vi.spyOn(stockCountService, 'approve').mockResolvedValue(
        buildCountWithExpected({ status: 'APPROVED' }) as never,
      );
      const res = await request(app)
        .post(`/api/v1/stock-counts/${countId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
    });
  });
});
