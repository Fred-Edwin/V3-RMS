/**
 * The settings routes through a real express app: who gets through (contract §3.1, C23 to C26), and that a request with no
 * token is 401. The service is mocked; the capability gate is the real one.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler';
import { settingsService } from './settings-service';
import settingsRouter from './settings-routes';

vi.mock('../../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    else throw Object.assign(new Error('Missing or invalid authorization header'), { statusCode: 401, code: 'AUTHENTICATION_ERROR' });
    next();
  },
}));
vi.mock('./settings-service', () => ({ settingsService: { get: vi.fn(), preview: vi.fn(), updateRange: vi.fn(), updateDirectorAlert: vi.fn() } }));

const app = express().use(express.json()).use(settingsRouter).use(errorHandler);
const as = (role: string) => JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', role, siteId: null });

const ROLES = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_ATTENDANT'] as const;
const READERS = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER'];
const RANGE_WRITERS = ['STORE_MANAGER', 'SYSTEM_ADMIN'];
const ALERT_WRITERS = ['DIRECTOR', 'SYSTEM_ADMIN'];

const range = { rangeKes: 500, rangePercent: '5', flagRepeatShortfalls: true };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(settingsService.get).mockResolvedValue({ rangeKes: 500 } as never);
  vi.mocked(settingsService.preview).mockResolvedValue({ range: { withinRange: 0, outsideRange: 0, hint: null }, alert: { countsOver: 0, hint: null } });
  vi.mocked(settingsService.updateRange).mockResolvedValue({ rangeKes: 500 } as never);
  vi.mocked(settingsService.updateDirectorAlert).mockResolvedValue({ directorAlertKes: 8000 } as never);
});

describe('C23, C24 reads (counts.read)', () => {
  it.each(READERS)('lets %s read the settings and the preview', async (role) => {
    expect((await request(app).get('/count-settings').set('x-test-user', as(role))).status).toBe(200);
    expect((await request(app).get('/count-settings/preview?rangePercent=8').set('x-test-user', as(role))).status).toBe(200);
  });

  it('refuses the Store Attendant with 403 on both, before any service runs', async () => {
    expect((await request(app).get('/count-settings').set('x-test-user', as('STORE_ATTENDANT'))).status).toBe(403);
    expect((await request(app).get('/count-settings/preview').set('x-test-user', as('STORE_ATTENDANT'))).status).toBe(403);
    expect(settingsService.get).not.toHaveBeenCalled();
    expect(settingsService.preview).not.toHaveBeenCalled();
  });

  it('passes the proposed numbers to the preview, parsed', async () => {
    await request(app).get('/count-settings/preview?rangeKes=400&rangePercent=8&directorAlertKes=8000').set('x-test-user', as('STORE_MANAGER'));
    expect(settingsService.preview).toHaveBeenCalledWith(expect.objectContaining({ role: 'STORE_MANAGER' }), { rangeKes: 400, rangePercent: '8', directorAlertKes: 8000 });
  });

  it('is 400 for a preview number that is not one', async () => {
    expect((await request(app).get('/count-settings/preview?rangeKes=abc').set('x-test-user', as('STORE_MANAGER'))).status).toBe(400);
  });
});

describe('C25 PUT /count-settings (counts.setup)', () => {
  it.each(RANGE_WRITERS)('lets %s save the range', async (role) => {
    const res = await request(app).put('/count-settings').set('x-test-user', as(role)).send(range);
    expect(res.status).toBe(200);
    expect(settingsService.updateRange).toHaveBeenCalledWith(expect.objectContaining({ role }), range);
  });

  it.each(ROLES.filter((r) => !RANGE_WRITERS.includes(r)))('refuses %s with 403', async (role) => {
    expect((await request(app).put('/count-settings').set('x-test-user', as(role)).send(range)).status).toBe(403);
    expect(settingsService.updateRange).not.toHaveBeenCalled();
  });

  it('is 400 for a percent over 100, a missing field, or a field it does not know', async () => {
    const send = (body: object) => request(app).put('/count-settings').set('x-test-user', as('STORE_MANAGER')).send(body);
    expect((await send({ ...range, rangePercent: '150' })).status).toBe(400);
    expect((await send({ rangeKes: 500, rangePercent: '5' })).status).toBe(400);
    expect((await send({ ...range, directorAlertKes: 1 })).status).toBe(400);
  });
});

describe('C26 PUT /count-settings/director-alert (counts.set_director_alert)', () => {
  it.each(ALERT_WRITERS)('lets %s set the alert amount', async (role) => {
    const res = await request(app).put('/count-settings/director-alert').set('x-test-user', as(role)).send({ alertKes: 8000 });
    expect(res.status).toBe(200);
    expect(settingsService.updateDirectorAlert).toHaveBeenCalledWith(expect.objectContaining({ role }), { alertKes: 8000 });
  });

  it.each(ROLES.filter((r) => !ALERT_WRITERS.includes(r)))('refuses %s with 403 (the Store Manager cannot set the Director’s amount)', async (role) => {
    expect((await request(app).put('/count-settings/director-alert').set('x-test-user', as(role)).send({ alertKes: 8000 })).status).toBe(403);
    expect(settingsService.updateDirectorAlert).not.toHaveBeenCalled();
  });

  it('is 400 for a negative or missing amount', async () => {
    expect((await request(app).put('/count-settings/director-alert').set('x-test-user', as('DIRECTOR')).send({ alertKes: -1 })).status).toBe(400);
    expect((await request(app).put('/count-settings/director-alert').set('x-test-user', as('DIRECTOR')).send({})).status).toBe(400);
  });
});

describe('no token', () => {
  it('is 401 on every endpoint', async () => {
    expect((await request(app).get('/count-settings')).status).toBe(401);
    expect((await request(app).get('/count-settings/preview')).status).toBe(401);
    expect((await request(app).put('/count-settings').send(range)).status).toBe(401);
    expect((await request(app).put('/count-settings/director-alert').send({ alertKes: 1 })).status).toBe(401);
  });
});
