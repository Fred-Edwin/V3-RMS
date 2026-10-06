import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../utils/errors';
import { ZodError } from 'zod';

const mocks = vi.hoisted(() => ({ getEffective: vi.fn(), listVersions: vi.fn() }));
vi.mock('./rules-service', () => ({ rulesService: { getEffective: mocks.getEffective, listVersions: mocks.listVersions } }));
vi.mock('../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (!raw) throw new AppError(401, 'AUTHENTICATION_ERROR', 'Unauthorized');
    req.user = JSON.parse(raw);
    next();
  },
}));

import router from './rules-routes';

const app = express().use(router);
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) return void res.status(400).json({ success: false });
  if (err instanceof AppError) return void res.status(err.statusCode).json({ success: false, code: err.code });
  res.status(500).json({ success: false });
});

const as = (role: string, siteId: string | null = 's1') => JSON.stringify({ id: 'u1', role, siteId });
const SITE = '3f6b1f0e-0c2a-4a53-9a55-0d6a3b9f2b11';

beforeEach(() => {
  mocks.getEffective.mockReset().mockResolvedValue({ groups: [{ group: 'STATUTORY', locked: true }] });
  mocks.listVersions.mockReset().mockResolvedValue([]);
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

  it('passes an explicit date through', async () => {
    await request(app).get(`/workforce/rules/effective?siteId=${SITE}&date=2026-10-20`).set('x-test-user', as('DIRECTOR'));
    expect(mocks.getEffective).toHaveBeenCalledWith(expect.anything(), SITE, '2026-10-20');
  });

  it('400 for a bad uuid or a bad date', async () => {
    expect((await request(app).get('/workforce/rules/effective?siteId=nope').set('x-test-user', as('DIRECTOR'))).status).toBe(400);
    expect((await request(app).get(`/workforce/rules/effective?siteId=${SITE}&date=2026-02-30`).set('x-test-user', as('DIRECTOR'))).status).toBe(400);
    expect((await request(app).get(`/workforce/rules/effective?siteId=${SITE}&date=tomorrow`).set('x-test-user', as('DIRECTOR'))).status).toBe(400);
  });

  it('passes through the service’s 403 for a unit holder asking another site', async () => {
    mocks.getEffective.mockRejectedValueOnce(new AppError(403, 'AUTHORIZATION_ERROR', 'own branch only'));
    expect((await request(app).get(`/workforce/rules/effective?siteId=${SITE}`).set('x-test-user', as('MANAGER'))).status).toBe(403);
  });
});

describe('GET /workforce/rules/:group/versions', () => {
  it('401 and 403 as above', async () => {
    expect((await request(app).get('/workforce/rules/LATENESS/versions')).status).toBe(401);
    expect((await request(app).get('/workforce/rules/LATENESS/versions').set('x-test-user', as('CHEF'))).status).toBe(403);
  });

  it('200 for a known group; company versions when no site is given', async () => {
    const res = await request(app).get('/workforce/rules/LATENESS/versions').set('x-test-user', as('DIRECTOR'));
    expect(res.status).toBe(200);
    expect(mocks.listVersions).toHaveBeenCalledWith(expect.anything(), 'LATENESS', null);
  });

  it('passes a site through', async () => {
    await request(app).get(`/workforce/rules/OVERTIME/versions?siteId=${SITE}`).set('x-test-user', as('MANAGER'));
    expect(mocks.listVersions).toHaveBeenCalledWith(expect.anything(), 'OVERTIME', SITE);
  });

  it('404 for an unknown group, 400 for a bad site id', async () => {
    expect((await request(app).get('/workforce/rules/NOPE/versions').set('x-test-user', as('DIRECTOR'))).status).toBe(404);
    expect((await request(app).get('/workforce/rules/LATENESS/versions?siteId=x').set('x-test-user', as('DIRECTOR'))).status).toBe(400);
  });
});
