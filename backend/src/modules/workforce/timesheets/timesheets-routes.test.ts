/**
 * The Timesheets routes (Segment 1A): 401 without a token, 403 without the capability, 400 for bad input, the success envelope,
 * and who reads, who decides, who approves the month and who exports. Services are mocked; behaviour is in the unit tests and
 * the database flows.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
const file = vi.hoisted(() => vi.fn(async () => ({ buffer: Buffer.from('%PDF-1.3'), filename: 'Timesheet-Nyeri-Town-2026-09.pdf', contentType: 'application/pdf', documentNumber: 'TSH-0009' })));
vi.mock('./months/months-service', () => ({ listMonths: answer, getMonth: answer, listPeople: answer }));
vi.mock('./months/people/person-month', () => ({ personDrawer: answer, personDays: answer }));
vi.mock('./approval/approve-service', () => ({ approveMonth: answer }));
vi.mock('./exports/exports-service', () => ({ exportMonth: file }));
vi.mock('./days/person-service', () => ({ dayDetail: answer }));
vi.mock('./days/decide-service', () => ({ decideDay: answer }));
vi.mock('./overtime/overtime-service', () => ({ listOvertime: answer, decideOvertime: answer }));
vi.mock('./overtime/overtime-detail-service', () => ({ overtimeDetail: answer }));
vi.mock('./overtime/overtime-note-service', () => ({ noteOvertime: answer }));
vi.mock('./requests/requests-service', () => ({ createRequest: answer, withdrawRequest: answer, myRequests: answer, requestDetail: answer, requestInbox: answer }));
vi.mock('./requests/request-decide-service', () => ({ decideRequest: answer }));
vi.mock('./me/me-service', () => ({ myTime: answer, myRota: answer }));

import router from './timesheets-routes';

const app = express().use(express.json()).use(router);
app.use((err: { statusCode?: number; name?: string }, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.name === 'ZodError' ? 400 : (err.statusCode ?? 500)).json({ success: false });
});

const id = '0b8d3c6e-5f7a-4c1e-9d3a-2f4e6a8b0c12';
const as = (role: string, extra: Record<string, unknown> = {}) => JSON.stringify({ id: 'u1', role, siteId: id, ...extra });
const T = '/workforce/timesheets';
const M = `${T}/months/2026-09`;
const at = '2026-10-09T14:00:00+03:00';
const key = 'approve-key-0001';

type Cap = 'time.own' | 'timesheet.read' | 'timesheet.approve' | 'overtime.approve' | 'timesheet.close' | 'timesheet.export' | 'overtime.note' | 'time_request.answer';
type Case = { method: 'get' | 'post'; path: string; body?: object; capability: Cap; status: number };
const cases: Case[] = [
  { method: 'get', path: `${T}/months?page=2&rows=5`, capability: 'timesheet.read', status: 200 },
  { method: 'get', path: `${M}?from=2026-09-07&to=2026-09-13`, capability: 'timesheet.read', status: 200 },
  { method: 'get', path: `${M}/people?view=needs&page=2&rows=10&sort=worked&dir=desc&q=ann`, capability: 'timesheet.read', status: 200 },
  { method: 'get', path: `${M}/people/${id}`, capability: 'timesheet.read', status: 200 },
  { method: 'get', path: `${M}/people/${id}/days?view=needs&page=1&rows=50`, capability: 'timesheet.read', status: 200 },
  { method: 'post', path: `${M}/approve`, body: { pin: '1234', idempotencyKey: key, expectedTotals: { workedMinutes: 100, overtimeAuthorisedMinutes: 0, headcount: 3 } }, capability: 'timesheet.close', status: 200 },
  { method: 'post', path: `${M}/exports`, body: { format: 'pdf', scope: 'month', idempotencyKey: key }, capability: 'timesheet.export', status: 200 },
  { method: 'get', path: `${T}/days/${id}`, capability: 'timesheet.read', status: 200 },
  { method: 'post', path: `${T}/days/${id}/decision`, body: { outcome: 'EXCUSE', reason: 'Bus broke down' }, capability: 'timesheet.approve', status: 200 },
  { method: 'get', path: `${T}/overtime?status=PENDING`, capability: 'timesheet.read', status: 200 },
  { method: 'get', path: `${T}/overtime/${id}`, capability: 'timesheet.read', status: 200 },
  { method: 'post', path: `${T}/overtime/${id}/decision`, body: { decision: 'APPROVE_PART', approvedMinutes: 20, reason: 'Only the rush', pin: '1234', version: 0 }, capability: 'overtime.approve', status: 200 },
  { method: 'post', path: `${T}/overtime/${id}/note`, body: { text: 'Saw it, no objection' }, capability: 'overtime.note', status: 200 },
  { method: 'get', path: `${T}/requests?state=WAITING`, capability: 'timesheet.read', status: 200 },
  { method: 'post', path: `${T}/requests/${id}/decision`, body: { outcome: 'DECLINE', reason: 'Not what the clock shows' }, capability: 'time_request.answer', status: 200 },
  { method: 'get', path: `${T}/me/requests`, capability: 'time.own', status: 200 },
  { method: 'post', path: `${T}/me/requests`, body: { kind: 'CLOCK_TIME_WRONG', date: '2026-10-09', type: 'OUT', at, note: 'I tapped out by accident' }, capability: 'time.own', status: 201 },
  { method: 'post', path: `${T}/me/requests/${id}/withdraw`, capability: 'time.own', status: 200 },
  { method: 'get', path: `${T}/me/time`, capability: 'time.own', status: 200 },
  { method: 'get', path: `${T}/me/rota?from=2026-10-12&to=2026-10-25`, capability: 'time.own', status: 200 },
];
const WITH: Record<Cap, string> = {
  'time.own': as('WAITER'),
  'timesheet.read': as('MANAGER'),
  'timesheet.approve': as('MANAGER'),
  'overtime.approve': as('MANAGER'),
  'timesheet.close': as('MANAGER'),
  'timesheet.export': as('ACCOUNTANT'),
  'overtime.note': as('WAITER', { isDepartmentHead: true }),
  'time_request.answer': as('HR_MANAGER'),
};
const WITHOUT: Record<Cap, string> = {
  'time.own': as('DIRECTOR'),
  'timesheet.read': as('WAITER'),
  'timesheet.approve': as('ACCOUNTANT'),
  'overtime.approve': as('HR_MANAGER'),
  'timesheet.close': as('HR_MANAGER'),
  'timesheet.export': as('WAITER'),
  'overtime.note': as('MANAGER'),
  'time_request.answer': as('ACCOUNTANT'),
};
const call = (c: Case, user?: string) => {
  const r = request(app)[c.method](c.path);
  return (user ? r.set('x-test-user', user) : r).send(c.body);
};

describe('Timesheets routes', () => {
  beforeEach(() => {
    answer.mockClear();
    file.mockClear();
  });

  it.each(cases)('$method $path: 401 without a token', async (c) => {
    expect((await call(c)).status).toBe(401);
  });
  it.each(cases)('$method $path: 403 without $capability', async (c) => {
    expect((await call(c, WITHOUT[c.capability])).status).toBe(403);
    expect(answer).not.toHaveBeenCalled();
    expect(file).not.toHaveBeenCalled();
  });
  it.each(cases.filter((c) => !c.path.endsWith('/exports')))('$method $path: answers in the envelope', async (c) => {
    const res = await call(c, WITH[c.capability]);
    expect(res.status).toBe(c.status);
    expect(res.body).toEqual({ success: true, data: { ok: true } });
  });

  it('the export answers with the file, its name and the document number', async () => {
    const res = await request(app).post(`${M}/exports`).set('x-test-user', as('MANAGER')).send({ format: 'pdf', idempotencyKey: key });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="Timesheet-Nyeri-Town-2026-09.pdf"');
    expect(res.headers['x-document-number']).toBe('TSH-0009');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('400 for bad bodies and queries, and nothing reaches a service', async () => {
    const mgr = as('MANAGER');
    const waiter = as('WAITER');
    const post = (path: string, user: string, body: object) => request(app).post(path).set('x-test-user', user).send(body);
    expect((await post(`${T}/days/${id}/decision`, mgr, { outcome: 'EXCUSE' })).status).toBe(400); // excusing needs a reason
    expect((await post(`${T}/overtime/${id}/decision`, mgr, { decision: 'DECLINE', pin: '1234', version: 0 })).status).toBe(400); // none needs a reason
    expect((await post(`${T}/overtime/${id}/decision`, mgr, { decision: 'APPROVE_PART', reason: 'Only the rush', pin: '1234', version: 0 })).status).toBe(400); // part needs minutes
    expect((await post(`${T}/overtime/${id}/decision`, mgr, { decision: 'APPROVE_ALL', approvedMinutes: 20, pin: '1234', version: 0 })).status).toBe(400); // minutes only for part
    expect((await post(`${T}/overtime/${id}/decision`, mgr, { decision: 'APPROVE_ALL', pin: '12', version: 0 })).status).toBe(400);
    expect((await post(`${T}/overtime/${id}/decision`, mgr, { decision: 'APPROVE_ALL', pin: '1234' })).status).toBe(400); // the version is required
    expect((await post(`${T}/overtime/${id}/note`, as('WAITER', { isDepartmentHead: true }), { text: 'x'.repeat(141) })).status).toBe(400);
    expect((await post(`${M}/approve`, mgr, { pin: '1234', idempotencyKey: 'short', expectedTotals: { workedMinutes: 1, overtimeAuthorisedMinutes: 0, headcount: 1 } })).status).toBe(400);
    expect((await post(`${M}/approve`, mgr, { pin: '1234', idempotencyKey: key })).status).toBe(400); // the figures the dialog showed are required
    expect((await post(`${M}/exports`, mgr, { format: 'csv', idempotencyKey: key })).status).toBe(400); // the CSV is gone
    expect((await post(`${M}/exports`, mgr, { format: 'pdf', scope: 'range', idempotencyKey: key })).status).toBe(400); // a range needs both ends
    expect((await post(`${M}/exports`, mgr, { format: 'pdf', scope: 'month', from: '2026-09-01', to: '2026-09-02', idempotencyKey: key })).status).toBe(400);
    expect((await post(`${T}/requests/${id}/decision`, as('HR_MANAGER'), { outcome: 'DECLINE' })).status).toBe(400);
    expect((await post(`${T}/me/requests`, waiter, { kind: 'CLOCK_TIME_WRONG', date: '2026-10-09', note: 'no time given' })).status).toBe(400);
    expect((await post(`${T}/me/requests`, waiter, { kind: 'SOMETHING', date: '2026-10-09', note: 'no such kind' })).status).toBe(400);
    expect((await request(app).get(`${T}/months/2026-13`).set('x-test-user', mgr)).status).toBe(400);
    expect((await request(app).get(`${T}/months/september`).set('x-test-user', mgr)).status).toBe(400);
    expect((await request(app).get(`${M}?from=2026-09-07`).set('x-test-user', mgr)).status).toBe(400); // both ends or neither
    expect((await request(app).get(`${M}?from=2026-09-13&to=2026-09-07`).set('x-test-user', mgr)).status).toBe(400);
    expect((await request(app).get(`${M}/people?page=0`).set('x-test-user', mgr)).status).toBe(400);
    expect((await request(app).get(`${M}/people?rows=500`).set('x-test-user', mgr)).status).toBe(400);
    expect((await request(app).get(`${M}/people/not-an-id`).set('x-test-user', mgr)).status).toBe(400);
    expect((await request(app).get(`${T}/months?rows=0`).set('x-test-user', mgr)).status).toBe(400);
    expect((await request(app).get(`${T}/me/rota?from=2026-10-12&to=2026-09-01`).set('x-test-user', waiter)).status).toBe(400);
    expect(answer).not.toHaveBeenCalled();
    expect(file).not.toHaveBeenCalled();
  });

  it('a request is read by its owner and by a reader in scope', async () => {
    expect((await request(app).get(`${T}/requests/${id}`).set('x-test-user', as('WAITER'))).status).toBe(200);
    expect((await request(app).get(`${T}/requests/${id}`).set('x-test-user', as('MANAGER'))).status).toBe(200);
  });

  it('the System Admin decides days and overtime like the Director (21 Oct 2026), but does not close a month', async () => {
    const user = as('SYSTEM_ADMIN');
    expect((await request(app).post(`${T}/days/${id}/decision`).set('x-test-user', user).send({ outcome: 'ACCEPT' })).status).toBe(200);
    expect((await request(app).post(`${T}/overtime/${id}/decision`).set('x-test-user', user).send({ decision: 'APPROVE_ALL', pin: '1234', version: 0 })).status).toBe(200);
    expect((await request(app).post(`${M}/approve`).set('x-test-user', user).send({ pin: '1234', idempotencyKey: key, expectedTotals: { workedMinutes: 1, overtimeAuthorisedMinutes: 0, headcount: 1 } })).status).toBe(403);
  });

  it('the Accountant and HR read timesheets and approve nothing', async () => {
    for (const role of ['ACCOUNTANT', 'HR_MANAGER']) {
      const user = as(role);
      expect((await request(app).get(`${T}/months`).set('x-test-user', user)).status).toBe(200);
      expect((await request(app).post(`${T}/days/${id}/decision`).set('x-test-user', user).send({ outcome: 'ACCEPT' })).status).toBe(403);
      expect((await request(app).post(`${T}/overtime/${id}/decision`).set('x-test-user', user).send({ decision: 'APPROVE_ALL', pin: '1234', version: 0 })).status).toBe(403);
      expect((await request(app).post(`${M}/approve`).set('x-test-user', user).send({ pin: '1234', idempotencyKey: key, expectedTotals: { workedMinutes: 1, overtimeAuthorisedMinutes: 0, headcount: 1 } })).status).toBe(403);
    }
  });

  it('HR, the Accountant, the managers, the Director and the System Admin export; a waiter does not', async () => {
    const body = { format: 'xlsx', idempotencyKey: key };
    for (const role of ['HR_MANAGER', 'ACCOUNTANT', 'MANAGER', 'STORE_MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN']) expect((await request(app).post(`${M}/exports`).set('x-test-user', as(role)).send(body)).status).toBe(200);
    for (const role of ['WAITER']) expect((await request(app).post(`${M}/exports`).set('x-test-user', as(role)).send(body)).status).toBe(403);
  });

  it('the Director approves a month (Head office) and decides a site manager\'s own days; nobody else at head level does', async () => {
    expect((await request(app).post(`${M}/approve`).set('x-test-user', as('DIRECTOR')).send({ pin: '1234', idempotencyKey: key, expectedTotals: { workedMinutes: 1, overtimeAuthorisedMinutes: 0, headcount: 1 } })).status).toBe(200);
    expect((await request(app).post(`${T}/days/${id}/decision`).set('x-test-user', as('DIRECTOR')).send({ outcome: 'ACCEPT' })).status).toBe(200);
    expect((await request(app).post(`${T}/overtime/${id}/decision`).set('x-test-user', as('DIRECTOR')).send({ decision: 'APPROVE_ALL', pin: '1234', version: 0 })).status).toBe(200);
  });

  it('a department head decides nothing and reads no timesheet, but leaves a note', async () => {
    const head = as('WAITER', { isDepartmentHead: true });
    expect((await request(app).get(`${T}/months`).set('x-test-user', head)).status).toBe(403);
    expect((await request(app).post(`${T}/days/${id}/decision`).set('x-test-user', head).send({ outcome: 'ACCEPT' })).status).toBe(403);
    expect((await request(app).post(`${T}/overtime/${id}/decision`).set('x-test-user', head).send({ decision: 'APPROVE_ALL', pin: '1234', version: 0 })).status).toBe(403);
    expect((await request(app).post(`${M}/approve`).set('x-test-user', head).send({ pin: '1234', idempotencyKey: key, expectedTotals: { workedMinutes: 1, overtimeAuthorisedMinutes: 0, headcount: 1 } })).status).toBe(403);
    expect((await request(app).post(`${T}/overtime/${id}/note`).set('x-test-user', head).send({ text: 'Saw it, no objection' })).status).toBe(200);
  });

  it('the old routes are gone: no period list, no early close, no reopen, no sign, no report, no CSV', async () => {
    const mgr = as('MANAGER');
    for (const path of [`${T}/periods`, `${T}/periods/${id}`, `${T}/periods/${id}/report`]) expect((await request(app).get(path).set('x-test-user', mgr)).status).toBe(404);
    for (const path of [`${T}/periods/${id}/close`, `${T}/periods/${id}/reopen`, `${T}/periods/${id}/sign`]) expect((await request(app).post(path).set('x-test-user', as('HR_MANAGER')).send({})).status).toBe(404);
  });

  it('a System Admin has no clock, so no My time or Report a problem', async () => {
    expect((await request(app).get(`${T}/me/time`).set('x-test-user', as('SYSTEM_ADMIN'))).status).toBe(403);
  });
});
