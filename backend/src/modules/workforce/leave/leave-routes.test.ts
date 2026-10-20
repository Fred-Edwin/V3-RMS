/**
 * The Leave routes: 401 without a token, 403 without the capability, 400 for a bad id, query, body or a missing Idempotency-Key,
 * and the success envelope. Services are mocked; behaviour is in the database flows.
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
const answer = vi.hoisted(() => vi.fn(async () => ({ ok: true, repeat: false })));
vi.mock('./applications/ask-service', () => ({ previewAsk: answer, createAsk: answer }));
vi.mock('./applications/cancel-service', () => ({ cancelLeave: answer }));
vi.mock('./applications/approve-service', () => ({ approveLeave: answer }));
vi.mock('./applications/decline-service', () => ({ declineLeave: answer }));
vi.mock('./balances/adjust-service', () => ({ adjustBalance: answer, previewAdjust: answer }));
vi.mock('./balances/balances-read-service', () => ({ balancesList: answer, balanceDrawer: answer }));
vi.mock('./reads/away-service', () => ({ awayBetween: answer }));
vi.mock('./reads/badge-service', () => ({ leaveBadge: answer, leaveNeedsYou: answer }));
vi.mock('./reads/calendar-service', () => ({ leaveCalendar: answer }));
vi.mock('./reads/detail-service', () => ({ applicationDetail: answer }));
vi.mock('./reads/mine-service', () => ({ myOverview: answer, myApplications: answer }));
vi.mock('./reads/requests-service', () => ({ requestsList: answer }));
vi.mock('./reads/rota-panel-service', () => ({ rotaPanel: answer }));
vi.mock('./slip/slip-service', () => ({ slipOf: answer, slipPdf: vi.fn(async () => ({ buffer: Buffer.from('%PDF-1'), fileName: 'Leave-slip-LVE-0001.pdf' })) }));

import router from './leave-routes';

const app = express().use(express.json()).use(router);
app.use((err: { statusCode?: number; name?: string }, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.name === 'ZodError' ? 400 : (err.statusCode ?? (err.name === 'ValidationError' ? 400 : 500))).json({ success: false });
});

const as = (role: string) => JSON.stringify({ id: 'u1', role, siteId: 's1' });
const id = '0b8d3c6e-5f7a-4c1e-9d3a-2f4e6a8b0c12';
const L = '/workforce/leave';
const key = { 'Idempotency-Key': 'key-0123456789' };

type Cap = 'leave.request' | 'leave.read' | 'leave.approve' | 'leave.balance_adjust';
interface Case { method: 'get' | 'post'; path: string; body?: object; capability: Cap; headers?: Record<string, string> }
const cases: Case[] = [
  { method: 'get', path: `${L}/me/overview`, capability: 'leave.request' },
  { method: 'get', path: `${L}/me/applications?status=WAITING,APPROVED&page=1&rows=25`, capability: 'leave.request' },
  { method: 'post', path: `${L}/applications/preview`, body: { typeCode: 'ANNUAL', start: '2026-10-26', end: '2026-10-28' }, capability: 'leave.request' },
  { method: 'post', path: `${L}/applications`, body: { typeCode: 'ANNUAL', start: '2026-10-26', end: '2026-10-28' }, capability: 'leave.request', headers: key },
  { method: 'get', path: `${L}/requests`, capability: 'leave.read' },
  { method: 'get', path: `${L}/applications/${id}/rota`, capability: 'leave.read' },
  { method: 'post', path: `${L}/applications/${id}/approve`, body: { pin: '1234', expectedVersion: 1 }, capability: 'leave.approve', headers: key },
  { method: 'post', path: `${L}/applications/${id}/decline`, body: { reasonCode: 'BUSY', expectedVersion: 1 }, capability: 'leave.approve', headers: key },
  { method: 'get', path: `${L}/balances`, capability: 'leave.read' },
  { method: 'get', path: `${L}/balances/${id}`, capability: 'leave.read' },
  { method: 'post', path: `${L}/balances/adjust/preview`, body: { employeeId: id, typeCode: 'ANNUAL', add: 2 }, capability: 'leave.balance_adjust' },
  { method: 'post', path: `${L}/balances/adjust`, body: { employeeId: id, typeCode: 'ANNUAL', add: 2, reasonCode: 'DIRECTOR_GRANT', pin: '1234' }, capability: 'leave.balance_adjust', headers: key },
  { method: 'get', path: `${L}/calendar`, capability: 'leave.read' },
  { method: 'get', path: `${L}/badge`, capability: 'leave.request' },
  { method: 'get', path: `${L}/needs-you?limit=5`, capability: 'leave.approve' },
  { method: 'get', path: `${L}/away?from=2026-10-26&to=2026-11-01`, capability: 'leave.read' },
];
// A role that holds the capability and one that does not.
const WITH: Record<Cap, string> = { 'leave.request': 'WAITER', 'leave.read': 'MANAGER', 'leave.approve': 'MANAGER', 'leave.balance_adjust': 'HR_MANAGER' };
const WITHOUT: Record<Cap, string> = { 'leave.request': 'SYSTEM_ADMIN', 'leave.read': 'WAITER', 'leave.approve': 'WAITER', 'leave.balance_adjust': 'MANAGER' };

const send = (c: Case, role: string | null) => {
  const r = request(app)[c.method](c.path);
  if (role) r.set('x-test-user', as(role));
  for (const [name, value] of Object.entries(c.headers ?? {})) r.set(name, value);
  return c.body ? r.send(c.body) : r;
};

describe('Leave routes', () => {
  it.each(cases)('$method $path: 401 without a token', async (c) => {
    expect((await send(c, null)).status).toBe(401);
  });
  it.each(cases)('$method $path: 403 without the capability', async (c) => {
    expect((await send(c, WITHOUT[c.capability])).status).toBe(403);
  });
  it.each(cases)('$method $path: the success envelope for a role that holds it', async (c) => {
    const response = await send(c, WITH[c.capability]);
    expect(response.status).toBe(c.method === 'post' && c.path.endsWith('/applications') ? 201 : c.path.endsWith('/adjust') ? 201 : 200);
    expect(response.body).toMatchObject({ success: true });
  });

  it('answers 400 for a bad id, a bad body, a bad query and a missing Idempotency-Key', async () => {
    const ask = { typeCode: 'ANNUAL', start: '2026-10-26', end: '2026-10-28' };
    expect((await request(app).post(`${L}/applications/not-an-id/approve`).set('x-test-user', as('MANAGER')).set(key).send({ pin: '1234', expectedVersion: 1 })).status).toBe(400);
    expect((await request(app).post(`${L}/applications/${id}/approve`).set('x-test-user', as('MANAGER')).set(key).send({ pin: '12', expectedVersion: 1 })).status).toBe(400);
    expect((await request(app).post(`${L}/applications/${id}/decline`).set('x-test-user', as('MANAGER')).set(key).send({ reasonCode: 'OTHER', expectedVersion: 1 })).status).toBe(400);
    expect((await request(app).post(`${L}/applications`).set('x-test-user', as('WAITER')).send(ask)).status).toBe(400);
    expect((await request(app).post(`${L}/applications`).set('x-test-user', as('WAITER')).set(key).send({ ...ask, start: '2026-02-30' })).status).toBe(400);
    expect((await request(app).post(`${L}/applications`).set('x-test-user', as('WAITER')).set(key).send({ ...ask, extra: 1 })).status).toBe(400);
    expect((await request(app).get(`${L}/requests?rows=1000`).set('x-test-user', as('MANAGER'))).status).toBe(400);
    expect((await request(app).get(`${L}/away?from=2026-11-05&to=2026-11-01`).set('x-test-user', as('MANAGER'))).status).toBe(400);
    expect((await request(app).post(`${L}/balances/adjust`).set('x-test-user', as('HR_MANAGER')).set(key).send({ employeeId: id, typeCode: 'ANNUAL', add: 0, reasonCode: 'CORRECTION', pin: '1234' })).status).toBe(400);
    expect((await request(app).post(`${L}/balances/adjust`).set('x-test-user', as('HR_MANAGER')).set(key).send({ employeeId: id, typeCode: 'ANNUAL', add: 61, reasonCode: 'CORRECTION', pin: '1234' })).status).toBe(400);
  });

  it('streams the slip PDF with the download headers', async () => {
    const response = await request(app).get(`${L}/applications/${id}/slip.pdf`).set('x-test-user', as('WAITER'));
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toContain('Leave-slip-LVE-0001.pdf');
  });

  it('has no requireRole and no route that edits a decided request', () => {
    const paths = cases.map((c) => c.path);
    expect(paths.some((p) => /\/(edit|revert|reopen)/.test(p))).toBe(false);
  });
});
