/**
 * The Slice 4 routes through a real express app, mounted in the same order as routes/index.ts (review before runs):
 * who gets through (the prep-access grid), that `/runs/export` and `/runs/summary` are not swallowed by `/runs/:id`,
 * and what the CSV response looks like on the wire. The services are mocked.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler';
import { runsService } from '../runs/runs-service';
import runsRouter from '../runs/runs-routes';
import { reviewService } from './review-service';
import reviewRouter from './review-routes';

vi.mock('../../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    next();
  },
}));
vi.mock('./review-service', () => ({ reviewService: { needsLook: vi.fn(), count: vi.fn(), review: vi.fn(), exportCsv: vi.fn() } }));
vi.mock('../runs/runs-service', () => ({ runsService: { list: vi.fn(), get: vi.fn(), summary: vi.fn() } }));

const app = express().use(express.json()).use(reviewRouter).use(runsRouter).use(errorHandler);
const as = (role: string) => JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', role, siteId: null });
const runId = '33333333-3333-4333-8333-333333333333';

const FLAG_READERS = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'DIRECTOR', 'MANAGER'];
const REVIEWERS = ['STORE_MANAGER', 'SYSTEM_ADMIN'];
const NEVER = ['STORE_ATTENDANT', 'WAITER', 'CHEF', 'BARISTA'];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(reviewService.needsLook).mockResolvedValue({ count: 0, items: [] });
  vi.mocked(reviewService.count).mockResolvedValue({ count: 3 });
  vi.mocked(reviewService.review).mockResolvedValue({} as never);
  vi.mocked(reviewService.exportCsv).mockResolvedValue({ fileName: 'prep-history-2026-10-01-2026-10-07.csv', csv: '﻿When,Run\r\n' });
  vi.mocked(runsService.summary).mockResolvedValue({ runsThisWeek: 1, runsToday: 1, needsLookCount: 3 });
  vi.mocked(runsService.get).mockResolvedValue({} as never);
});

describe('flag readers: #9, #14, #15, #17 need prep.read_flags', () => {
  const paths = ['/inventory/prep/runs/summary', '/inventory/prep/needs-a-look', '/inventory/prep/needs-a-look/count', '/inventory/prep/runs/export'];

  it.each(FLAG_READERS)('lets %s through every one', async (role) => {
    for (const path of paths) expect((await request(app).get(path).set('x-test-user', as(role))).status, path).toBe(200);
  });

  it.each(NEVER)('refuses %s with 403 on every one, before any service runs', async (role) => {
    for (const path of paths) expect((await request(app).get(path).set('x-test-user', as(role))).status, path).toBe(403);
    expect(reviewService.needsLook).not.toHaveBeenCalled();
    expect(reviewService.count).not.toHaveBeenCalled();
    expect(reviewService.exportCsv).not.toHaveBeenCalled();
    expect(runsService.summary).not.toHaveBeenCalled();
  });

  it('is 401 without a signed-in user', async () => {
    expect((await request(app).get('/inventory/prep/needs-a-look/count')).status).toBe(401);
  });
});

describe('POST /runs/:id/review (#16, prep.review)', () => {
  it.each(REVIEWERS)('lets %s review', async (role) => {
    const res = await request(app).post(`/inventory/prep/runs/${runId}/review`).set('x-test-user', as(role));
    expect(res.status).toBe(200);
    expect(reviewService.review).toHaveBeenCalledWith(expect.objectContaining({ role }), runId);
  });

  it.each(['ACCOUNTANT', 'DIRECTOR', 'MANAGER', ...NEVER])('refuses %s with 403', async (role) => {
    expect((await request(app).post(`/inventory/prep/runs/${runId}/review`).set('x-test-user', as(role))).status).toBe(403);
    expect(reviewService.review).not.toHaveBeenCalled();
  });

  it('is 400 for an id that is not a uuid', async () => {
    expect((await request(app).post('/inventory/prep/runs/nope/review').set('x-test-user', as('STORE_MANAGER'))).status).toBe(400);
  });
});

describe('route order: the literal paths win over /runs/:id', () => {
  it('GET /runs/export reaches the export, not the run detail', async () => {
    await request(app).get('/inventory/prep/runs/export').set('x-test-user', as('STORE_MANAGER'));
    expect(reviewService.exportCsv).toHaveBeenCalledTimes(1);
    expect(runsService.get).not.toHaveBeenCalled();
  });

  it('GET /runs/summary reaches the summary, not the run detail', async () => {
    const res = await request(app).get('/inventory/prep/runs/summary').set('x-test-user', as('STORE_MANAGER'));
    expect(res.body).toEqual({ success: true, data: { runsThisWeek: 1, runsToday: 1, needsLookCount: 3 } });
    expect(runsService.get).not.toHaveBeenCalled();
  });

  it('a real run id still reaches the run detail for the Attendant', async () => {
    expect((await request(app).get(`/inventory/prep/runs/${runId}`).set('x-test-user', as('STORE_ATTENDANT'))).status).toBe(200);
    expect(runsService.get).toHaveBeenCalledTimes(1);
  });
});

describe('GET /runs/export on the wire', () => {
  it('sends a UTF-8 CSV attachment with the file name, and passes the filters through', async () => {
    const res = await request(app).get('/inventory/prep/runs/export?status=CANCELLED&from=2026-10-01&to=2026-10-07').set('x-test-user', as('STORE_MANAGER'));
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe('attachment; filename="prep-history-2026-10-01-2026-10-07.csv"');
    expect(res.headers['access-control-expose-headers']).toBe('Content-Disposition');
    expect(res.text.startsWith('﻿')).toBe(true);
    expect(reviewService.exportCsv).toHaveBeenCalledWith(expect.anything(), { status: 'CANCELLED', from: '2026-10-01', to: '2026-10-07' });
  });

  it('is 400 for a bad date', async () => {
    expect((await request(app).get('/inventory/prep/runs/export?from=yesterday').set('x-test-user', as('STORE_MANAGER'))).status).toBe(400);
  });
});
