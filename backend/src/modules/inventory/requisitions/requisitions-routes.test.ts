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
import requisitionsRoutes from './requisitions-rebuild-routes';
import { requisitionsService } from './requisitions-service';

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
  },
}));
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
  e('R18 POST skip', ['SA', 'BM'], requisitionsService, 'skip', (h) => request(app).post(`${R}/${ID}/sections/${DEPT}/skip`).set(h)),
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

  it('a path that is not a uuid is never taken for a requisition id (so back end B\'s literal paths win)', async () => {
    expect((await request(app).get(`${R}/badges`).set(as('BM'))).status).toBe(404);
    expect(requisitionsService.getFile).not.toHaveBeenCalled();
  });

  it('a repeated start answers 200, a first start 201', async () => {
    (requisitionsService.start as ReturnType<typeof vi.fn>).mockResolvedValue({ requisitionId: ID, replayed: true });
    expect((await request(app).post(R).set(as('BM')).send({ cycle: 'MORNING', idempotencyKey: KEY })).status).toBe(200);
  });
});
