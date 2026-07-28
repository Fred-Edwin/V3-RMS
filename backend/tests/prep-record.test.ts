import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { prepRecordService } from '../src/services/prep-record-service';
import { NotFoundError, ValidationError } from '../src/utils/errors';
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

const recordId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const outputItemId = '11111111-1111-4111-8111-111111111111';
const inputItemId = '22222222-2222-4222-8222-222222222222';
const locationId = '33333333-3333-4333-8333-333333333333';
const recipeId = '44444444-4444-4444-8444-444444444444';

const buildRecord = (overrides: Record<string, unknown> = {}) => ({
  id: recordId,
  organizationId,
  locationId,
  outputItemId,
  actualYield: '5.6',
  unitCost: '250',
  recordedById: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  recordedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  outputItem: { id: outputItemId, name: 'Marinated Chicken', usageUnit: 'g' },
  promotedTo: null,
  lines: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      inputItemId,
      quantity: '6',
      unitCost: '291.67',
      inputItem: { id: inputItemId, name: 'Raw Chicken', usageUnit: 'kg' },
    },
  ],
  ...overrides,
});

const validCreateBody = {
  locationId,
  outputItemId,
  actualYield: '5.6',
  inputs: [{ inventoryItemId: inputItemId, quantity: '6' }],
};

describe('Prep Record routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RBAC enforcement', () => {
    it('GET /prep-records allows attendant (read)', async () => {
      vi.spyOn(prepRecordService, 'list').mockResolvedValue([buildRecord()] as never);
      const res = await request(app)
        .get('/api/v1/prep-records')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
    });

    it('POST /prep-records allows attendant to log a prep record', async () => {
      vi.spyOn(prepRecordService, 'create').mockResolvedValue(buildRecord() as never);
      const res = await request(app)
        .post('/api/v1/prep-records')
        .set('Authorization', `Bearer ${attendantToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
    });

    it('POST /prep-records blocks waiter (403)', async () => {
      const res = await request(app)
        .post('/api/v1/prep-records')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(403);
    });

    it('POST /prep-records/:id/promote blocks attendant (403) — Manager-only create/edit of PrepRecipe', async () => {
      const res = await request(app)
        .post(`/api/v1/prep-records/${recordId}/promote`)
        .set('Authorization', `Bearer ${attendantToken}`)
        .send({ name: 'Standard Marinated Chicken' });
      expect(res.status).toBe(403);
    });

    it('GET /prep-recipes allows attendant (view-only per §8.3)', async () => {
      vi.spyOn(prepRecordService, 'listRecipes').mockResolvedValue([] as never);
      const res = await request(app)
        .get('/api/v1/prep-recipes')
        .set('Authorization', `Bearer ${attendantToken}`);
      expect(res.status).toBe(200);
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/prep-records');
      expect(res.status).toBe(401);
    });
  });

  describe('create (happy path + validation)', () => {
    it('creates a prep record with input lines', async () => {
      vi.spyOn(prepRecordService, 'create').mockResolvedValue(buildRecord() as never);
      const res = await request(app)
        .post('/api/v1/prep-records')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(201);
      expect(res.body.data.actualYield).toBe('5.6');
      expect(res.body.data.lines).toHaveLength(1);
    });

    it('rejects an empty inputs array (400)', async () => {
      const res = await request(app)
        .post('/api/v1/prep-records')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, inputs: [] });
      expect(res.status).toBe(400);
    });

    it('rejects a non-UUID outputItemId (400)', async () => {
      const res = await request(app)
        .post('/api/v1/prep-records')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ ...validCreateBody, outputItemId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });

    it('surfaces a service ValidationError (unknown item) as 400', async () => {
      vi.spyOn(prepRecordService, 'create').mockRejectedValue(
        new ValidationError('Output inventory item not found'),
      );
      const res = await request(app)
        .post('/api/v1/prep-records')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(validCreateBody);
      expect(res.status).toBe(400);
    });
  });

  describe('promote to recipe', () => {
    it('Manager promotes a prep record into a saved recipe', async () => {
      vi.spyOn(prepRecordService, 'promoteRecord').mockResolvedValue({
        id: recipeId,
        organizationId,
        outputItemId,
        name: 'Standard Marinated Chicken',
        expectedYield: '5.6',
        batchLabel: null,
        instructions: null,
        promotedFromId: recordId,
        createdById: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        outputItem: { id: outputItemId, name: 'Marinated Chicken' },
        lines: [{ id: '66666666-6666-4666-8666-666666666666', inputItemId, quantity: '6', inputItem: { id: inputItemId, name: 'Raw Chicken' } }],
      } as never);

      const res = await request(app)
        .post(`/api/v1/prep-records/${recordId}/promote`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Standard Marinated Chicken' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Standard Marinated Chicken');
    });

    it('promoting an unknown prep record returns 404', async () => {
      vi.spyOn(prepRecordService, 'promoteRecord').mockRejectedValue(
        new NotFoundError('Prep record not found'),
      );
      const res = await request(app)
        .post(`/api/v1/prep-records/${recordId}/promote`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'X' });
      expect(res.status).toBe(404);
    });
  });
});
