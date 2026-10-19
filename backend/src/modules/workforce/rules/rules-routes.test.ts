import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { AppError } from '../../../utils/errors';

const mocks = vi.hoisted(() => ({
  getEffective: vi.fn(),
  getRulesPage: vi.fn(),
  listHistory: vi.fn(),
  createVersion: vi.fn(),
  previewVersion: vi.fn(),
  withdrawVersion: vi.fn(),
  confirmVersion: vi.fn(),
}));
vi.mock('./resolve/effective-service', () => ({ getEffective: mocks.getEffective }));
vi.mock('./page/page-service', () => ({ getRulesPage: mocks.getRulesPage }));
vi.mock('./history/history-service', () => ({ listHistory: mocks.listHistory }));
vi.mock('./versions/versions-create', () => ({ createVersion: mocks.createVersion, requestOf: vi.fn() }));
vi.mock('./versions/versions-preview', () => ({ previewVersion: mocks.previewVersion }));
vi.mock('./versions/versions-withdraw', () => ({ withdrawVersion: mocks.withdrawVersion }));
vi.mock('./confirm/confirm-service', () => ({ confirmVersion: mocks.confirmVersion }));
vi.mock('../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (!raw) throw new AppError(401, 'AUTHENTICATION_ERROR', 'Unauthorized');
    req.user = JSON.parse(raw);
    next();
  },
}));

import router from './rules-routes';

const app = express().use(express.json()).use(router);
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) return void res.status(400).json({ success: false });
  if (err instanceof AppError) return void res.status(err.statusCode).json({ success: false, code: err.code });
  res.status(500).json({ success: false });
});

const as = (role: string, siteId: string | null = 's1') => JSON.stringify({ id: 'u1', role, siteId });
const SITE = '3f6b1f0e-0c2a-4a53-9a55-0d6a3b9f2b11';
const VERSION = '4b1e1f0e-0c2a-4a53-9a55-0d6a3b9f2b22';
const change = { effectiveFrom: '2026-11-01', values: { graceMinutes: 10 } };
const signed = { ...change, reason: 'Busier mornings', pin: '1234' };

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.getEffective.mockResolvedValue({ groups: [{ group: 'STATUTORY', locked: true }] });
  mocks.getRulesPage.mockResolvedValue({ group: 'LATENESS' });
  mocks.listHistory.mockResolvedValue({ items: [] });
  mocks.previewVersion.mockResolvedValue({ canSave: true });
  mocks.createVersion.mockResolvedValue({ version: { version: 3 }, notice: { recipients: [{ userId: 'secret-id', audience: 'HR' }] }, confirmed: [], waiting: [], replay: false });
  mocks.withdrawVersion.mockResolvedValue({ version: { version: 3 }, replay: false });
  mocks.confirmVersion.mockResolvedValue({ version: { version: 3 }, replay: false });
});

describe('GET /workforce/rules/effective', () => {
  it('401 without a token', async () => {
    expect((await request(app).get(`/workforce/rules/effective?siteId=${SITE}`)).status).toBe(401);
  });

  it('403 without rules.read', async () => {
    const res = await request(app).get(`/workforce/rules/effective?siteId=${SITE}`).set('x-test-user', as('WAITER'));
    expect(res.status).toBe(403);
    expect(mocks.getEffective).not.toHaveBeenCalled();
  });

  it('200 with the service result; the date defaults to today in Nairobi', async () => {
    const res = await request(app).get(`/workforce/rules/effective?siteId=${SITE}`).set('x-test-user', as('MANAGER'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { groups: [{ group: 'STATUTORY', locked: true }] } });
    expect(mocks.getEffective).toHaveBeenCalledWith(expect.objectContaining({ role: 'MANAGER' }), SITE, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('400 for a bad uuid or a bad date', async () => {
    expect((await request(app).get('/workforce/rules/effective?siteId=nope').set('x-test-user', as('DIRECTOR'))).status).toBe(400);
    expect((await request(app).get(`/workforce/rules/effective?siteId=${SITE}&date=2026-02-30`).set('x-test-user', as('DIRECTOR'))).status).toBe(400);
  });
});

describe('GET /workforce/rules/access-table and /:group', () => {
  it('the access table is answered by the generator, and is not mistaken for a group', async () => {
    const res = await request(app).get('/workforce/rules/access-table').set('x-test-user', as('HR_MANAGER'));
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(10);
    expect(mocks.getRulesPage).not.toHaveBeenCalled();
  });

  it('401 and 403 on the access table', async () => {
    expect((await request(app).get('/workforce/rules/access-table')).status).toBe(401);
    expect((await request(app).get('/workforce/rules/access-table').set('x-test-user', as('WAITER'))).status).toBe(403);
  });

  it('a tab for the viewer, with the site passed through', async () => {
    const res = await request(app).get(`/workforce/rules/LATENESS?siteId=${SITE}`).set('x-test-user', as('DIRECTOR'));
    expect(res.status).toBe(200);
    expect(mocks.getRulesPage).toHaveBeenCalledWith(expect.objectContaining({ role: 'DIRECTOR' }), 'LATENESS', SITE);
  });

  it('an unknown tab is a 404, a waiter is a 403, a bad site is a 400', async () => {
    expect((await request(app).get('/workforce/rules/NOPE').set('x-test-user', as('DIRECTOR'))).status).toBe(404);
    expect((await request(app).get('/workforce/rules/LATENESS').set('x-test-user', as('WAITER'))).status).toBe(403);
    expect((await request(app).get('/workforce/rules/LATENESS?siteId=x').set('x-test-user', as('DIRECTOR'))).status).toBe(400);
  });
});

describe('GET /workforce/rules/:group/versions', () => {
  it('pages with the table convention: 25 by default, 10 25 50 100 allowed', async () => {
    await request(app).get('/workforce/rules/LATENESS/versions').set('x-test-user', as('DIRECTOR'));
    expect(mocks.listHistory).toHaveBeenCalledWith(expect.anything(), 'LATENESS', { siteId: null, page: 1, pageSize: 25 });
    await request(app).get(`/workforce/rules/LATENESS/versions?siteId=${SITE}&page=2&pageSize=50`).set('x-test-user', as('DIRECTOR'));
    expect(mocks.listHistory).toHaveBeenLastCalledWith(expect.anything(), 'LATENESS', { siteId: SITE, page: 2, pageSize: 50 });
    expect((await request(app).get('/workforce/rules/LATENESS/versions?pageSize=7').set('x-test-user', as('DIRECTOR'))).status).toBe(400);
    expect((await request(app).get('/workforce/rules/LATENESS/versions?page=0').set('x-test-user', as('DIRECTOR'))).status).toBe(400);
  });

  it('a waiter is refused and an unknown tab is a 404', async () => {
    expect((await request(app).get('/workforce/rules/LATENESS/versions').set('x-test-user', as('WAITER'))).status).toBe(403);
    expect((await request(app).get('/workforce/rules/NOPE/versions').set('x-test-user', as('DIRECTOR'))).status).toBe(404);
  });
});

describe('POST /workforce/rules/:group/versions/preview', () => {
  it('needs an edit right: HR can open the preview for leave, a waiter and the Accountant on Lateness are stopped by the service not the route', async () => {
    expect((await request(app).post('/workforce/rules/LEAVE/versions/preview').set('x-test-user', as('HR_MANAGER')).send(change)).status).toBe(200);
    expect((await request(app).post('/workforce/rules/LATENESS/versions/preview').set('x-test-user', as('WAITER')).send(change)).status).toBe(403);
    expect((await request(app).post('/workforce/rules/LATENESS/versions/preview').send(change)).status).toBe(401);
  });

  it('refuses a malformed body: a bad date, an unknown key', async () => {
    expect((await request(app).post('/workforce/rules/LATENESS/versions/preview').set('x-test-user', as('DIRECTOR')).send({ ...change, effectiveFrom: '1 Nov' })).status).toBe(400);
    expect((await request(app).post('/workforce/rules/LATENESS/versions/preview').set('x-test-user', as('DIRECTOR')).send({ ...change, extra: 1 })).status).toBe(400);
    expect(mocks.previewVersion).not.toHaveBeenCalled();
  });
});

describe('POST /workforce/rules/:group/versions', () => {
  it('201 with the version, counts of who is told, and never the people', async () => {
    const res = await request(app).post('/workforce/rules/LATENESS/versions').set('x-test-user', as('DIRECTOR')).send(signed);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ version: { version: 3 }, notice: { told: [{ role: 'HR_MANAGER', count: 1 }] }, confirmed: [], waiting: [] });
    expect(JSON.stringify(res.body)).not.toContain('secret-id');
  });

  it('200 when the same request key had already made it', async () => {
    mocks.createVersion.mockResolvedValue({ version: { version: 3 }, notice: { recipients: [] }, confirmed: [], waiting: [], replay: true });
    expect((await request(app).post('/workforce/rules/LATENESS/versions').set('x-test-user', as('DIRECTOR')).send(signed)).status).toBe(200);
  });

  it('passes the Idempotency-Key header to the service', async () => {
    await request(app).post('/workforce/rules/LATENESS/versions').set('x-test-user', as('DIRECTOR')).set('Idempotency-Key', 'abcdefgh-1234').send(signed);
    expect(mocks.createVersion).toHaveBeenCalledWith(expect.anything(), 'LATENESS', expect.objectContaining({ idempotencyKey: 'abcdefgh-1234' }));
  });

  it('needs a reason and a four-digit PIN', async () => {
    for (const bad of [{ ...signed, reason: '' }, { ...signed, reason: 'x'.repeat(501) }, { ...signed, pin: '12' }, { ...signed, pin: 'abcd' }, { ...change }]) {
      expect((await request(app).post('/workforce/rules/LATENESS/versions').set('x-test-user', as('DIRECTOR')).send(bad)).status).toBe(400);
    }
    expect(mocks.createVersion).not.toHaveBeenCalled();
  });

  it('401 without a token, 403 for a waiter', async () => {
    expect((await request(app).post('/workforce/rules/LATENESS/versions').send(signed)).status).toBe(401);
    expect((await request(app).post('/workforce/rules/LATENESS/versions').set('x-test-user', as('WAITER')).send(signed)).status).toBe(403);
  });
});

describe('POST /workforce/rules/versions/:id/withdraw and /confirm', () => {
  it('withdraw: reason and PIN are required, a waiter is refused, a bad id is a 400', async () => {
    const send = (user: string, id: string, body: object) => request(app).post(`/workforce/rules/versions/${id}/withdraw`).set('x-test-user', as(user)).send(body);
    expect((await send('DIRECTOR', VERSION, { reason: 'Wrong day', pin: '1234' })).status).toBe(200);
    expect((await send('DIRECTOR', VERSION, { pin: '1234' })).status).toBe(400);
    expect((await send('WAITER', VERSION, { reason: 'x', pin: '1234' })).status).toBe(403);
    expect((await send('DIRECTOR', 'not-an-id', { reason: 'x', pin: '1234' })).status).toBe(400);
  });

  it('confirm: only a holder of a confirm right reaches the service; the scope and PIN are required', async () => {
    const send = (user: string, body: object) => request(app).post(`/workforce/rules/versions/${VERSION}/confirm`).set('x-test-user', as(user)).send(body);
    expect((await send('ACCOUNTANT', { scope: 'overtime.multipliers', pin: '1234' })).status).toBe(200);
    expect((await send('DIRECTOR', { scope: 'holidays.dates', pin: '1234' })).status).toBe(200);
    expect((await send('MANAGER', { scope: 'overtime.multipliers', pin: '1234' })).status).toBe(403);
    expect((await send('HR_MANAGER', { scope: 'overtime.multipliers', pin: '1234' })).status).toBe(403);
    expect((await send('ACCOUNTANT', { pin: '1234' })).status).toBe(400);
    expect((await send('ACCOUNTANT', { scope: 'overtime.multipliers' })).status).toBe(400);
  });
});
