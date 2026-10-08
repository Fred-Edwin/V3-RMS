/**
 * S1 and S2 through a real express app: the §3.1 grid (stock.read: five desktop roles in, the Attendant 403) and no token.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler';
import itemsRouter from '../items/items-routes';
import { itemsService } from '../items/items-service';
import overviewRouter from './overview-routes';
import { overviewService } from './overview-service';

vi.mock('../../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    else throw Object.assign(new Error('Missing or invalid authorization header'), { statusCode: 401, code: 'AUTHENTICATION_ERROR' });
    next();
  },
}));
vi.mock('./overview-service', () => ({ overviewService: { get: vi.fn() } }));
vi.mock('../items/items-service', () => ({ itemsService: { list: vi.fn() } }));

const app = express().use(express.json()).use(overviewRouter).use(itemsRouter).use(errorHandler);
const as = (role: string) => ({ 'x-test-user': JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', role, siteId: null }) });
const ROLES = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_ATTENDANT'] as const;
const READERS = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER'];

const calls = [
  { name: 'S1 GET /overview', path: '/overview', service: () => overviewService.get },
  { name: 'S2 GET /items', path: '/items', service: () => itemsService.list },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(overviewService.get).mockResolvedValue({} as never);
  vi.mocked(itemsService.list).mockResolvedValue({} as never);
});

describe('the role grid (§3.1): stock.read', () => {
  for (const call of calls) {
    describe(call.name, () => {
      it.each(READERS)('lets %s through', async (role) => {
        expect((await request(app).get(call.path).set(as(role))).status).toBe(200);
        expect(call.service()).toHaveBeenCalledTimes(1);
      });
      it.each(ROLES.filter((r) => !READERS.includes(r)))('refuses %s with 403, before any service runs', async (role) => {
        expect((await request(app).get(call.path).set(as(role))).status).toBe(403);
        expect(call.service()).not.toHaveBeenCalled();
      });
      it('is 401 with no token', async () => {
        expect((await request(app).get(call.path)).status).toBe(401);
      });
    });
  }
});

describe('S2 query', () => {
  const manager = as('STORE_MANAGER');
  it('defaults to status all, page 1 of 50, and passes the filters through', async () => {
    await request(app).get('/items').set(manager);
    expect(itemsService.list).toHaveBeenLastCalledWith(expect.anything(), { status: 'all', page: 1, pageSize: 50 });
    await request(app).get('/items?search=sug&status=low&type=PREPPED&departmentTag=BARISTA&page=2&pageSize=100').set(manager);
    expect(itemsService.list).toHaveBeenLastCalledWith(expect.anything(), { search: 'sug', status: 'low', type: 'PREPPED', departmentTag: 'BARISTA', page: 2, pageSize: 100 });
  });
  it('refuses a bad status, section id or page size', async () => {
    expect((await request(app).get('/items?status=odd').set(manager)).status).toBe(400);
    expect((await request(app).get('/items?sectionId=x').set(manager)).status).toBe(400);
    expect((await request(app).get('/items?pageSize=10').set(manager)).status).toBe(400);
  });
});
