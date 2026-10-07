/**
 * The log routes through a real express app: the §3.1 grid for six roles on W1 and W2, validation, the 200 / 201 on a
 * replayed batch, and no token. The service is mocked; the capability gate is the real one.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler';
import { logService } from './log-service';
import logRouter from './log-routes';

vi.mock('../../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    else throw Object.assign(new Error('Missing or invalid authorization header'), { statusCode: 401, code: 'AUTHENTICATION_ERROR' });
    next();
  },
}));
vi.mock('./log-service', () => ({ logService: { listItems: vi.fn(), log: vi.fn() } }));

const app = express().use(express.json()).use(logRouter).use(errorHandler);
const as = (role: string) => ({ 'x-test-user': JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', role, siteId: null }) });

const ITEM = '10000000-0000-4000-8000-000000000060';
const KEY = 'idem-key-0001';
const body = { entries: [{ inventoryItemId: ITEM, quantity: '3', reason: 'EXPIRY' }], idempotencyKey: KEY };

const ROLES = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_ATTENDANT'] as const;
const LOGGERS = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'STORE_ATTENDANT'];

type Call = { name: string; send: (role: string) => request.Test; service: keyof typeof logService; status: number };
const calls: Call[] = [
  { name: 'W1 GET /items', send: (r) => request(app).get('/items').set(as(r)), service: 'listItems', status: 200 },
  { name: 'W2 POST /', send: (r) => request(app).post('/').set(as(r)).send(body), service: 'log', status: 201 },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(logService.listItems).mockResolvedValue({ often: [], items: [] });
  vi.mocked(logService.log).mockResolvedValue({ result: { entries: [], replayed: false }, replayed: false });
});

describe('the role grid (§3.1): waste.log', () => {
  for (const call of calls) {
    describe(call.name, () => {
      it.each(LOGGERS)('lets %s through', async (role) => {
        expect((await call.send(role)).status).toBe(call.status);
        expect(logService[call.service]).toHaveBeenCalledTimes(1);
      });

      it.each(ROLES.filter((r) => !LOGGERS.includes(r)))('refuses %s with 403, before any service runs', async (role) => {
        expect((await call.send(role)).status).toBe(403);
        expect(logService[call.service]).not.toHaveBeenCalled();
      });
    });
  }

  it('is 401 with no token', async () => {
    expect((await request(app).get('/items')).status).toBe(401);
    expect((await request(app).post('/').send(body)).status).toBe(401);
  });
});

describe('what the service is handed', () => {
  it('W2: 200 with replayed:true when the key was used before', async () => {
    vi.mocked(logService.log).mockResolvedValue({ result: { entries: [], replayed: true }, replayed: true });
    const res = await request(app).post('/').set(as('STORE_ATTENDANT')).send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { entries: [], replayed: true } });
  });

  it('W1: the search and limit reach the service, limit defaults to 20', async () => {
    await request(app).get('/items?search=milk').set(as('STORE_ATTENDANT'));
    expect(logService.listItems).toHaveBeenCalledWith(expect.anything(), { search: 'milk', limit: 20 });
  });
});

describe('validation', () => {
  const attendant = as('STORE_ATTENDANT');

  it('W2: refuses an empty batch, a zero quantity, an unknown reason, a short key and unknown keys', async () => {
    expect((await request(app).post('/').set(attendant).send({ ...body, entries: [] })).status).toBe(400);
    expect((await request(app).post('/').set(attendant).send({ ...body, entries: [{ inventoryItemId: ITEM, quantity: '0', reason: 'EXPIRY' }] })).status).toBe(400);
    expect((await request(app).post('/').set(attendant).send({ ...body, entries: [{ inventoryItemId: ITEM, quantity: '1', reason: 'BORED' }] })).status).toBe(400);
    expect((await request(app).post('/').set(attendant).send({ ...body, idempotencyKey: 'short' })).status).toBe(400);
    expect((await request(app).post('/').set(attendant).send({ ...body, locationId: ITEM })).status).toBe(400);
    expect(logService.log).not.toHaveBeenCalled();
  });
});
