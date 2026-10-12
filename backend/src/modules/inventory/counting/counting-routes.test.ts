/**
 * The whole Counting router (print, record, review, counts, setup, settings, mounted as in routes/index.ts) with every service
 * mocked: the §3.1 role-by-endpoint grid for all 30 endpoints with the six roles, route ORDER (the literal paths win over
 * `GET /counts/:id`), and a request with no token. The per-folder route tests cover validation.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../middleware/error-handler';
import countingRoutes from './counting-routes';
import { countsService } from './counts/counts-service';
import { printService } from './print/print-service';
import { recordService } from './record/record-service';
import { reviewService } from './review/review-service';
import { settingsService } from './settings/settings-service';
import { setupService } from './setup/setup-service';

vi.mock('../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    else throw Object.assign(new Error('Missing or invalid authorization header'), { statusCode: 401, code: 'AUTHENTICATION_ERROR' });
    next();
  },
}));
vi.mock('./counts/counts-service', () => ({ countsService: { summary: vi.fn(), list: vi.fn(), flagged: vi.fn(), repeatShortfalls: vi.fn(), detail: vi.fn(), home: vi.fn(), mine: vi.fn() } }));
vi.mock('./print/print-service', () => ({ printService: { record: vi.fn(), blankSheet: vi.fn() } }));
vi.mock('./record/record-service', () => ({ recordService: { startOptions: vi.fn(), start: vi.fn(), saveLines: vi.fn(), check: vi.fn(), signPreview: vi.fn(), sign: vi.fn(), setSectionOrder: vi.fn() } }));
vi.mock('./review/review-service', () => ({ reviewService: { decide: vi.fn(), approvePreview: vi.fn(), approve: vi.fn(), markSeen: vi.fn() } }));
vi.mock('./settings/settings-service', () => ({ settingsService: { get: vi.fn(), preview: vi.fn(), updateRange: vi.fn(), updateDirectorAlert: vi.fn() } }));
vi.mock('./setup/setup-service', () => ({ setupService: { view: vi.fn(), sectionItems: vi.fn(), addSection: vi.fn(), saveLayout: vi.fn(), addableItems: vi.fn(), addItems: vi.fn(), moveItem: vi.fn(), undoMove: vi.fn() } }));

const app = express().use(express.json()).use('/api/v1', countingRoutes).use(errorHandler);
const base = '/api/v1/inventory/stock';
const as = (role: string) => ({ 'x-test-user': JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', role, siteId: null }) });

const COUNT = 'c0000000-0000-4000-8000-000000000001';
const LINE = 'a0000000-0000-4000-8000-000000000001';
const SECTION = '5e000000-0000-4000-8000-000000000001';
const ITEM = '10000000-0000-4000-8000-000000000001';
const MOVE = 'b0000000-0000-4000-8000-000000000001';
const KEY = 'idem-key-0001';

type Who = 'SM' | 'SA' | 'DIR' | 'ACC' | 'BM' | 'AT';
const ROLE: Record<Who, string> = { SM: 'STORE_MANAGER', SA: 'SYSTEM_ADMIN', DIR: 'DIRECTOR', ACC: 'ACCOUNTANT', BM: 'MANAGER', AT: 'STORE_ATTENDANT' };
const READERS: Who[] = ['SM', 'SA', 'DIR', 'ACC', 'BM'];

type Endpoint = { id: string; send: (h: Record<string, string>) => request.Test; allowed: Who[]; service: unknown; fn: string };
const e = (id: string, allowed: Who[], service: unknown, fn: string, send: Endpoint['send']): Endpoint => ({ id, allowed, service, fn, send });

const endpoints: Endpoint[] = [
  e('C1 GET /counts/summary', READERS, countsService, 'summary', (h) => request(app).get(`${base}/counts/summary`).set(h)),
  e('C2 GET /counts', READERS, countsService, 'list', (h) => request(app).get(`${base}/counts`).set(h)),
  e('C3 GET /counts/flagged', READERS, countsService, 'flagged', (h) => request(app).get(`${base}/counts/flagged`).set(h)),
  e('C4 GET /counts/repeat-shortfalls', READERS, countsService, 'repeatShortfalls', (h) => request(app).get(`${base}/counts/repeat-shortfalls`).set(h)),
  e('C5 GET /counts/:id', [...READERS, 'AT'], countsService, 'detail', (h) => request(app).get(`${base}/counts/${COUNT}`).set(h)),
  e('C6 GET /counts/:id/print', READERS, printService, 'record', (h) => request(app).get(`${base}/counts/${COUNT}/print`).set(h)),
  e('C7 GET /counts/blank-sheet', [...READERS, 'AT'], printService, 'blankSheet', (h) => request(app).get(`${base}/counts/blank-sheet`).set(h)),
  e('C8 GET /counts/start-options', ['SM', 'SA', 'AT'], recordService, 'startOptions', (h) => request(app).get(`${base}/counts/start-options`).set(h)),
  e('C9 POST /counts', ['SM', 'SA', 'AT'], recordService, 'start', (h) => request(app).post(`${base}/counts`).set(h).send({ sectionIds: [SECTION], idempotencyKey: KEY })),
  e('C10 PUT /counts/:id/lines', ['SM', 'SA', 'AT'], recordService, 'saveLines', (h) => request(app).put(`${base}/counts/${COUNT}/lines`).set(h).send({ lines: [{ lineId: LINE, countedQty: '1' }] })),
  e('C11 POST /counts/:id/check', ['SM', 'SA', 'AT'], recordService, 'check', (h) => request(app).post(`${base}/counts/${COUNT}/check`).set(h).send({})),
  e('C12 GET /counts/:id/sign-preview', ['SM', 'SA', 'AT'], recordService, 'signPreview', (h) => request(app).get(`${base}/counts/${COUNT}/sign-preview`).set(h)),
  e('C13 POST /counts/:id/sign', ['SM', 'SA', 'AT'], recordService, 'sign', (h) => request(app).post(`${base}/counts/${COUNT}/sign`).set(h).send({ pin: '1234', idempotencyKey: KEY })),
  e('C14 PUT /counts/section-order/today', ['SM', 'SA', 'AT'], recordService, 'setSectionOrder', (h) => request(app).put(`${base}/counts/section-order/today`).set(h).send({ sectionIds: [SECTION] })),
  e('C15 GET /count-setup', READERS, setupService, 'view', (h) => request(app).get(`${base}/count-setup`).set(h)),
  e('C16 GET /count-setup/sections/:id/items', READERS, setupService, 'sectionItems', (h) => request(app).get(`${base}/count-setup/sections/${SECTION}/items`).set(h)),
  e('C17 POST /count-setup/sections', ['SM', 'SA'], setupService, 'addSection', (h) => request(app).post(`${base}/count-setup/sections`).set(h).send({ name: 'Packaging' })),
  e('C18 PUT /count-setup/layout', ['SM', 'SA'], setupService, 'saveLayout', (h) => request(app).put(`${base}/count-setup/layout`).set(h).send({ version: 'v', sections: [{ id: SECTION, itemIds: [] }] })),
  e('C19 GET /count-setup/add-items', ['SM', 'SA'], setupService, 'addableItems', (h) => request(app).get(`${base}/count-setup/add-items?sectionId=${SECTION}`).set(h)),
  e('C20 POST /count-setup/sections/:id/items', ['SM', 'SA'], setupService, 'addItems', (h) => request(app).post(`${base}/count-setup/sections/${SECTION}/items`).set(h).send({ itemIds: [ITEM] })),
  e('C21 POST /count-setup/items/:itemId/move', ['SM', 'SA', 'AT'], setupService, 'moveItem', (h) => request(app).post(`${base}/count-setup/items/${ITEM}/move`).set(h).send({ toSectionId: SECTION })),
  e('C22 POST /count-setup/moves/:id/undo', ['SM', 'SA'], setupService, 'undoMove', (h) => request(app).post(`${base}/count-setup/moves/${MOVE}/undo`).set(h)),
  e('C23 GET /count-settings', READERS, settingsService, 'get', (h) => request(app).get(`${base}/count-settings`).set(h)),
  e('C24 GET /count-settings/preview', READERS, settingsService, 'preview', (h) => request(app).get(`${base}/count-settings/preview`).set(h)),
  e('C25 PUT /count-settings', ['SM', 'SA'], settingsService, 'updateRange', (h) => request(app).put(`${base}/count-settings`).set(h).send({ rangeKes: 500, rangePercent: '5', flagRepeatShortfalls: true })),
  e('C26 PUT /count-settings/director-alert', ['DIR', 'SA'], settingsService, 'updateDirectorAlert', (h) => request(app).put(`${base}/count-settings/director-alert`).set(h).send({ alertKes: 5000 })),
  e('C27 POST /counts/:id/decisions', ['SM', 'SA'], reviewService, 'decide', (h) => request(app).post(`${base}/counts/${COUNT}/decisions`).set(h).send({ lineIds: [LINE], decision: { kind: 'RECOUNT_ASKED' } })),
  e('C28 GET /counts/:id/approve-preview', ['SM', 'SA'], reviewService, 'approvePreview', (h) => request(app).get(`${base}/counts/${COUNT}/approve-preview`).set(h)),
  e('C29 POST /counts/:id/approve', ['SM', 'SA'], reviewService, 'approve', (h) => request(app).post(`${base}/counts/${COUNT}/approve`).set(h).send({ pin: '1234', idempotencyKey: KEY })),
  e('C30 POST /counts/seen', ['DIR', 'SA'], reviewService, 'markSeen', (h) => request(app).post(`${base}/counts/seen`).set(h).send({ lineIds: [LINE] })),
  e('C31 GET /counts/home', ['SM', 'SA', 'AT'], countsService, 'home', (h) => request(app).get(`${base}/counts/home`).set(h)),
  e('C32 GET /counts/mine', ['SM', 'SA', 'AT'], countsService, 'mine', (h) => request(app).get(`${base}/counts/mine`).set(h)),
];

const allServices = [countsService, printService, recordService, reviewService, settingsService, setupService] as unknown as Record<string, ReturnType<typeof vi.fn>>[];

beforeEach(() => {
  vi.resetAllMocks();
  for (const service of allServices) for (const fn of Object.values(service)) fn.mockResolvedValue({ detail: {}, replayed: false });
});

describe('every one of the 32 endpoints is in the grid', () => {
  it('C1 to C32, once each', () => {
    expect(endpoints.map((x) => Number(x.id.match(/^C(\d+)/)![1]))).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });
});

describe('§3.1 role by endpoint, six roles', () => {
  for (const ep of endpoints) {
    describe(ep.id, () => {
      for (const who of Object.keys(ROLE) as Who[]) {
        const allowed = ep.allowed.includes(who);
        it(`${who} ${allowed ? 'is let through' : 'gets 403 before any service runs'}`, async () => {
          const res = await ep.send(as(ROLE[who]));
          const fn = (ep.service as Record<string, ReturnType<typeof vi.fn>>)[ep.fn]!;
          if (allowed) {
            expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
            expect(fn).toHaveBeenCalledTimes(1);
          } else {
            expect(res.status).toBe(403);
            expect(fn).not.toHaveBeenCalled();
          }
        });
      }

      it('no token is 401', async () => {
        expect((await ep.send({})).status).toBe(401);
      });
    });
  }
});

describe('route order: literal paths beat GET /counts/:id', () => {
  const sm = as('STORE_MANAGER');
  it.each([
    ['summary', 'summary', countsService],
    ['home', 'home', countsService],
    ['mine', 'mine', countsService],
    ['flagged', 'flagged', countsService],
    ['repeat-shortfalls', 'repeatShortfalls', countsService],
    ['blank-sheet', 'blankSheet', printService],
    ['start-options', 'startOptions', recordService],
  ] as const)('GET /counts/%s reaches its own handler, not the count detail', async (path, fn, service) => {
    await request(app).get(`${base}/counts/${path}`).set(sm);
    expect((service as unknown as Record<string, ReturnType<typeof vi.fn>>)[fn]).toHaveBeenCalledTimes(1);
    expect(countsService.detail).not.toHaveBeenCalled();
  });

  it('a real count id still reaches the detail', async () => {
    await request(app).get(`${base}/counts/${COUNT}`).set(sm);
    expect(countsService.detail).toHaveBeenCalledTimes(1);
  });
});

describe('the Attendant reaches only their own count detail (the service decides which)', () => {
  it('C5 for an Attendant calls the service with their id', async () => {
    await request(app).get(`${base}/counts/${COUNT}`).set(as('STORE_ATTENDANT'));
    expect(countsService.detail).toHaveBeenCalledWith(expect.objectContaining({ role: 'STORE_ATTENDANT' }), COUNT);
  });
});
