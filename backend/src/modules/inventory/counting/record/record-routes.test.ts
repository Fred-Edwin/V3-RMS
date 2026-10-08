/**
 * The record routes through a real express app: the §3.1 grid for six roles on every endpoint (C8 to C14), validation, the
 * 200 / 201 on a replayed start, and no token. The service is mocked; the capability gate is the real one.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler';
import { recordService } from './record-service';
import recordRouter from './record-routes';

vi.mock('../../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    else throw Object.assign(new Error('Missing or invalid authorization header'), { statusCode: 401, code: 'AUTHENTICATION_ERROR' });
    next();
  },
}));
vi.mock('./record-service', () => ({
  recordService: { startOptions: vi.fn(), start: vi.fn(), saveLines: vi.fn(), check: vi.fn(), signPreview: vi.fn(), sign: vi.fn(), setSectionOrder: vi.fn() },
}));

const app = express().use(express.json()).use(recordRouter).use(errorHandler);
const as = (role: string) => ({ 'x-test-user': JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', role, siteId: null }) });

const COUNT = 'c0000000-0000-4000-8000-000000000001';
const LINE = 'a0000000-0000-4000-8000-000000000001';
const SECTION = '5e000000-0000-4000-8000-000000000001';
const KEY = 'idem-key-0001';

const ROLES = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_ATTENDANT'] as const;
const RECORDERS = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'STORE_ATTENDANT'];

type Call = { name: string; send: (role: string) => request.Test; service: keyof typeof recordService; status: number };
const calls: Call[] = [
  { name: 'C8 GET /counts/start-options', send: (r) => request(app).get('/counts/start-options').set(as(r)), service: 'startOptions', status: 200 },
  { name: 'C9 POST /counts', send: (r) => request(app).post('/counts').set(as(r)).send({ sectionIds: [SECTION], idempotencyKey: KEY }), service: 'start', status: 201 },
  { name: 'C10 PUT /counts/:id/lines', send: (r) => request(app).put(`/counts/${COUNT}/lines`).set(as(r)).send({ lines: [{ lineId: LINE, countedQty: '4' }] }), service: 'saveLines', status: 200 },
  { name: 'C11 POST /counts/:id/check', send: (r) => request(app).post(`/counts/${COUNT}/check`).set(as(r)).send({ sectionId: SECTION }), service: 'check', status: 200 },
  { name: 'C12 GET /counts/:id/sign-preview', send: (r) => request(app).get(`/counts/${COUNT}/sign-preview`).set(as(r)), service: 'signPreview', status: 200 },
  { name: 'C13 POST /counts/:id/sign', send: (r) => request(app).post(`/counts/${COUNT}/sign`).set(as(r)).send({ pin: '1234', idempotencyKey: KEY }), service: 'sign', status: 200 },
  { name: 'C14 PUT /counts/section-order/today', send: (r) => request(app).put('/counts/section-order/today').set(as(r)).send({ sectionIds: [SECTION] }), service: 'setSectionOrder', status: 200 },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(recordService.start).mockResolvedValue({ detail: {} as never, replayed: false });
  vi.mocked(recordService.sign).mockResolvedValue({ detail: {} as never, replayed: false });
  for (const name of ['startOptions', 'saveLines', 'check', 'signPreview', 'setSectionOrder'] as const) (recordService[name] as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
});

describe('the role grid (§3.1): counts.record', () => {
  for (const call of calls) {
    describe(call.name, () => {
      it.each(RECORDERS)('lets %s through', async (role) => {
        expect((await call.send(role)).status).toBe(call.status);
        expect(recordService[call.service]).toHaveBeenCalledTimes(1);
      });

      it.each(ROLES.filter((r) => !RECORDERS.includes(r)))('refuses %s with 403, before any service runs', async (role) => {
        expect((await call.send(role)).status).toBe(403);
        expect(recordService[call.service]).not.toHaveBeenCalled();
      });
    });
  }

  it('is 401 on every endpoint with no token', async () => {
    expect((await request(app).get('/counts/start-options')).status).toBe(401);
    expect((await request(app).post('/counts').send({})).status).toBe(401);
    expect((await request(app).put(`/counts/${COUNT}/lines`).send({})).status).toBe(401);
    expect((await request(app).post(`/counts/${COUNT}/check`).send({})).status).toBe(401);
    expect((await request(app).get(`/counts/${COUNT}/sign-preview`)).status).toBe(401);
    expect((await request(app).post(`/counts/${COUNT}/sign`).send({})).status).toBe(401);
    expect((await request(app).put('/counts/section-order/today').send({})).status).toBe(401);
  });
});

describe('what the service is handed', () => {
  it('C9: 200 with replayed:true when the key was used before', async () => {
    vi.mocked(recordService.start).mockResolvedValue({ detail: { id: COUNT } as never, replayed: true });
    const res = await request(app).post('/counts').set(as('STORE_ATTENDANT')).send({ sectionIds: [SECTION], idempotencyKey: KEY });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id: COUNT }, replayed: true });
  });

  it('C9: a count and a recount may name items and the line recounted', async () => {
    const res = await request(app).post('/counts').set(as('STORE_MANAGER')).send({ recountOfLineId: LINE, itemIds: [LINE], idempotencyKey: KEY });
    expect(res.status).toBe(201);
    expect(recordService.start).toHaveBeenCalledWith(expect.objectContaining({ role: 'STORE_MANAGER' }), { recountOfLineId: LINE, itemIds: [LINE], idempotencyKey: KEY });
  });

  it('C13: the PIN and the key reach the service, and a replayed sign says so', async () => {
    vi.mocked(recordService.sign).mockResolvedValue({ detail: { id: COUNT } as never, replayed: true });
    const res = await request(app).post(`/counts/${COUNT}/sign`).set(as('STORE_MANAGER')).send({ pin: '4821', idempotencyKey: KEY, causes: [{ lineId: LINE, cause: 'MISCOUNT' }] });
    expect(res.body).toMatchObject({ success: true, replayed: true });
    expect(recordService.sign).toHaveBeenCalledWith(expect.anything(), COUNT, { pin: '4821', idempotencyKey: KEY, causes: [{ lineId: LINE, cause: 'MISCOUNT' }] });
  });

  it('C10: a line without Skip is "not skipped"', async () => {
    await request(app).put(`/counts/${COUNT}/lines`).set(as('STORE_ATTENDANT')).send({ lines: [{ lineId: LINE, countedQty: '4' }, { lineId: LINE, countedQty: null, skipped: true }] });
    expect(recordService.saveLines).toHaveBeenCalledWith(expect.anything(), COUNT, { lines: [{ lineId: LINE, countedQty: '4', skipped: false }, { lineId: LINE, countedQty: null, skipped: true }] });
  });

  it('C11: the body may be empty (the whole count is checked)', async () => {
    expect((await request(app).post(`/counts/${COUNT}/check`).set(as('STORE_ATTENDANT')).send({})).status).toBe(200);
    expect(recordService.check).toHaveBeenCalledWith(expect.anything(), COUNT, {});
  });

  it('C8: a recount line id is passed through', async () => {
    await request(app).get(`/counts/start-options?recountLineId=${LINE}`).set(as('STORE_MANAGER'));
    expect(recordService.startOptions).toHaveBeenCalledWith(expect.anything(), { recountLineId: LINE });
  });
});

describe('validation', () => {
  const attendant = as('STORE_ATTENDANT');

  it('C9: needs a key of 8 to 64 characters, and something to count', async () => {
    expect((await request(app).post('/counts').set(attendant).send({ sectionIds: [SECTION] })).status).toBe(400);
    expect((await request(app).post('/counts').set(attendant).send({ sectionIds: [SECTION], idempotencyKey: 'short' })).status).toBe(400);
    expect((await request(app).post('/counts').set(attendant).send({ idempotencyKey: KEY })).status).toBe(400);
    expect((await request(app).post('/counts').set(attendant).send({ sectionIds: [], idempotencyKey: KEY })).status).toBe(400);
    expect((await request(app).post('/counts').set(attendant).send({ sectionIds: ['nope'], idempotencyKey: KEY })).status).toBe(400);
    expect((await request(app).post('/counts').set(attendant).send({ sectionIds: [SECTION], idempotencyKey: KEY, counterId: 'x' })).status).toBe(400);
    expect(recordService.start).not.toHaveBeenCalled();
  });

  it('C10: a negative number, a non-uuid line, no lines and a bad recheck are 400', async () => {
    const put = (body: object) => request(app).put(`/counts/${COUNT}/lines`).set(attendant).send(body);
    expect((await put({ lines: [{ lineId: LINE, countedQty: '-1' }] })).status).toBe(400);
    expect((await put({ lines: [{ lineId: 'nope', countedQty: '1' }] })).status).toBe(400);
    expect((await put({ lines: [] })).status).toBe(400);
    expect((await put({ lines: [{ lineId: LINE, countedQty: '1', recheck: 'MAYBE' }] })).status).toBe(400);
    expect((await put({ lines: [{ lineId: LINE, countedQty: 'abc' }] })).status).toBe(400);
    expect((await request(app).put('/counts/not-a-uuid/lines').set(attendant).send({ lines: [{ lineId: LINE, countedQty: '1' }] })).status).toBe(400);
    expect(recordService.saveLines).not.toHaveBeenCalled();
  });

  it('C13: the PIN is 4 to 8 digits and the key is required', async () => {
    const post = (body: object) => request(app).post(`/counts/${COUNT}/sign`).set(attendant).send(body);
    expect((await post({ idempotencyKey: KEY })).status).toBe(400);
    expect((await post({ pin: '12', idempotencyKey: KEY })).status).toBe(400);
    expect((await post({ pin: 'abcd', idempotencyKey: KEY })).status).toBe(400);
    expect((await post({ pin: '1234' })).status).toBe(400);
    expect((await post({ pin: '1234', idempotencyKey: KEY, causes: [{ lineId: LINE, cause: 'GREMLINS' }] })).status).toBe(400);
    expect(recordService.sign).not.toHaveBeenCalled();
  });

  it('C14: needs at least one uuid', async () => {
    expect((await request(app).put('/counts/section-order/today').set(attendant).send({ sectionIds: [] })).status).toBe(400);
    expect((await request(app).put('/counts/section-order/today').set(attendant).send({ sectionIds: ['nope'] })).status).toBe(400);
  });
});

describe('route order', () => {
  it('GET /counts/start-options is the start options (no /counts/:id route here shadows it)', async () => {
    await request(app).get('/counts/start-options').set(as('STORE_ATTENDANT'));
    expect(recordService.startOptions).toHaveBeenCalledTimes(1);
  });

  it('PUT /counts/section-order/today is the order, not a count id', async () => {
    await request(app).put('/counts/section-order/today').set(as('STORE_ATTENDANT')).send({ sectionIds: [SECTION] });
    expect(recordService.setSectionOrder).toHaveBeenCalledTimes(1);
    expect(recordService.saveLines).not.toHaveBeenCalled();
  });
});
