/**
 * The entries route through a real express app: the §3.1 grid for six roles on W3 (every role holds waste.read; the
 * Attendant's own-only rule is the service's), query validation and defaults, and no token.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler';
import { entriesService } from './entries-service';
import entriesRouter from './entries-routes';

vi.mock('../../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    else throw Object.assign(new Error('Missing or invalid authorization header'), { statusCode: 401, code: 'AUTHENTICATION_ERROR' });
    next();
  },
}));
vi.mock('./entries-service', () => ({ entriesService: { list: vi.fn() } }));

const app = express().use(express.json()).use(entriesRouter).use(errorHandler);
const as = (role: string) => ({ 'x-test-user': JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', role, siteId: null }) });

const ROLES = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_ATTENDANT'] as const;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(entriesService.list).mockResolvedValue({ rows: [], chips: { today: 0, last7: 0, reversed: 0 }, page: { page: 1, pageSize: 50, total: 0 } });
});

describe('W3 GET /: waste.read', () => {
  it.each(ROLES)('lets %s through', async (role) => {
    expect((await request(app).get('/').set(as(role))).status).toBe(200);
    expect(entriesService.list).toHaveBeenCalledTimes(1);
  });

  it('refuses a role that holds no waste.read (a department head)', async () => {
    expect((await request(app).get('/').set(as('WAITER'))).status).toBe(403);
    expect(entriesService.list).not.toHaveBeenCalled();
  });

  it('is 401 with no token', async () => {
    expect((await request(app).get('/')).status).toBe(401);
  });
});

describe('query', () => {
  const manager = as('STORE_MANAGER');

  it('defaults to today, all, page 1 of 50', async () => {
    await request(app).get('/').set(manager);
    expect(entriesService.list).toHaveBeenCalledWith(expect.anything(), { period: 'today', scope: 'all', page: 1, pageSize: 50 });
  });

  it('passes period, scope, search and the pager through', async () => {
    await request(app).get('/?period=reversed&scope=mine&search=milk&page=2&pageSize=25').set(manager);
    expect(entriesService.list).toHaveBeenCalledWith(expect.anything(), { period: 'reversed', scope: 'mine', search: 'milk', page: 2, pageSize: 25 });
  });

  it('refuses an unknown period, scope or page size', async () => {
    expect((await request(app).get('/?period=month').set(manager)).status).toBe(400);
    expect((await request(app).get('/?scope=everyone').set(manager)).status).toBe(400);
    expect((await request(app).get('/?pageSize=30').set(manager)).status).toBe(400);
    expect(entriesService.list).not.toHaveBeenCalled();
  });
});
