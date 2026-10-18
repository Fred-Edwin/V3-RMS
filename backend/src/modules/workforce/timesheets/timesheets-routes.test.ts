/**
 * The Timesheets routes: 401 without a token, 403 without the capability, 400 for bad input, the success envelope, and the
 * split between who reads, who decides, who closes and who reopens. Services are mocked; behaviour is in the unit tests and
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
vi.mock('./periods/periods-service', () => ({ listPeriods: answer, getPeriod: answer }));
vi.mock('./periods/close-service', () => ({ closePeriodEarly: answer }));
vi.mock('./periods/reopen-service', () => ({ reopenPeriod: answer, signReport: answer }));
vi.mock('./days/person-service', () => ({ personPeriod: answer, dayDetail: answer }));
vi.mock('./days/decide-service', () => ({ decideDay: answer }));
vi.mock('./overtime/overtime-service', () => ({ listOvertime: answer, decideOvertime: answer }));
vi.mock('./report/report-service', () => ({ periodReport: answer }));
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
const at = '2026-10-09T14:00:00+03:00';

type Cap = 'time.own' | 'timesheet.read' | 'timesheet.approve' | 'overtime.approve' | 'timesheet.close' | 'timesheet.reopen';
type Case = { method: 'get' | 'post'; path: string; body?: object; capability: Cap; status: number };
const cases: Case[] = [
  { method: 'get', path: `${T}/periods`, capability: 'timesheet.read', status: 200 },
  { method: 'get', path: `${T}/periods/${id}?filter=NEEDS_LOOK&page=2&pageSize=10`, capability: 'timesheet.read', status: 200 },
  { method: 'get', path: `${T}/periods/${id}/people/${id}`, capability: 'timesheet.read', status: 200 },
  { method: 'get', path: `${T}/days/${id}`, capability: 'timesheet.read', status: 200 },
  { method: 'post', path: `${T}/days/${id}/decision`, body: { outcome: 'EXCUSE', reason: 'Bus broke down' }, capability: 'timesheet.approve', status: 200 },
  { method: 'get', path: `${T}/overtime?status=PENDING`, capability: 'timesheet.read', status: 200 },
  { method: 'post', path: `${T}/overtime/${id}/decision`, body: { outcome: 'DECLINE', reason: 'No activity recorded' }, capability: 'overtime.approve', status: 200 },
  { method: 'get', path: `${T}/periods/${id}/report`, capability: 'timesheet.read', status: 200 },
  { method: 'post', path: `${T}/periods/${id}/sign`, body: { pin: '1234' }, capability: 'timesheet.close', status: 200 },
  { method: 'post', path: `${T}/periods/${id}/close`, body: { confirmCarry: true }, capability: 'timesheet.close', status: 200 },
  { method: 'post', path: `${T}/periods/${id}/reopen`, body: { reason: 'Missed a fix for Dan' }, capability: 'timesheet.reopen', status: 200 },
  { method: 'get', path: `${T}/requests?state=WAITING`, capability: 'timesheet.read', status: 200 },
  { method: 'post', path: `${T}/requests/${id}/decision`, body: { outcome: 'DECLINE', reason: 'Not what the clock shows' }, capability: 'timesheet.approve', status: 200 },
  { method: 'get', path: `${T}/me/requests`, capability: 'time.own', status: 200 },
  { method: 'post', path: `${T}/me/requests`, body: { kind: 'CLOCK_TIME_WRONG', date: '2026-10-09', type: 'OUT', at, note: 'I tapped out by accident' }, capability: 'time.own', status: 201 },
  { method: 'post', path: `${T}/me/requests/${id}/withdraw`, capability: 'time.own', status: 200 },
  { method: 'get', path: `${T}/me/time`, capability: 'time.own', status: 200 },
  { method: 'get', path: `${T}/me/rota?from=2026-10-12&to=2026-10-25`, capability: 'time.own', status: 200 },
];
const WITH: Record<Cap, string> = { 'time.own': 'WAITER', 'timesheet.read': 'MANAGER', 'timesheet.approve': 'MANAGER', 'overtime.approve': 'MANAGER', 'timesheet.close': 'MANAGER', 'timesheet.reopen': 'HR_MANAGER' };
const WITHOUT: Record<Cap, string> = { 'time.own': 'DIRECTOR', 'timesheet.read': 'WAITER', 'timesheet.approve': 'ACCOUNTANT', 'overtime.approve': 'ACCOUNTANT', 'timesheet.close': 'DIRECTOR', 'timesheet.reopen': 'MANAGER' };
const call = (c: Case, user?: string) => {
  const r = request(app)[c.method](c.path);
  return (user ? r.set('x-test-user', user) : r).send(c.body);
};

describe('Timesheets routes', () => {
  beforeEach(() => answer.mockClear());

  it.each(cases)('$method $path: 401 without a token', async (c) => {
    expect((await call(c)).status).toBe(401);
  });
  it.each(cases)('$method $path: 403 without $capability', async (c) => {
    expect((await call(c, as(WITHOUT[c.capability]))).status).toBe(403);
    expect(answer).not.toHaveBeenCalled();
  });
  it.each(cases)('$method $path: answers in the envelope', async (c) => {
    const res = await call(c, as(WITH[c.capability]));
    expect(res.status).toBe(c.status);
    expect(res.body).toEqual({ success: true, data: { ok: true } });
  });

  it('400 for bad bodies and queries, and nothing reaches a service', async () => {
    const mgr = as('MANAGER');
    const hr = as('HR_MANAGER');
    const waiter = as('WAITER');
    const post = (path: string, user: string, body: object) => request(app).post(path).set('x-test-user', user).send(body);
    expect((await post(`${T}/days/${id}/decision`, mgr, { outcome: 'EXCUSE' })).status).toBe(400); // excusing needs a reason
    expect((await post(`${T}/days/${id}/decision`, mgr, { outcome: 'HOLD', reason: 'x' })).status).toBe(400);
    expect((await post(`${T}/overtime/${id}/decision`, mgr, { outcome: 'DECLINE' })).status).toBe(400);
    expect((await post(`${T}/overtime/${id}/decision`, mgr, { outcome: 'APPROVE', minutes: 0 })).status).toBe(400);
    expect((await post(`${T}/periods/${id}/reopen`, hr, { reason: '' })).status).toBe(400);
    expect((await post(`${T}/periods/${id}/sign`, mgr, { pin: '12' })).status).toBe(400);
    expect((await post(`${T}/requests/${id}/decision`, mgr, { outcome: 'DECLINE' })).status).toBe(400);
    expect((await post(`${T}/me/requests`, waiter, { kind: 'CLOCK_TIME_WRONG', date: '2026-10-09', note: 'no time given' })).status).toBe(400);
    expect((await post(`${T}/me/requests`, waiter, { kind: 'SOMETHING', date: '2026-10-09', note: 'no such kind' })).status).toBe(400);
    expect((await request(app).get(`${T}/periods/not-an-id`).set('x-test-user', mgr)).status).toBe(400);
    expect((await request(app).get(`${T}/periods/${id}?page=0`).set('x-test-user', mgr)).status).toBe(400);
    expect((await request(app).get(`${T}/me/rota?from=2026-10-12&to=2026-09-01`).set('x-test-user', waiter)).status).toBe(400);
    expect(answer).not.toHaveBeenCalled();
  });

  it('a request is read by its owner and by a reader in scope', async () => {
    expect((await request(app).get(`${T}/requests/${id}`).set('x-test-user', as('WAITER'))).status).toBe(200);
    expect((await request(app).get(`${T}/requests/${id}`).set('x-test-user', as('MANAGER'))).status).toBe(200);
  });

  it('the Accountant and the Director read timesheets and act on none', async () => {
    for (const role of ['ACCOUNTANT', 'DIRECTOR']) {
      const user = as(role);
      expect((await request(app).get(`${T}/periods`).set('x-test-user', user)).status).toBe(200);
      expect((await request(app).post(`${T}/days/${id}/decision`).set('x-test-user', user).send({ outcome: 'ACCEPT' })).status).toBe(403);
      expect((await request(app).post(`${T}/overtime/${id}/decision`).set('x-test-user', user).send({ outcome: 'DECLINE', reason: 'No' })).status).toBe(403);
    }
  });

  it('a department head reads and decides for their people, but cannot close or reopen a period', async () => {
    const head = as('WAITER', { isDepartmentHead: true });
    expect((await request(app).get(`${T}/periods/${id}`).set('x-test-user', head)).status).toBe(200);
    expect((await request(app).post(`${T}/days/${id}/decision`).set('x-test-user', head).send({ outcome: 'ACCEPT' })).status).toBe(200);
    expect((await request(app).post(`${T}/periods/${id}/close`).set('x-test-user', head).send({})).status).toBe(403);
    expect((await request(app).post(`${T}/periods/${id}/reopen`).set('x-test-user', head).send({ reason: 'Fix a day' })).status).toBe(403);
  });

  it('HR reopens; the Branch Manager closes early and signs; the System Admin closes but does not reopen', async () => {
    expect((await request(app).post(`${T}/periods/${id}/reopen`).set('x-test-user', as('HR_MANAGER')).send({ reason: 'Fix a day' })).status).toBe(200);
    expect((await request(app).post(`${T}/periods/${id}/close`).set('x-test-user', as('SYSTEM_ADMIN')).send({})).status).toBe(200);
    expect((await request(app).post(`${T}/periods/${id}/reopen`).set('x-test-user', as('SYSTEM_ADMIN')).send({ reason: 'Fix a day' })).status).toBe(403);
  });

  it('a System Admin has no clock, so no My time or Report a problem', async () => {
    expect((await request(app).get(`${T}/me/time`).set('x-test-user', as('SYSTEM_ADMIN'))).status).toBe(403);
  });
});
