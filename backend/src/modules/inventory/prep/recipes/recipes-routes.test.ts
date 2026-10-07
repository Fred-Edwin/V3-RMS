/**
 * The capability gate on the three Usual-recipes routes, role by role (the grid in `_shared/prep-access.test.ts`).
 * The service is mocked: this test is about who gets through, and that bad input is a 400 before the service runs.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler';
import router from './recipes-routes';
import { recipesService } from './recipes-service';

vi.mock('../../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    next();
  },
}));
vi.mock('./recipes-service', () => ({ recipesService: { list: vi.fn(), get: vi.fn(), save: vi.fn() } }));

const app = express().use(express.json()).use('/inventory/prep', router).use(errorHandler);
const as = (role: string) => JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', role, siteId: null });
const itemId = '33333333-3333-4333-8333-333333333333';
const body = { targetYield: '38', lines: [{ itemId: '44444444-4444-4444-8444-444444444444', amount: '10', isMain: true }] };

const READERS = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'STORE_ATTENDANT'];
const WRITERS = ['STORE_MANAGER', 'SYSTEM_ADMIN'];
const NO_PREP = ['WAITER', 'CHEF', 'BARISTA'];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(recipesService.list).mockResolvedValue({ items: [], total: 0, totalItems: 0, withoutRecipe: 0 });
  vi.mocked(recipesService.get).mockResolvedValue({ itemId, itemName: 'Fried chicken', unit: 'portions', current: null, suggestFromLastRun: null, history: [] });
  vi.mocked(recipesService.save).mockResolvedValue({ itemId, itemName: 'Fried chicken', unit: 'portions', current: null, suggestFromLastRun: null, history: [] });
});

describe('GET /inventory/prep/recipes and /recipes/:itemId (prep.read)', () => {
  it.each(READERS)('lets %s read the list and a detail', async (role) => {
    expect((await request(app).get('/inventory/prep/recipes').set('x-test-user', as(role))).status).toBe(200);
    expect((await request(app).get(`/inventory/prep/recipes/${itemId}`).set('x-test-user', as(role))).status).toBe(200);
  });

  it.each(NO_PREP)('refuses %s with 403', async (role) => {
    expect((await request(app).get('/inventory/prep/recipes').set('x-test-user', as(role))).status).toBe(403);
    expect((await request(app).get(`/inventory/prep/recipes/${itemId}`).set('x-test-user', as(role))).status).toBe(403);
    expect(recipesService.list).not.toHaveBeenCalled();
  });

  it('is 401 without a signed-in user', async () => {
    expect((await request(app).get('/inventory/prep/recipes')).status).toBe(401);
  });

  it('wraps the data in the standard envelope and parses the query defaults', async () => {
    const res = await request(app).get('/inventory/prep/recipes?show=has&perPage=10').set('x-test-user', as('STORE_MANAGER'));
    expect(res.body).toEqual({ success: true, data: { items: [], total: 0, totalItems: 0, withoutRecipe: 0 } });
    expect(recipesService.list).toHaveBeenCalledWith(expect.anything(), { show: 'has', changed: 'any', page: 1, perPage: 10 });
  });

  it('is 400 for a bad query or a bad item id', async () => {
    expect((await request(app).get('/inventory/prep/recipes?show=maybe').set('x-test-user', as('STORE_MANAGER'))).status).toBe(400);
    expect((await request(app).get('/inventory/prep/recipes/not-a-uuid').set('x-test-user', as('STORE_MANAGER'))).status).toBe(400);
  });
});

describe('PUT /inventory/prep/recipes/:itemId (prep.recipes_write)', () => {
  it.each(WRITERS)('lets %s save', async (role) => {
    const res = await request(app).put(`/inventory/prep/recipes/${itemId}`).set('x-test-user', as(role)).send(body);
    expect(res.status).toBe(200);
    expect(recipesService.save).toHaveBeenCalledWith(expect.objectContaining({ role }), itemId, expect.objectContaining({ targetYield: '38' }));
  });

  it.each(['ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'STORE_ATTENDANT', ...NO_PREP])('refuses %s with 403, read-only', async (role) => {
    expect((await request(app).put(`/inventory/prep/recipes/${itemId}`).set('x-test-user', as(role)).send(body)).status).toBe(403);
    expect(recipesService.save).not.toHaveBeenCalled();
  });

  it('is 400 for a body that breaks the contract, before the service runs', async () => {
    const put = (payload: unknown) => request(app).put(`/inventory/prep/recipes/${itemId}`).set('x-test-user', as('STORE_MANAGER')).send(payload as object);
    expect((await put({ ...body, targetYield: '0' })).status).toBe(400);
    expect((await put({ ...body, targetYield: 38 })).status).toBe(400);
    expect((await put({ ...body, lines: [] })).status).toBe(400);
    expect((await put({ ...body, reason: 'BECAUSE' })).status).toBe(400);
    expect(recipesService.save).not.toHaveBeenCalled();
  });
});
