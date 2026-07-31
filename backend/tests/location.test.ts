import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { locationService } from '../src/services/location-service';
import { NotFoundError } from '../src/utils/errors';
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

const locationId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const buildLocation = (overrides: Record<string, unknown> = {}) => ({
  id: locationId,
  organizationId,
  type: 'CENTRAL_STORE',
  name: 'Central Store',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('Location routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RBAC enforcement', () => {
    it('GET /locations allows manager (read)', async () => {
      vi.spyOn(locationService, 'list').mockResolvedValue([buildLocation()] as never);
      const res = await request(app)
        .get('/api/v1/locations')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /locations allows attendant (read)', async () => {
      vi.spyOn(locationService, 'list').mockResolvedValue([buildLocation()] as never);
      const res = await request(app)
        .get('/api/v1/locations')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /locations blocks waiter (403)', async () => {
      const res = await request(app)
        .get('/api/v1/locations')
        .set('Authorization', `Bearer ${waiterToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /locations returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/locations');
      expect(res.status).toBe(401);
    });
  });

  describe('happy paths', () => {
    it('GET /locations returns the Central Store location', async () => {
      vi.spyOn(locationService, 'list').mockResolvedValue([buildLocation()] as never);
      const res = await request(app)
        .get('/api/v1/locations')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0].type).toBe('CENTRAL_STORE');
    });

    it('GET /locations/:id returns 404 for unknown location', async () => {
      vi.spyOn(locationService, 'getById').mockRejectedValue(new NotFoundError('Location not found'));
      const res = await request(app)
        .get(`/api/v1/locations/${locationId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('validation failures (400)', () => {
    it('GET /locations/:id rejects non-UUID id param', async () => {
      const res = await request(app)
        .get('/api/v1/locations/not-a-uuid')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(400);
    });
  });
});
