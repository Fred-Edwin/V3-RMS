/**
 * The reverse route through a real express app: the §3.1 grid for six roles on W4, validation, and no token.
 * The service is mocked; the capability gate is the real one (the own-entry and same-day rule is the service's, tested there).
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler';
import { reverseService } from './reverse-service';
import reverseRouter from './reverse-routes';

vi.mock('../../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    else throw Object.assign(new Error('Missing or invalid authorization header'), { statusCode: 401, code: 'AUTHENTICATION_ERROR' });
    next();
  },
}));
vi.mock('./reverse-service', () => ({ reverseService: { reverse: vi.fn() } }));

const app = express().use(express.json()).use(reverseRouter).use(errorHandler);
const as = (role: string) => ({ 'x-test-user': JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', role, siteId: null }) });

const ENTRY = 'd0000000-0000-4000-8000-000000000001';
const ROLES = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_ATTENDANT'] as const;
const REVERSERS = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'STORE_ATTENDANT'];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(reverseService.reverse).mockResolvedValue({ id: ENTRY } as never);
});

describe('the role grid (§3.1): waste.reverse_any or waste.reverse_own', () => {
  it.each(REVERSERS)('lets %s through to the service rule', async (role) => {
    const res = await request(app).post(`/${ENTRY}/reverse`).set(as(role)).send({ reason: 'WRONG_ITEM' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { id: ENTRY } });
  });

  it.each(ROLES.filter((r) => !REVERSERS.includes(r)))('refuses %s with 403, before any service runs', async (role) => {
    expect((await request(app).post(`/${ENTRY}/reverse`).set(as(role)).send({ reason: 'WRONG_ITEM' })).status).toBe(403);
    expect(reverseService.reverse).not.toHaveBeenCalled();
  });

  it('is 401 with no token', async () => {
    expect((await request(app).post(`/${ENTRY}/reverse`).send({ reason: 'WRONG_ITEM' })).status).toBe(401);
  });
});

describe('validation and what the service is handed', () => {
  const manager = as('STORE_MANAGER');

  it('passes the reason and note through', async () => {
    await request(app).post(`/${ENTRY}/reverse`).set(manager).send({ reason: 'OTHER', note: 'Counted twice by mistake' });
    expect(reverseService.reverse).toHaveBeenCalledWith(expect.anything(), ENTRY, { reason: 'OTHER', note: 'Counted twice by mistake' });
  });

  it('refuses Other without a note, a missing reason, a PIN and a bad id', async () => {
    expect((await request(app).post(`/${ENTRY}/reverse`).set(manager).send({ reason: 'OTHER' })).status).toBe(400);
    expect((await request(app).post(`/${ENTRY}/reverse`).set(manager).send({})).status).toBe(400);
    expect((await request(app).post(`/${ENTRY}/reverse`).set(manager).send({ reason: 'WRONG_ITEM', pin: '1234' })).status).toBe(400);
    expect((await request(app).post('/not-a-uuid/reverse').set(manager).send({ reason: 'WRONG_ITEM' })).status).toBe(400);
    expect(reverseService.reverse).not.toHaveBeenCalled();
  });
});
