/**
 * The Dispatch and Carriers routers: every route needs a signed-in caller and the access-table row of the contract, never a role list.
 * The services are mocked; this checks the gate, the Zod validation at the edge and that a literal path is never taken for an id.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../utils/errors';

const svc = vi.hoisted(() => ({
  dispatch: { queue: vi.fn(), mine: vi.fn(), review: vi.fn(), sign: vi.fn(), getDepartment: vi.fn(), saveLines: vi.fn(), print: vi.fn(), cancel: vi.fn(), getFile: vi.fn() },
  carriers: { list: vi.fn(), add: vi.fn(), update: vi.fn() },
}));
vi.mock('./dispatch-service', () => ({ dispatchService: svc.dispatch }));
vi.mock('./carriers-service', () => ({ carriersService: svc.carriers }));
vi.mock('../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (!raw) return next(new AppError(401, 'AUTHENTICATION_ERROR', 'Unauthorized'));
    req.user = JSON.parse(raw);
    next();
  },
}));

import carriersRouter from './carriers-routes';
import dispatchRouter from './dispatch-routes';

const app = express()
  .use(express.json())
  .use('/inventory/dispatch', dispatchRouter)
  .use('/inventory/carriers', carriersRouter)
  .use((err: AppError, _req: Request, res: Response, _next: NextFunction) => res.status(err.statusCode ?? 500).json({ success: false, error: { code: err.code } }));

const as = (role: string) => JSON.stringify({ id: 'u1', role, siteId: null });
const ID = '11111111-1111-4111-8111-111111111111';
const REQ = '22222222-2222-4222-8222-222222222222';
const DEPT = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  for (const group of Object.values(svc)) for (const fn of Object.values(group)) fn.mockReset().mockResolvedValue({ replayed: false });
});

describe('access: dispatch routes', () => {
  const calls: Array<[string, string, string, string[], string[]]> = [
    // method, path, label, allowed roles, refused roles
    ['get', '/inventory/dispatch/queue', 'P1', ['STORE_ATTENDANT', 'STORE_MANAGER', 'SYSTEM_ADMIN'], ['MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'CHEF']],
    ['get', '/inventory/dispatch/mine', 'P9', ['STORE_ATTENDANT'], ['MANAGER', 'ACCOUNTANT']],
    ['get', `/inventory/dispatch/pack/${REQ}/review`, 'P4', ['STORE_ATTENDANT'], ['MANAGER']],
    ['get', `/inventory/dispatch/pack/${REQ}/departments/${DEPT}`, 'P2', ['STORE_ATTENDANT'], ['DIRECTOR']],
    ['get', `/inventory/dispatch/${ID}`, 'P6', ['STORE_ATTENDANT', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT'], ['CHEF', 'BARISTA']],
    ['get', `/inventory/dispatch/${ID}/print?copy=branch`, 'P7', ['MANAGER', 'STORE_MANAGER'], ['CHEF']],
  ];
  it.each(calls)('%s %s (%s)', async (method, path, _label, allowed, refused) => {
    for (const role of allowed) expect((await request(app)[method as 'get'](path).set('x-test-user', as(role))).status, `${role} allowed`).toBe(200);
    for (const role of refused) expect((await request(app)[method as 'get'](path).set('x-test-user', as(role))).status, `${role} refused`).toBe(403);
    expect((await request(app)[method as 'get'](path)).status).toBe(401);
  });

  it('only the Store Manager and the System Admin cancel (P8); the Attendant and the Branch Manager do not', async () => {
    const body = { reason: 'Vehicle did not leave', pin: '4821', idempotencyKey: 'abcdefgh-1' };
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN']) expect((await request(app).post(`/inventory/dispatch/${ID}/cancel`).set('x-test-user', as(role)).send(body)).status, role).toBe(200);
    for (const role of ['STORE_ATTENDANT', 'MANAGER', 'DIRECTOR']) expect((await request(app).post(`/inventory/dispatch/${ID}/cancel`).set('x-test-user', as(role)).send(body)).status, role).toBe(403);
  });

  it('the pack writes need dispatch.pack (P3, P5)', async () => {
    const save = { lines: [{ lineId: ID, sentQty: '1', packedTick: true }] };
    expect((await request(app).put(`/inventory/dispatch/pack/${REQ}/departments/${DEPT}/lines`).set('x-test-user', as('STORE_ATTENDANT')).send(save)).status).toBe(200);
    expect((await request(app).put(`/inventory/dispatch/pack/${REQ}/departments/${DEPT}/lines`).set('x-test-user', as('MANAGER')).send(save)).status).toBe(403);
    const sign = { carrierId: ID, pin: '4821', idempotencyKey: 'abcdefgh-1' };
    expect((await request(app).post(`/inventory/dispatch/pack/${REQ}/sign`).set('x-test-user', as('STORE_ATTENDANT')).send(sign)).status).toBe(201);
    expect((await request(app).post(`/inventory/dispatch/pack/${REQ}/sign`).set('x-test-user', as('DIRECTOR')).send(sign)).status).toBe(403);
  });
});

describe('Zod at the edge', () => {
  const att = as('STORE_ATTENDANT');
  it('a sign without a key, with a bad PIN or an unknown field is refused before the service runs', async () => {
    for (const body of [{ carrierId: ID, pin: '4821' }, { carrierId: ID, pin: '12', idempotencyKey: 'abcdefgh-1' }, { carrierId: ID, pin: '4821', idempotencyKey: 'abcdefgh-1', extra: 1 }, { carrierId: 'nope', pin: '4821', idempotencyKey: 'abcdefgh-1' }]) {
      const res = await request(app).post(`/inventory/dispatch/pack/${REQ}/sign`).set('x-test-user', att).send(body);
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
    expect(svc.dispatch.sign).not.toHaveBeenCalled();
  });
  it('a save with a negative quantity, a repeated line or no line is refused', async () => {
    const put = (lines: unknown) => request(app).put(`/inventory/dispatch/pack/${REQ}/departments/${DEPT}/lines`).set('x-test-user', att).send({ lines });
    for (const lines of [[{ lineId: ID, sentQty: '-1', packedTick: true }], [{ lineId: ID, sentQty: '1', packedTick: true }, { lineId: ID, sentQty: '2', packedTick: false }], []]) {
      expect((await put(lines)).status).toBeGreaterThanOrEqual(400);
    }
    expect(svc.dispatch.saveLines).not.toHaveBeenCalled();
  });
  it('a cancel reason must be a preset, and Other needs a note', async () => {
    const post = (reason: string) => request(app).post(`/inventory/dispatch/${ID}/cancel`).set('x-test-user', as('STORE_MANAGER')).send({ reason, pin: '4821', idempotencyKey: 'abcdefgh-1' });
    expect((await post('because')).status).toBeGreaterThanOrEqual(400);
    expect((await post('Other')).status).toBeGreaterThanOrEqual(400);
    expect((await post('Other — truck broke')).status).toBe(200);
    expect((await post('Branch asked us to stop')).status).toBe(200);
  });
  it('print needs copy=store|branch; an id that is not a uuid is not a dispatch', async () => {
    expect((await request(app).get(`/inventory/dispatch/${ID}/print`).set('x-test-user', att)).status).toBeGreaterThanOrEqual(400);
    expect((await request(app).get('/inventory/dispatch/not-a-uuid').set('x-test-user', att)).status).toBe(404);
  });
});

describe('access: carriers (P10)', () => {
  it('the five desktop roles read; only the Store Manager and the System Admin manage; the Attendant and heads do neither', async () => {
    for (const role of ['DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_MANAGER', 'SYSTEM_ADMIN']) expect((await request(app).get('/inventory/carriers').set('x-test-user', as(role))).status, role).toBe(200);
    for (const role of ['STORE_ATTENDANT', 'CHEF']) expect((await request(app).get('/inventory/carriers').set('x-test-user', as(role))).status, role).toBe(403);
    const add = { name: 'Wendo van', kind: 'VEHICLE' };
    for (const role of ['STORE_MANAGER', 'SYSTEM_ADMIN']) expect((await request(app).post('/inventory/carriers').set('x-test-user', as(role)).send(add)).status, role).toBe(201);
    for (const role of ['DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_ATTENDANT']) expect((await request(app).post('/inventory/carriers').set('x-test-user', as(role)).send(add)).status, role).toBe(403);
    expect((await request(app).patch(`/inventory/carriers/${ID}`).set('x-test-user', as('MANAGER')).send({ active: false })).status).toBe(403);
  });
  it('a carrier has a kind from the contract, a name of 2 to 80 characters, and one change at a time', async () => {
    const sm = as('STORE_MANAGER');
    for (const body of [{ name: 'x', kind: 'VEHICLE' }, { name: 'Wendo van', kind: 'BOAT' }, { name: 'Wendo van' }]) {
      expect((await request(app).post('/inventory/carriers').set('x-test-user', sm).send(body)).status).toBeGreaterThanOrEqual(400);
    }
    expect((await request(app).post('/inventory/carriers').set('x-test-user', sm).send({ name: 'Courier Co', kind: 'COMPANY' })).status).toBe(201);
    expect((await request(app).patch(`/inventory/carriers/${ID}`).set('x-test-user', sm).send({ name: 'New name', active: false })).status).toBeGreaterThanOrEqual(400);
    expect((await request(app).patch(`/inventory/carriers/${ID}`).set('x-test-user', sm).send({ active: false })).status).toBe(200);
  });
});
