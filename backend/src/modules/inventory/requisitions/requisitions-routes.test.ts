/**
 * The rebuilt Requisitions router and the Departments router, mounted as in routes/index.ts, with every service mocked: the
 * role-by-endpoint grid (access rows plus the department rule), the Idempotency-Key header, the uuid ids (route order), and a request
 * with no token. Business rules are in the service tests.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../middleware/error-handler';
import departmentsRoutes from '../departments/departments-routes';
import { departmentsService } from '../departments/departments-service';
import requisitionsRoutes from './requisitions-routes';
import { requisitionsService } from './requisitions-service';
import { branchCodeService } from './requisitions-branch-code';
import { requisitionsListService } from './requisitions-list-service';

vi.mock('../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    else throw Object.assign(new Error('Missing or invalid authorization header'), { statusCode: 401, code: 'AUTHENTICATION_ERROR' });
    next();
  },
}));
vi.mock('./requisitions-service', () => ({
  requisitionsService: {
    getFile: vi.fn(), getSection: vi.fn(), getApproveSummary: vi.fn(), start: vi.fn(), saveLines: vi.fn(), sendSection: vi.fn(), recallSection: vi.fn(),
    setUrgent: vi.fn(), changeQuantity: vi.fn(), nudge: vi.fn(), skip: vi.fn(), approve: vi.fn(), cancel: vi.fn(), addAddition: vi.fn(), approveAddition: vi.fn(),
    getPrintData: vi.fn(),
  },
}));
vi.mock('./requisitions-list-service', () => ({
  requisitionsListService: { list: vi.fn(), badges: vi.fn(), home: vi.fn(), history: vi.fn(), activity: vi.fn(), documents: vi.fn() },
}));
vi.mock('./requisitions-branch-code', async (importOriginal) => ({ ...(await importOriginal<typeof import('./requisitions-branch-code')>()), branchCodeService: { set: vi.fn() } }));
vi.mock('../departments/departments-service', () => ({ departmentsService: { list: vi.fn(), add: vi.fn(), rename: vi.fn(), retire: vi.fn(), restore: vi.fn() } }));

const app = express().use(express.json()).use('/api/v1/inventory/requisitions', requisitionsRoutes).use('/api/v1/inventory/departments', departmentsRoutes).use(errorHandler);
const R = '/api/v1/inventory/requisitions';
const D = '/api/v1/inventory/departments';
const ID = 'a0000000-0000-4000-8000-000000000001';
const DEPT = 'd0000000-0000-4000-8000-000000000001';
const LINE = 'b0000000-0000-4000-8000-000000000001';
const ADD = 'c0000000-0000-4000-8000-000000000001';
const ITEM = '10000000-0000-4000-8000-000000000001';
const KEY = 'idem-key-0001';

type Who = 'SM' | 'SA' | 'DIR' | 'ACC' | 'BM' | 'AT' | 'HEAD' | 'MEMBER';
const USER: Record<Who, { role: string; isDepartmentHead?: boolean }> = {
  SM: { role: 'STORE_MANAGER' }, SA: { role: 'SYSTEM_ADMIN' }, DIR: { role: 'DIRECTOR' }, ACC: { role: 'ACCOUNTANT' }, BM: { role: 'MANAGER' },
  AT: { role: 'STORE_ATTENDANT' }, HEAD: { role: 'CHEF', isDepartmentHead: true }, MEMBER: { role: 'WAITER' },
};
const as = (who: Who) => ({ 'x-test-user': JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', siteId: null, ...USER[who] }) });

type Endpoint = { id: string; send: (h: Record<string, string>) => request.Test; allowed: Who[]; service: unknown; fn: string };
const e = (id: string, allowed: Who[], service: unknown, fn: string, send: Endpoint['send']): Endpoint => ({ id, allowed, service, fn, send });
const EVERYONE_WHO_READS: Who[] = ['SM', 'SA', 'DIR', 'ACC', 'BM', 'AT', 'HEAD']; // desktop roles and the Attendant read; a head by the department rule

const endpoints: Endpoint[] = [
  e('R1 GET /', EVERYONE_WHO_READS, requisitionsListService, 'list', (h) => request(app).get(R).set(h)),
  e('R2 GET /badges', EVERYONE_WHO_READS, requisitionsListService, 'badges', (h) => request(app).get(`${R}/badges`).set(h)),
  e('R4 GET /:id/activity', EVERYONE_WHO_READS, requisitionsListService, 'activity', (h) => request(app).get(`${R}/${ID}/activity`).set(h)),
  e('R5 GET /:id/documents', EVERYONE_WHO_READS, requisitionsListService, 'documents', (h) => request(app).get(`${R}/${ID}/documents`).set(h)),
  e('R6 GET /:id/print', ['SM', 'SA', 'DIR', 'ACC', 'BM', 'AT'], requisitionsService, 'getPrintData', (h) => request(app).get(`${R}/${ID}/print`).set(h)),
  e('R7 GET /home', ['HEAD'], requisitionsListService, 'home', (h) => request(app).get(`${R}/home`).set(h)),
  e('R9 GET /history/mine', ['HEAD'], requisitionsListService, 'history', (h) => request(app).get(`${R}/history/mine`).set(h)),
  e('PATCH /branches/:branchId/code', ['SA'], branchCodeService, 'set', (h) => request(app).patch(`${R}/branches/${DEPT}/code`).set(h).send({ code: 'nyr' })),
  e('R3 GET /:id', EVERYONE_WHO_READS, requisitionsService, 'getFile', (h) => request(app).get(`${R}/${ID}`).set(h)),
  e('R8 GET /:id/sections/:departmentId', [...EVERYONE_WHO_READS], requisitionsService, 'getSection', (h) => request(app).get(`${R}/${ID}/sections/${DEPT}`).set(h)),
  e('R10 GET /:id/approve-summary', ['SA', 'DIR', 'BM'], requisitionsService, 'getApproveSummary', (h) => request(app).get(`${R}/${ID}/approve-summary`).set(h)),
  e('R11 POST /', ['SA', 'BM', 'HEAD'], requisitionsService, 'start', (h) => request(app).post(R).set(h).send({ cycle: 'MORNING', idempotencyKey: KEY })),
  e('R12 PUT lines', ['SA', 'BM', 'HEAD'], requisitionsService, 'saveLines', (h) => request(app).put(`${R}/${ID}/sections/${DEPT}/lines`).set(h).send({ lines: [{ itemId: ITEM, requestedQty: '3' }] })),
  e('R13 POST send', ['SA', 'BM', 'HEAD'], requisitionsService, 'sendSection', (h) => request(app).post(`${R}/${ID}/sections/${DEPT}/send`).set({ ...h, 'Idempotency-Key': KEY }).send({ pin: '1234' })),
  e('R14 POST recall', ['HEAD'], requisitionsService, 'recallSection', (h) => request(app).post(`${R}/${ID}/sections/${DEPT}/recall`).set(h)),
  e('R15 PUT urgent', ['SA', 'BM', 'HEAD'], requisitionsService, 'setUrgent', (h) => request(app).put(`${R}/${ID}/urgent`).set(h).send({ urgent: true })),
  e('R16 PATCH line', ['SA', 'BM'], requisitionsService, 'changeQuantity', (h) => request(app).patch(`${R}/${ID}/lines/${LINE}`).set(h).send({ approvedQty: '2' })),
  e('R17 POST nudge', ['SA', 'BM'], requisitionsService, 'nudge', (h) => request(app).post(`${R}/${ID}/sections/${DEPT}/nudge`).set(h)),
  e('R18 POST skip', ['SA', 'BM'], requisitionsService, 'skip', (h) => request(app).post(`${R}/${ID}/skip`).set(h).send({ departmentIds: [DEPT] })),
  e('R19 POST approve', ['SA', 'DIR', 'BM'], requisitionsService, 'approve', (h) => request(app).post(`${R}/${ID}/approve`).set({ ...h, 'Idempotency-Key': KEY }).send({ pin: '1234' })),
  e('R20 POST cancel', ['SA', 'BM'], requisitionsService, 'cancel', (h) => request(app).post(`${R}/${ID}/cancel`).set({ ...h, 'Idempotency-Key': KEY }).send({ reason: 'Asked for the wrong cycle', pin: '1234' })),
  e('R21 POST additions', ['HEAD'], requisitionsService, 'addAddition', (h) => request(app).post(`${R}/${ID}/additions`).set({ ...h, 'Idempotency-Key': KEY }).send({ lines: [{ itemId: ITEM, requestedQty: '1' }], pin: '1234' })),
  e('R22 POST additions/:id/approve', ['SA', 'DIR', 'BM'], requisitionsService, 'approveAddition', (h) => request(app).post(`${R}/${ID}/additions/${ADD}/approve`).set({ ...h, 'Idempotency-Key': KEY }).send({ pin: '1234' })),
  e('R23 GET departments', ['SM', 'SA', 'DIR', 'ACC', 'BM'], departmentsService, 'list', (h) => request(app).get(D).set(h)),
  e('R24 POST departments', ['SA', 'BM'], departmentsService, 'add', (h) => request(app).post(D).set(h).send({ branchId: DEPT, name: 'Garden' })),
  e('R25 PATCH departments/:id', ['SA', 'BM'], departmentsService, 'rename', (h) => request(app).patch(`${D}/${DEPT}`).set(h).send({ name: 'Yard' })),
  e('R26 POST retire', ['SA', 'BM'], departmentsService, 'retire', (h) => request(app).post(`${D}/${DEPT}/retire`).set(h)),
  e('R26 POST restore', ['SA', 'BM'], departmentsService, 'restore', (h) => request(app).post(`${D}/${DEPT}/restore`).set(h)),
];

beforeEach(() => {
  vi.clearAllMocks();
  for (const ep of endpoints) {
    const fn = (ep.service as Record<string, ReturnType<typeof vi.fn>>)[ep.fn];
    fn?.mockResolvedValue({ requisitionId: ID, replayed: false });
  }
});

const ALL: Who[] = ['SM', 'SA', 'DIR', 'ACC', 'BM', 'AT', 'HEAD', 'MEMBER'];

describe('role by endpoint (the access rows and the department rule)', () => {
  for (const ep of endpoints) {
    for (const who of ALL) {
      const allowed = ep.allowed.includes(who);
      it(`${ep.id}: ${who} is ${allowed ? 'let in' : 'refused'}`, async () => {
        const res = await ep.send(as(who));
        const fn = (ep.service as Record<string, ReturnType<typeof vi.fn>>)[ep.fn];
        if (allowed) {
          expect([200, 201]).toContain(res.status);
          expect(fn).toHaveBeenCalledTimes(1);
        } else {
          expect(res.status).toBe(403);
          expect(fn).not.toHaveBeenCalled();
        }
      });
    }
  }
});

describe('authentication, headers and ids', () => {
  it('every endpoint refuses a request with no token (401)', async () => {
    for (const ep of endpoints) expect((await ep.send({})).status).toBe(401);
  });

  it('the signing writes need an Idempotency-Key header (400 without it)', async () => {
    expect((await request(app).post(`${R}/${ID}/approve`).set(as('BM')).send({ pin: '1234' })).status).toBe(400);
    expect((await request(app).post(`${R}/${ID}/sections/${DEPT}/send`).set(as('HEAD')).send({ pin: '1234' })).status).toBe(400);
    expect(requisitionsService.approve).not.toHaveBeenCalled();
  });

  it('a body with an unknown key or a bad PIN is refused (Zod, strict)', async () => {
    expect((await request(app).post(`${R}/${ID}/approve`).set({ ...as('BM'), 'Idempotency-Key': KEY }).send({ pin: '12' })).status).toBe(400);
    expect((await request(app).post(`${R}/${ID}/approve`).set({ ...as('BM'), 'Idempotency-Key': KEY }).send({ pin: '1234', extra: 1 })).status).toBe(400);
  });

  it('a literal path is never taken for a requisition id', async () => {
    await request(app).get(`${R}/badges`).set(as('BM'));
    await request(app).get(`${R}/home`).set(as('HEAD'));
    await request(app).get(`${R}/history/mine`).set(as('HEAD'));
    expect(requisitionsService.getFile).not.toHaveBeenCalled();
    expect(requisitionsListService.badges).toHaveBeenCalledTimes(1);
    expect(requisitionsListService.home).toHaveBeenCalledTimes(1);
    expect(requisitionsListService.history).toHaveBeenCalledTimes(1);
  });

  it('R18 needs a non-empty list of departments, each once, and no unknown key', async () => {
    const skip = (body: object) => request(app).post(`${R}/${ID}/skip`).set(as('BM')).send(body);
    expect((await skip({})).status).toBe(400);
    expect((await skip({ departmentIds: [] })).status).toBe(400);
    expect((await skip({ departmentIds: [DEPT, DEPT] })).status).toBe(400);
    expect((await skip({ departmentIds: ['nope'] })).status).toBe(400);
    expect((await skip({ departmentIds: [DEPT], extra: 1 })).status).toBe(400);
    expect(requisitionsService.skip).not.toHaveBeenCalled();
  });

  it('the list query is validated (a bad tab or page size is a 400)', async () => {
    expect((await request(app).get(`${R}?tab=nonsense`).set(as('BM'))).status).toBe(400);
    expect((await request(app).get(`${R}?pageSize=7`).set(as('BM'))).status).toBe(400);
    expect((await request(app).get(`${R}?tab=to-approve&urgent=true&cycle=EXTRA&from=2026-10-01`).set(as('BM'))).status).toBe(200);
  });

  it('the branch code is three letters, upper-cased', async () => {
    expect((await request(app).patch(`${R}/branches/${DEPT}/code`).set(as('SA')).send({ code: 'toolong' })).status).toBe(400);
    expect((await request(app).patch(`${R}/branches/${DEPT}/code`).set(as('SA')).send({ code: 'kng' })).status).toBe(200);
    expect(branchCodeService.set).toHaveBeenLastCalledWith(expect.anything(), DEPT, { code: 'KNG' });
  });

  it('a repeated start answers 200, a first start 201', async () => {
    (requisitionsService.start as ReturnType<typeof vi.fn>).mockResolvedValue({ requisitionId: ID, replayed: true });
    expect((await request(app).post(R).set(as('BM')).send({ cycle: 'MORNING', idempotencyKey: KEY })).status).toBe(200);
  });
});
