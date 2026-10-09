/**
 * The Discrepancies router: every route needs a signed-in caller and the access-table row of the contract, never a role list.
 * The service is mocked; this checks the gate, the Zod validation at the edge and that a literal path is never taken for an id.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../utils/errors';

const svc = vi.hoisted(() => ({ list: vi.fn(), getFile: vi.fn(), findingPreview: vi.fn(), recordFinding: vi.fn(), reverse: vi.fn() }));
vi.mock('./discrepancies-service', () => ({ discrepanciesService: svc }));
vi.mock('../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (!raw) return next(new AppError(401, 'AUTHENTICATION_ERROR', 'Unauthorized'));
    req.user = JSON.parse(raw);
    next();
  },
}));

import router from './discrepancies-routes';

const app = express()
  .use(express.json())
  .use('/inventory/discrepancies', router)
  .use((err: AppError, _req: Request, res: Response, _next: NextFunction) => res.status(err.statusCode ?? 500).json({ success: false, error: { code: err.code } }));

const as = (role: string) => JSON.stringify({ id: 'u1', role, siteId: null });
const ID = '11111111-1111-4111-8111-111111111111';
const KEY = 'abcdefgh-1';

beforeEach(() => {
  for (const fn of Object.values(svc)) fn.mockReset().mockResolvedValue({ replayed: false });
});

describe('access', () => {
  it('reads need only a signed-in caller (the service narrows by role); no caller is 401', async () => {
    for (const path of ['/inventory/discrepancies', `/inventory/discrepancies/${ID}`]) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await request(app).get(path).set('x-test-user', as('MANAGER'))).status).toBe(200);
    }
  });
  it('Q3 and Q4 need discrepancies.record: the Store Manager and the System Admin only', async () => {
    const body = { finding: 'LOST_OR_DAMAGED', pin: '4821', idempotencyKey: KEY };
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN']) {
      expect((await request(app).get(`/inventory/discrepancies/${ID}/finding-preview?finding=CANT_TELL`).set('x-test-user', as(role))).status, role).toBe(200);
      expect((await request(app).post(`/inventory/discrepancies/${ID}/findings`).set('x-test-user', as(role)).send(body)).status, role).toBe(201);
    }
    for (const role of ['DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_ATTENDANT', 'CHEF']) {
      expect((await request(app).get(`/inventory/discrepancies/${ID}/finding-preview?finding=CANT_TELL`).set('x-test-user', as(role))).status, role).toBe(403);
      expect((await request(app).post(`/inventory/discrepancies/${ID}/findings`).set('x-test-user', as(role)).send(body)).status, role).toBe(403);
    }
  });
  it('Q5 needs discrepancies.reverse', async () => {
    const body = { reason: 'The milk turned up', pin: '4821', idempotencyKey: KEY };
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN']) expect((await request(app).post(`/inventory/discrepancies/${ID}/reverse`).set('x-test-user', as(role)).send(body)).status, role).toBe(200);
    for (const role of ['DIRECTOR', 'MANAGER', 'STORE_ATTENDANT']) expect((await request(app).post(`/inventory/discrepancies/${ID}/reverse`).set('x-test-user', as(role)).send(body)).status, role).toBe(403);
  });
  it('a repeated key answers 200 with the first result, not 201', async () => {
    svc.recordFinding.mockResolvedValue({ replayed: true });
    const res = await request(app).post(`/inventory/discrepancies/${ID}/findings`).set('x-test-user', as('STORE_MANAGER')).send({ finding: 'CANT_TELL', pin: '4821', idempotencyKey: KEY });
    expect(res.status).toBe(200);
  });
});

describe('Zod at the edge', () => {
  const sm = as('STORE_MANAGER');
  it('a finding needs a known finding, a PIN, a key and nothing extra', async () => {
    for (const body of [{ pin: '4821', idempotencyKey: KEY }, { finding: 'BLAME', pin: '4821', idempotencyKey: KEY }, { finding: 'CANT_TELL', idempotencyKey: KEY }, { finding: 'CANT_TELL', pin: '4821' }, { finding: 'CANT_TELL', pin: '4821', idempotencyKey: KEY, extra: 1 }]) {
      expect((await request(app).post(`/inventory/discrepancies/${ID}/findings`).set('x-test-user', sm).send(body)).status).toBeGreaterThanOrEqual(400);
    }
    expect(svc.recordFinding).not.toHaveBeenCalled();
  });
  it('a reversal needs a reason of at least 3 characters, a PIN and a key', async () => {
    for (const body of [{ reason: 'x', pin: '4821', idempotencyKey: KEY }, { pin: '4821', idempotencyKey: KEY }, { reason: 'Found it', pin: '4821' }]) {
      expect((await request(app).post(`/inventory/discrepancies/${ID}/reverse`).set('x-test-user', sm).send(body)).status).toBeGreaterThanOrEqual(400);
    }
    expect(svc.reverse).not.toHaveBeenCalled();
  });
  it('the preview needs a finding; the list takes only the contract filters; an id that is not a uuid is not a discrepancy', async () => {
    expect((await request(app).get(`/inventory/discrepancies/${ID}/finding-preview`).set('x-test-user', sm)).status).toBeGreaterThanOrEqual(400);
    expect((await request(app).get('/inventory/discrepancies?tab=nope').set('x-test-user', sm)).status).toBeGreaterThanOrEqual(400);
    expect((await request(app).get('/inventory/discrepancies?tab=settled&pageSize=25').set('x-test-user', sm)).status).toBe(200);
    expect((await request(app).get('/inventory/discrepancies/not-a-uuid').set('x-test-user', sm)).status).toBe(404);
  });
});
