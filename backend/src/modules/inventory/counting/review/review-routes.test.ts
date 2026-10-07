/** The review routes through a real express app: the §3.1 grid for six roles (C27 to C30), validation and no token. Service mocked. */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler';
import { reviewService } from './review-service';
import reviewRouter from './review-routes';

vi.mock('../../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    else throw Object.assign(new Error('Missing or invalid authorization header'), { statusCode: 401, code: 'AUTHENTICATION_ERROR' });
    next();
  },
}));
vi.mock('./review-service', () => ({ reviewService: { decide: vi.fn(), approvePreview: vi.fn(), approve: vi.fn(), markSeen: vi.fn() } }));

const app = express().use(express.json()).use(reviewRouter).use(errorHandler);
const as = (role: string) => ({ 'x-test-user': JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', role, siteId: null }) });
const COUNT = 'c0000000-0000-4000-8000-000000000001';
const LINE = 'a0000000-0000-4000-8000-000000000001';
const KEY = 'approve-key-3';

const ROLES = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_ATTENDANT'] as const;
const RESOLVERS = ['STORE_MANAGER', 'SYSTEM_ADMIN'];
const ACKNOWLEDGERS = ['DIRECTOR', 'SYSTEM_ADMIN'];

type Call = { name: string; send: (role: string) => request.Test; service: keyof typeof reviewService; allowed: readonly string[] };
const calls: Call[] = [
  { name: 'C27 POST /counts/:id/decisions', send: (r) => request(app).post(`/counts/${COUNT}/decisions`).set(as(r)).send({ lineIds: [LINE], decision: { kind: 'RECOUNT_ASKED' } }), service: 'decide', allowed: RESOLVERS },
  { name: 'C28 GET /counts/:id/approve-preview', send: (r) => request(app).get(`/counts/${COUNT}/approve-preview`).set(as(r)), service: 'approvePreview', allowed: RESOLVERS },
  { name: 'C29 POST /counts/:id/approve', send: (r) => request(app).post(`/counts/${COUNT}/approve`).set(as(r)).send({ pin: '1234', idempotencyKey: KEY }), service: 'approve', allowed: RESOLVERS },
  { name: 'C30 POST /counts/seen', send: (r) => request(app).post('/counts/seen').set(as(r)).send({ lineIds: [LINE] }), service: 'markSeen', allowed: ACKNOWLEDGERS },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(reviewService.approve).mockResolvedValue({ detail: {} as never, replayed: false });
  for (const n of ['decide', 'approvePreview', 'markSeen'] as const) (reviewService[n] as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
});

describe('the role grid (§3.1)', () => {
  for (const call of calls) {
    describe(call.name, () => {
      it.each(call.allowed)('lets %s through', async (role) => {
        expect((await call.send(role)).status).toBe(200);
        expect(reviewService[call.service]).toHaveBeenCalledTimes(1);
      });
      it.each(ROLES.filter((r) => !call.allowed.includes(r)))('refuses %s with 403, before any service runs', async (role) => {
        expect((await call.send(role)).status).toBe(403);
        expect(reviewService[call.service]).not.toHaveBeenCalled();
      });
    });
  }

  it('is 401 with no token', async () => {
    expect((await request(app).post(`/counts/${COUNT}/decisions`).send({})).status).toBe(401);
    expect((await request(app).get(`/counts/${COUNT}/approve-preview`)).status).toBe(401);
    expect((await request(app).post(`/counts/${COUNT}/approve`).send({})).status).toBe(401);
    expect((await request(app).post('/counts/seen').send({})).status).toBe(401);
  });
});

describe('validation and order', () => {
  const sm = as('STORE_MANAGER');
  it('C27: needs lines or a group (not both), a known decision, and a note for Other', async () => {
    const post = (b: object) => request(app).post(`/counts/${COUNT}/decisions`).set(sm).send(b);
    expect((await post({ decision: { kind: 'RECOUNT_ASKED' } })).status).toBe(400);
    expect((await post({ lineIds: [LINE], group: 'WITHIN_RANGE', decision: { kind: 'ACCEPTED' } })).status).toBe(400);
    expect((await post({ lineIds: [LINE], decision: { kind: 'WRITE_OFF', cause: 'OTHER' } })).status).toBe(400);
    expect((await post({ lineIds: [LINE], decision: { kind: 'SHRUG' } })).status).toBe(400);
    expect((await post({ group: 'WITHIN_RANGE', decision: { kind: 'ACCEPTED' } })).status).toBe(200);
    expect((await post({ lineIds: [LINE], decision: { kind: 'WRITE_OFF', cause: 'OTHER', note: 'Dropped' } })).status).toBe(200);
  });

  it('C29: the PIN is 4 to 8 digits and the key is required', async () => {
    const post = (b: object) => request(app).post(`/counts/${COUNT}/approve`).set(sm).send(b);
    expect((await post({ idempotencyKey: KEY })).status).toBe(400);
    expect((await post({ pin: '12', idempotencyKey: KEY })).status).toBe(400);
    expect((await post({ pin: '1234' })).status).toBe(400);
  });

  it('C29: a replayed approval says so', async () => {
    vi.mocked(reviewService.approve).mockResolvedValue({ detail: { id: COUNT } as never, replayed: true });
    expect((await request(app).post(`/counts/${COUNT}/approve`).set(sm).send({ pin: '1234', idempotencyKey: KEY })).body).toEqual({ success: true, data: { id: COUNT }, replayed: true });
  });

  it('C30: lineIds are uuids, and "seen" is not swallowed by /counts/:id', async () => {
    expect((await request(app).post('/counts/seen').set(as('DIRECTOR')).send({ lineIds: [] })).status).toBe(400);
    expect((await request(app).post('/counts/seen').set(as('DIRECTOR')).send({ lineIds: ['x'] })).status).toBe(400);
    await request(app).post('/counts/seen').set(as('DIRECTOR')).send({ lineIds: [LINE] });
    expect(reviewService.markSeen).toHaveBeenCalledTimes(1);
  });

  it('a count id that is not a uuid is 400', async () => {
    expect((await request(app).get('/counts/nope/approve-preview').set(sm)).status).toBe(400);
  });
});
