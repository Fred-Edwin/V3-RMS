/**
 * The Branch day router (contract §3.1, §4): every route needs a signed-in caller; the capability gate of the access table on each
 * reader and writer route (the head's routes are the department rule in the service, so the gate there is sign-in only); Zod at the
 * edge with strict bodies; a literal path is never taken for an id. The service is mocked; the department and branch rules are in
 * `branch-day-service.test.ts` and, against a real database, `branch-day.db.test.ts`.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../utils/errors';

const svc = vi.hoisted(() => ({
  home: vi.fn(),
  opening: vi.fn(),
  acceptOpening: vi.fn(),
  previewRecount: vi.fn(),
  recountOpening: vi.fn(),
  getCount: vi.fn(),
  saveCount: vi.fn(),
  signCount: vi.fn(),
  myHistory: vi.fn(),
  myDay: vi.fn(),
  today: vi.fn(),
  departmentFigures: vi.fn(),
  closeSummary: vi.fn(),
  closeDay: vi.fn(),
  history: vi.fn(),
  dayFile: vi.fn(),
  activity: vi.fn(),
  documents: vi.fn(),
  entries: vi.fn(),
  correctCount: vi.fn(),
  sheet: vi.fn(),
}));
vi.mock('./branch-day-service', () => ({ branchDayService: svc }));
vi.mock('../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (!raw) return next(new AppError(401, 'AUTHENTICATION_ERROR', 'Unauthorized'));
    req.user = JSON.parse(raw);
    next();
  },
}));

import router from './branch-day-routes';

const app = express()
  .use(express.json())
  .use('/inventory/branch-day', router)
  .use((err: AppError, _req: Request, res: Response, _next: NextFunction) => res.status(err.statusCode ?? 500).json({ success: false, error: { code: err.code } }));

const as = (role: string) => JSON.stringify({ id: 'u1', role, siteId: 's1' });
const ID = '11111111-1111-4111-8111-111111111111';
const DEPT = '22222222-2222-4222-8222-222222222222';
const ITEM = '33333333-3333-4333-8333-333333333333';
const KEY = 'abcdefgh-1';
const day = `/inventory/branch-day/days/${ID}`;

beforeEach(() => {
  for (const fn of Object.values(svc)) fn.mockReset().mockResolvedValue({ replayed: false });
});

type Method = 'get' | 'post' | 'put';
const body = { pin: '4821', idempotencyKey: KEY };
const correction = { departmentId: DEPT, itemId: ITEM, closingQty: '2', reason: 'COUNTED_WRONGLY', ...body };

/** One row per endpoint: its number, method and path, a valid body, and who passes the gate. */
const ENDPOINTS: { n: string; method: Method; path: string; send?: object; gate: 'SIGNED_IN' | 'READ' | 'CLOSE' | 'CORRECT' }[] = [
  { n: 'BD1', method: 'get', path: '/inventory/branch-day/home', gate: 'SIGNED_IN' },
  { n: 'BD2', method: 'get', path: '/inventory/branch-day/opening', gate: 'SIGNED_IN' },
  { n: 'BD3', method: 'post', path: '/inventory/branch-day/opening/accept', send: { idempotencyKey: KEY }, gate: 'SIGNED_IN' },
  { n: 'BD4', method: 'post', path: '/inventory/branch-day/opening/recount/preview', send: { lines: [{ itemId: ITEM, countedQty: '3' }] }, gate: 'SIGNED_IN' },
  { n: 'BD5', method: 'post', path: '/inventory/branch-day/opening/recount', send: { lines: [{ itemId: ITEM, countedQty: '3' }], ...body }, gate: 'SIGNED_IN' },
  { n: 'BD6', method: 'get', path: '/inventory/branch-day/count', gate: 'SIGNED_IN' },
  { n: 'BD7', method: 'put', path: '/inventory/branch-day/count', send: { lines: [{ itemId: ITEM, countedQty: '3' }] }, gate: 'SIGNED_IN' },
  { n: 'BD8', method: 'post', path: '/inventory/branch-day/count/sign', send: body, gate: 'SIGNED_IN' },
  { n: 'BD9', method: 'get', path: '/inventory/branch-day/mine/history', gate: 'SIGNED_IN' },
  { n: 'BD10', method: 'get', path: `/inventory/branch-day/mine/days/${ID}`, gate: 'SIGNED_IN' },
  { n: 'BD11', method: 'get', path: '/inventory/branch-day/today', gate: 'READ' },
  { n: 'BD12', method: 'get', path: `${day}/departments/${DEPT}`, gate: 'READ' },
  { n: 'BD13', method: 'get', path: `${day}/close-summary`, gate: 'CLOSE' },
  { n: 'BD14', method: 'post', path: `${day}/close`, send: body, gate: 'CLOSE' },
  { n: 'BD15', method: 'get', path: '/inventory/branch-day/history', gate: 'READ' },
  { n: 'BD16', method: 'get', path: day, gate: 'READ' },
  { n: 'BD17', method: 'get', path: `${day}/activity`, gate: 'READ' },
  { n: 'BD18', method: 'get', path: `${day}/documents`, gate: 'READ' },
  { n: 'BD19', method: 'get', path: `${day}/entries`, gate: 'READ' },
  { n: 'BD20', method: 'post', path: `${day}/corrections`, send: correction, gate: 'CORRECT' },
  { n: 'BD21', method: 'get', path: `${day}/sheet`, gate: 'READ' },
];

const ROLES = ['MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'STORE_MANAGER', 'SYSTEM_ADMIN', 'BARISTA', 'STORE_ATTENDANT'] as const;
/** Who passes each gate: the Branch Manager reads, closes and corrects their branch; the System Admin the same for any; the other desktop roles read. */
const PASSES: Record<'SIGNED_IN' | 'READ' | 'CLOSE' | 'CORRECT', readonly string[]> = {
  SIGNED_IN: ROLES,
  READ: ['MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'STORE_MANAGER', 'SYSTEM_ADMIN'],
  CLOSE: ['MANAGER', 'SYSTEM_ADMIN'],
  CORRECT: ['MANAGER', 'SYSTEM_ADMIN'],
};

const call = (e: (typeof ENDPOINTS)[number], user?: string) => {
  const req = request(app)[e.method](e.path);
  if (user) req.set('x-test-user', user);
  return e.send ? req.send(e.send) : req;
};

describe('all 21 endpoints are mounted', () => {
  it('the table covers BD1 to BD21', () => {
    expect(ENDPOINTS.map((e) => e.n)).toEqual(Array.from({ length: 21 }, (_, i) => `BD${i + 1}`));
  });
});

describe('every route needs a signed-in caller', () => {
  it.each(ENDPOINTS)('$n $method $path is 401 without a caller', async (e) => {
    expect((await call(e)).status).toBe(401);
  });
});

describe('the access grid, route by route (§3.1)', () => {
  for (const e of ENDPOINTS) {
    describe(`${e.n} ${e.method.toUpperCase()} (${e.gate})`, () => {
      it.each(ROLES)('%s', async (role) => {
        const res = await call(e, as(role));
        if (PASSES[e.gate].includes(role)) {
          expect(res.status, `${role} should pass`).toBeLessThan(300);
        } else {
          expect(res.status, `${role} should be refused`).toBe(403);
        }
      });
    });
  }
  it('a refused caller never reaches the service', async () => {
    const endpoint = (n: string) => {
      const found = ENDPOINTS.find((e) => e.n === n);
      if (!found) throw new Error(`No endpoint ${n}`);
      return found;
    };
    await call(endpoint('BD14'), as('DIRECTOR'));
    await call(endpoint('BD20'), as('ACCOUNTANT'));
    await call(endpoint('BD11'), as('BARISTA'));
    expect(svc.closeDay).not.toHaveBeenCalled();
    expect(svc.correctCount).not.toHaveBeenCalled();
    expect(svc.today).not.toHaveBeenCalled();
  });
});

describe('Zod at the edge', () => {
  const post = (path: string, payload: object, role = 'BARISTA') => request(app).post(path).set('x-test-user', as(role)).send(payload);

  it('every signing body is strict: a PIN of four digits, a key, and nothing extra', async () => {
    const paths = ['/inventory/branch-day/count/sign', `${day}/close`];
    for (const path of paths) {
      const role = path.endsWith('/close') ? 'MANAGER' : 'BARISTA';
      expect((await post(path, body, role)).status).toBeLessThan(300);
      for (const bad of [{ idempotencyKey: KEY }, { pin: '4821' }, { pin: '482', idempotencyKey: KEY }, { pin: 'abcd', idempotencyKey: KEY }, { ...body, extra: 1 }, { pin: '4821', idempotencyKey: 'short' }]) {
        expect((await post(path, bad, role)).status, JSON.stringify(bad)).toBeGreaterThanOrEqual(400);
      }
    }
  });

  it('accepting an opening takes a key and no PIN', async () => {
    expect((await post('/inventory/branch-day/opening/accept', { idempotencyKey: KEY })).status).toBe(201);
    for (const bad of [{}, { idempotencyKey: KEY, pin: '4821' }, { idempotencyKey: 'short' }]) {
      expect((await post('/inventory/branch-day/opening/accept', bad)).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('a replayed signing answers 200 with the first result, a first one 201', async () => {
    svc.signCount.mockResolvedValue({ replayed: true });
    expect((await post('/inventory/branch-day/count/sign', body)).status).toBe(200);
    svc.signCount.mockResolvedValue({ replayed: false });
    expect((await post('/inventory/branch-day/count/sign', body)).status).toBe(201);
  });

  it('a recount lists counted figures (0 is a count), at least one line, no negative, nothing extra', async () => {
    const path = '/inventory/branch-day/opening/recount';
    expect((await post(path, { lines: [{ itemId: ITEM, countedQty: '0' }], ...body })).status).toBe(201);
    for (const lines of [[], [{ itemId: ITEM, countedQty: '-1' }], [{ itemId: ITEM }], [{ itemId: 'nope', countedQty: '1' }]]) {
      expect((await post(path, { lines, ...body })).status).toBeGreaterThanOrEqual(400);
    }
    expect((await post(path, { lines: [{ itemId: ITEM, countedQty: '1' }], ...body, onBehalf: true })).status).toBeGreaterThanOrEqual(400);
  });

  it('a save may clear a figure with null, but a signing figure cannot be negative', async () => {
    const put = (lines: object[]) => request(app).put('/inventory/branch-day/count').set('x-test-user', as('BARISTA')).send({ lines });
    expect((await put([{ itemId: ITEM, countedQty: null }])).status).toBe(200);
    expect((await put([{ itemId: ITEM, countedQty: '2.5' }])).status).toBe(200);
    for (const lines of [[], [{ itemId: ITEM, countedQty: '-1' }], [{ itemId: ITEM }]]) expect((await put(lines)).status).toBeGreaterThanOrEqual(400);
  });

  it('a correction names a department, an item, a figure, one of three reasons and an optional note of at most 200 characters', async () => {
    const path = `${day}/corrections`;
    expect((await post(path, correction, 'MANAGER')).status).toBe(201);
    expect((await post(path, { ...correction, note: 'Counted the wrong shelf' }, 'MANAGER')).status).toBe(201);
    for (const bad of [
      { ...correction, reason: 'MISCOUNT' },
      { ...correction, closingQty: '-1' },
      { ...correction, note: 'x'.repeat(201) },
      { ...correction, departmentId: 'nope' },
      { ...correction, extra: 1 },
      { departmentId: DEPT, itemId: ITEM, closingQty: '2', ...body },
    ]) {
      expect((await post(path, bad, 'MANAGER')).status, JSON.stringify(bad)).toBeGreaterThanOrEqual(400);
    }
  });

  it('the lists take the contract filters only: pages of 25, 50 or 100, a known status, dates as YYYY-MM-DD', async () => {
    const get = (path: string, role = 'MANAGER') => request(app).get(path).set('x-test-user', as(role));
    expect((await get('/inventory/branch-day/history?status=CORRECTED&pageSize=25&from=2026-10-01&to=2026-10-10&q=DAY-NYR-0044')).status).toBe(200);
    for (const q of ['status=REOPENED', 'pageSize=40', 'page=0', 'from=10-10-2026']) expect((await get(`/inventory/branch-day/history?${q}`)).status, q).toBeGreaterThanOrEqual(400);
    expect((await get('/inventory/branch-day/mine/history?status=CLOSED', 'BARISTA')).status).toBe(200);
    expect((await get('/inventory/branch-day/mine/history?status=OPEN', 'BARISTA')).status).toBeGreaterThanOrEqual(400);
    expect((await get(`${day}/activity?limit=10`)).status).toBe(200);
    expect((await get(`${day}/activity?limit=0`)).status).toBeGreaterThanOrEqual(400);
    expect((await get(`${day}/sheet?version=2`)).status).toBe(200);
    expect((await get(`${day}/sheet?version=0`)).status).toBeGreaterThanOrEqual(400);
    expect((await get(`/inventory/branch-day/today?branchId=${ID}`)).status).toBe(200);
    expect((await get('/inventory/branch-day/today?branchId=nope')).status).toBeGreaterThanOrEqual(400);
  });
});

describe('a literal path is never taken for an id', () => {
  it('an id that is not a uuid is not a day', async () => {
    const get = (path: string) => request(app).get(path).set('x-test-user', as('MANAGER'));
    expect((await get('/inventory/branch-day/days/not-a-uuid')).status).toBe(404);
    expect((await get('/inventory/branch-day/days/not-a-uuid/sheet')).status).toBe(404);
    expect((await request(app).get('/inventory/branch-day/mine/days/not-a-uuid').set('x-test-user', as('BARISTA'))).status).toBe(404);
    expect(svc.dayFile).not.toHaveBeenCalled();
    expect(svc.sheet).not.toHaveBeenCalled();
    expect(svc.myDay).not.toHaveBeenCalled();
  });
  it('/today, /history and /home are literals, not days', async () => {
    await request(app).get('/inventory/branch-day/today').set('x-test-user', as('MANAGER'));
    await request(app).get('/inventory/branch-day/history').set('x-test-user', as('MANAGER'));
    await request(app).get('/inventory/branch-day/home').set('x-test-user', as('BARISTA'));
    expect(svc.today).toHaveBeenCalledTimes(1);
    expect(svc.history).toHaveBeenCalledTimes(1);
    expect(svc.home).toHaveBeenCalledTimes(1);
    expect(svc.dayFile).not.toHaveBeenCalled();
  });
  it('the old routes are gone: no reopen, no thresholds, no overview', async () => {
    const as_ = as('MANAGER');
    for (const [method, path] of [
      ['post', `${day}/reopen`],
      ['get', '/inventory/branch-day/thresholds'],
      ['get', `${day}/overview`],
      ['get', '/inventory/branch-day/document'],
    ] as const) {
      expect((await request(app)[method](path).set('x-test-user', as_)).status, path).toBe(404);
    }
  });
});
