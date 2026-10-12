/**
 * The Deliveries router: sign-in is the gate (counting is a department rule in the service), Zod at the edge, photo limits at the
 * upload, and a literal path is never taken for an id. The service is mocked.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../utils/errors';

const svc = vi.hoisted(() => ({ list: vi.fn(), file: vi.fn(), getCount: vi.fn(), saveCount: vi.fn(), check: vi.fn(), setReason: vi.fn(), uploadPhoto: vi.fn(), deletePhoto: vi.fn(), readPhoto: vi.fn(), confirmPreview: vi.fn(), confirm: vi.fn() }));
vi.mock('./deliveries-service', () => ({ deliveriesService: svc }));
vi.mock('../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (!raw) return next(new AppError(401, 'AUTHENTICATION_ERROR', 'Unauthorized'));
    req.user = JSON.parse(raw);
    next();
  },
}));

import router from './deliveries-routes';

const app = express()
  .use(express.json())
  .use('/inventory/deliveries', router)
  .use((err: AppError, _req: Request, res: Response, _next: NextFunction) => res.status(err.statusCode ?? 500).json({ success: false, error: { code: err.code } }));

const user = JSON.stringify({ id: 'u1', role: 'BARISTA', siteId: 's1' });
const ID = '11111111-1111-4111-8111-111111111111';
const LINE = '22222222-2222-4222-8222-222222222222';
const PHOTO = '33333333-3333-4333-8333-333333333333';
const KEY = 'abcdefgh-1';
const base = `/inventory/deliveries/${ID}`;

beforeEach(() => {
  for (const fn of Object.values(svc)) fn.mockReset().mockResolvedValue({ replayed: false });
  svc.readPhoto.mockResolvedValue({ body: Buffer.from([1, 2, 3]), contentType: 'image/png' });
});

describe('every route needs a signed-in caller', () => {
  it.each([
    ['get', '/inventory/deliveries/mine'],
    ['get', base],
    ['get', `${base}/count`],
    ['put', `${base}/count`],
    ['post', `${base}/check`],
    ['put', `${base}/lines/${LINE}/reason`],
    ['post', `${base}/photos`],
    ['delete', `${base}/photos/${PHOTO}`],
    ['get', `${base}/confirm-preview`],
    ['post', `${base}/confirm`],
    ['get', `/inventory/deliveries/photos/${PHOTO}`],
  ] as const)('%s %s is 401 without a caller', async (method, path) => {
    expect((await request(app)[method](path)).status).toBe(401);
  });
});

describe('Zod at the edge', () => {
  it('a save needs lines with a count (0 is a count), not a negative or repeated line, and nothing extra', async () => {
    const put = (counts: object) => request(app).put(`${base}/count`).set('x-test-user', user).send({ counts });
    expect((await put([{ lineId: LINE, countedQty: '0' }])).status).toBe(200);
    for (const counts of [[], [{ lineId: LINE, countedQty: '-1' }], [{ lineId: LINE }], [{ lineId: LINE, countedQty: '1' }, { lineId: LINE, countedQty: '2' }], [{ lineId: LINE, countedQty: '1', sentQty: '5' }]]) {
      expect((await put(counts)).status).toBeGreaterThanOrEqual(400);
    }
    expect(svc.saveCount).toHaveBeenCalledTimes(1);
  });
  it('a reason is one of the four chips; a note is at most 200 characters', async () => {
    const put = (body: object) => request(app).put(`${base}/lines/${LINE}/reason`).set('x-test-user', user).send(body);
    expect((await put({ reason: 'DAMAGED' })).status).toBe(200);
    expect((await put({ reason: 'OTHER', note: 'Box was wet' })).status).toBe(200);
    for (const body of [{ reason: 'LOST' }, {}, { reason: 'OTHER', note: 'x'.repeat(201) }]) expect((await put(body)).status).toBeGreaterThanOrEqual(400);
  });
  it('a confirm needs a PIN and a key; onBehalf is optional', async () => {
    const post = (body: object) => request(app).post(`${base}/confirm`).set('x-test-user', user).send(body);
    expect((await post({ pin: '4821', idempotencyKey: KEY })).status).toBe(201);
    expect((await post({ pin: '4821', idempotencyKey: KEY, onBehalf: true })).status).toBe(201);
    for (const body of [{ pin: '4821' }, { idempotencyKey: KEY }, { pin: '12', idempotencyKey: KEY }, { pin: '4821', idempotencyKey: KEY, extra: 1 }]) expect((await post(body)).status).toBeGreaterThanOrEqual(400);
  });
  it('a repeated confirm key answers 200 with the first result', async () => {
    svc.confirm.mockResolvedValue({ replayed: true });
    expect((await request(app).post(`${base}/confirm`).set('x-test-user', user).send({ pin: '4821', idempotencyKey: KEY })).status).toBe(200);
  });
  it('the list takes the contract filters only', async () => {
    expect((await request(app).get('/inventory/deliveries/mine?tab=past&result=GAP_OPEN&pageSize=25').set('x-test-user', user)).status).toBe(200);
    expect((await request(app).get('/inventory/deliveries/mine?tab=nope').set('x-test-user', user)).status).toBeGreaterThanOrEqual(400);
    expect((await request(app).get('/inventory/deliveries/mine?result=NOPE').set('x-test-user', user)).status).toBeGreaterThanOrEqual(400);
  });
  it('V7: the delivery file is read by id, and only by a uuid', async () => {
    expect((await request(app).get(base).set('x-test-user', user)).status).toBe(200);
    expect(svc.file).toHaveBeenCalledTimes(1);
    expect((await request(app).get('/inventory/deliveries/not-a-uuid').set('x-test-user', user)).status).toBe(404);
    expect(svc.file).toHaveBeenCalledTimes(1);
  });
  it('an id that is not a uuid is not a delivery, and /mine is not taken for one', async () => {
    expect((await request(app).get('/inventory/deliveries/not-a-uuid/count').set('x-test-user', user)).status).toBe(404);
    expect(svc.list).not.toHaveBeenCalled();
    await request(app).get('/inventory/deliveries/mine').set('x-test-user', user);
    expect(svc.list).toHaveBeenCalledTimes(1);
    expect(svc.getCount).not.toHaveBeenCalled();
  });
});

describe('photos', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  it('uploads one file with a lineId field', async () => {
    const res = await request(app).post(`${base}/photos`).set('x-test-user', user).field('lineId', LINE).attach('file', png, 'a.png');
    expect(res.status).toBe(201);
    expect(svc.uploadPhoto).toHaveBeenCalledTimes(1);
  });
  it('a file over 5 MB is PHOTO_TOO_LARGE (413) and never reaches the service', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 10, 1);
    const res = await request(app).post(`${base}/photos`).set('x-test-user', user).field('lineId', LINE).attach('file', big, 'big.png');
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PHOTO_TOO_LARGE');
    expect(svc.uploadPhoto).not.toHaveBeenCalled();
  });
  it('a missing lineId is refused', async () => {
    const res = await request(app).post(`${base}/photos`).set('x-test-user', user).attach('file', png, 'a.png');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
  it('the authenticated link returns the bytes with the stored type, private, and nosniff', async () => {
    const res = await request(app).get(`/inventory/deliveries/photos/${PHOTO}`).set('x-test-user', user);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['cache-control']).toContain('private');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
