/**
 * The Casual pay routes (Segment 3): 401 without a token, 403 without the capability, 400 for bad input, the success envelope.
 * Who records (a department head), who decides (a Branch or Store Manager, the Director), who only reads (HR, the Accountant).
 * Services are mocked; behaviour is in the unit tests and the database flow.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (!raw) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    req.user = JSON.parse(raw);
    next();
  },
}));
vi.mock('../people/employees/employees-repository', () => ({
  employeesRepository: { loadSubjectFacts: async () => ({ employeeId: null, tracksTime: null, headOfDepartmentIds: [] }) },
}));
const answer = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
const pdf = vi.hoisted(() => vi.fn(async () => ({ bytes: Buffer.from('%PDF-1.4 test'), number: 'CPS-0001' })));
vi.mock('./recording/recording-service', () => ({ addCasual: answer, putLines: answer, sendSheet: answer, takeBack: answer }));
vi.mock('./recording/correction-service', () => ({ addCorrection: answer, removeCorrection: answer }));
vi.mock('./approval/approval-service', () => ({ approveSheet: answer, sendBack: answer, voidSheet: answer }));
vi.mock('./approval/receipt-service', () => ({ receiveCash: answer }));
vi.mock('./sheet/sheet-service', () => ({ getDay: answer, getById: answer, listWorkers: answer, listRecent: answer, waiting: answer, monthSummary: answer }));
vi.mock('./sheet/sheet-document-service', () => ({ previewPdf: vi.fn(async () => Buffer.from('%PDF-1.4 draft')), documentPdf: pdf }));
vi.mock('../people/people-context', () => ({ resolveActor: async () => ({ companyId: 'c1' }) }));

import router from './casual-routes';

const app = express().use(express.json()).use(router);
app.use((err: { statusCode?: number; name?: string }, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.name === 'ZodError' ? 400 : (err.statusCode ?? 500)).json({ success: false });
});

const id = '0b8d3c6e-5f7a-4c1e-9d3a-2f4e6a8b0c12';
const as = (role: string) => JSON.stringify({ id: 'u1', role, siteId: id });
const C = '/workforce/casuals';
const key = 'request-key-0001';
const version = 1;

type Cap = 'record' | 'approve' | 'read' | 'payroll';
type Case = { method: 'get' | 'post' | 'put' | 'delete'; path: string; body?: object; cap: Cap };
const cases: Case[] = [
  { method: 'get', path: `${C}/sheets?siteId=${id}&departmentId=${id}&date=2026-10-19`, cap: 'read' },
  { method: 'put', path: `${C}/sheets/lines`, body: { siteId: id, departmentId: id, date: '2026-10-19', version: 0, idempotencyKey: key, lines: [{ casualId: id, start: '07:00', end: '15:00' }] }, cap: 'record' },
  { method: 'get', path: `${C}/sheets/waiting`, cap: 'approve' },
  { method: 'get', path: `${C}/sheets/recent?siteId=${id}`, cap: 'read' },
  { method: 'get', path: `${C}/sheets/${id}`, cap: 'read' },
  { method: 'get', path: `${C}/people?siteId=${id}&departmentId=${id}`, cap: 'read' },
  { method: 'post', path: `${C}/people`, body: { fullName: 'Peter Mwangi', nationalId: '31234567', nationalIdConfirm: '31234567', idempotencyKey: key }, cap: 'record' },
  { method: 'post', path: `${C}/sheets/${id}/send`, body: { version, idempotencyKey: key }, cap: 'record' },
  { method: 'post', path: `${C}/sheets/${id}/take-back`, body: { version, idempotencyKey: key }, cap: 'record' },
  { method: 'post', path: `${C}/sheets/${id}/approve`, body: { pin: '1234', version, expectedTotal: '1800.00', idempotencyKey: key }, cap: 'approve' },
  { method: 'post', path: `${C}/sheets/${id}/send-back`, body: { reason: 'Rose finished at six', version, idempotencyKey: key }, cap: 'approve' },
  { method: 'post', path: `${C}/sheets/${id}/void`, body: { reason: 'Recorded on the wrong day', pin: '1234', version, idempotencyKey: key }, cap: 'approve' },
  { method: 'post', path: `${C}/sheets/${id}/corrections`, body: { casualId: id, originalDate: '2026-10-12', amount: '-200', reason: 'Left an hour early', version, idempotencyKey: key }, cap: 'record' },
  { method: 'delete', path: `${C}/sheets/${id}/corrections/${id}`, body: { version, idempotencyKey: key }, cap: 'record' },
  { method: 'post', path: `${C}/sheets/${id}/lines/${id}/receive`, body: { name: 'Peter Mwangi', idempotencyKey: key }, cap: 'record' },
  { method: 'get', path: `${C}/sheets/${id}/preview`, cap: 'read' },
  { method: 'get', path: `${C}/sheets/${id}/document`, cap: 'read' },
  { method: 'get', path: `${C}/months/2026-09/summary`, cap: 'payroll' },
];

const ROLES = ['DEPARTMENT_HEAD', 'WAITER', 'BARISTA', 'MANAGER', 'STORE_MANAGER', 'HR_MANAGER', 'ACCOUNTANT', 'DIRECTOR', 'SYSTEM_ADMIN'] as const;
const ALLOWED: Record<Cap, readonly string[]> = {
  record: ['DEPARTMENT_HEAD'],
  approve: ['MANAGER', 'STORE_MANAGER', 'DIRECTOR'],
  read: ['DEPARTMENT_HEAD', 'MANAGER', 'STORE_MANAGER', 'HR_MANAGER', 'ACCOUNTANT', 'DIRECTOR'],
  payroll: ['HR_MANAGER', 'ACCOUNTANT', 'DIRECTOR', 'SYSTEM_ADMIN'],
};

const send = (c: Case, user?: string) => {
  const r = request(app)[c.method](c.path);
  if (user) r.set('x-test-user', user);
  return c.body ? r.send(c.body) : r;
};

describe('casual routes: the role matrix', () => {
  for (const c of cases) {
    it(`${c.method.toUpperCase()} ${c.path.replace(id, ':id').slice(0, 60)}: 401 without a token`, async () => {
      expect((await send(c)).status).toBe(401);
    });
    for (const role of ROLES) {
      const allowed = ALLOWED[c.cap].includes(role);
      it(`${c.method.toUpperCase()} ${c.path.replace(id, ':id').slice(0, 48)}: ${role} ${allowed ? 'is let in' : 'gets 403'}`, async () => {
        const res = await send(c, as(role));
        if (allowed) expect([200, 201]).toContain(res.status);
        else expect(res.status).toBe(403);
      });
    }
  }
});

describe('casual routes: input and answers', () => {
  const head = as('DEPARTMENT_HEAD');
  it('the success envelope', async () => {
    const res = await request(app).get(`${C}/sheets/waiting`).set('x-test-user', as('MANAGER'));
    expect(res.body).toEqual({ success: true, data: { ok: true } });
  });
  it('refuses a body with an unknown field, a bad time, a short key, a bad date, a two-digit PIN (400)', async () => {
    const put = (body: object) => request(app).put(`${C}/sheets/lines`).set('x-test-user', head).send(body);
    const ok = { siteId: id, departmentId: id, date: '2026-10-19', version: 0, idempotencyKey: key, lines: [] };
    expect((await put({ ...ok, extra: 1 })).status).toBe(400);
    expect((await put({ ...ok, lines: [{ casualId: id, start: '7am', end: '15:00' }] })).status).toBe(400);
    expect((await put({ ...ok, idempotencyKey: 'abc' })).status).toBe(400);
    expect((await put({ ...ok, date: '2026-13-45' })).status).toBe(400);
    expect((await request(app).post(`${C}/sheets/${id}/approve`).set('x-test-user', as('MANAGER')).send({ pin: '12', version, expectedTotal: '1.00', idempotencyKey: key })).status).toBe(400);
  });
  it('refuses two different ID numbers and a one-word name', async () => {
    const add = (body: object) => request(app).post(`${C}/people`).set('x-test-user', head).send(body);
    expect((await add({ fullName: 'Peter Mwangi', nationalId: '31234567', nationalIdConfirm: '31234568', idempotencyKey: key })).status).toBe(400);
    expect((await add({ fullName: 'Peter', nationalId: '31234567', nationalIdConfirm: '31234567', idempotencyKey: key })).status).toBe(400);
  });
  it('a correction must be whole shillings and not zero', async () => {
    const corr = (amount: string) => request(app).post(`${C}/sheets/${id}/corrections`).set('x-test-user', head).send({ casualId: id, originalDate: '2026-10-12', amount, reason: 'Left an hour early', version, idempotencyKey: key });
    expect((await corr('0')).status).toBe(400);
    expect((await corr('12.5')).status).toBe(400);
    expect((await corr('-200')).status).toBe(201);
  });
  it('the PDF routes send the file inline and never cached', async () => {
    const res = await request(app).get(`${C}/sheets/${id}/document`).set('x-test-user', as('MANAGER'));
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['content-disposition']).toBe('inline; filename="CPS-0001.pdf"');
  });
  it('a month that is not a month is 400', async () => {
    expect((await request(app).get(`${C}/months/2026-13/summary`).set('x-test-user', as('ACCOUNTANT'))).status).toBe(400);
  });
});
