/**
 * The Attendance routes: 401 without a token, 403 without the capability, 400 for bad input, the success envelope, and
 * the split between who may clock, read the board, clock for someone, fix time and flip the switch. Services are mocked;
 * behaviour is in the unit tests and the database flows.
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
vi.mock('./clock/clock-in-service', () => ({ clockIn: answer }));
vi.mock('./clock/clock-out-service', () => ({ clockOut: answer }));
vi.mock('./clock/undo-service', () => ({ undoLastTap: answer }));
vi.mock('./prompt/shift-end-service', () => ({ stayOn: answer }));
vi.mock('./me/my-day-service', () => ({ myDay: answer }));
vi.mock('./board/board-service', () => ({ todayBoard: answer }));
vi.mock('./board/clock-for-service', () => ({ clockForSomeone: answer }));
vi.mock('./fixes/fixes-service', () => ({ applyFix: answer, previewFix: answer }));
vi.mock('./fixes/history-service', () => ({ dayHistory: answer }));
vi.mock('./lateness/lateness-service', () => ({ latenessReport: answer }));
vi.mock('./time-tab/time-tab-service', () => ({ personMonth: answer, personTiles: answer }));
vi.mock('./switch/switch-service', () => ({ getSwitch: answer, setSwitch: answer, listSwitches: answer }));
vi.mock('../_shared/pin/signer-pin', () => ({ verifySignerPin: async (_userId: string, pin: string) => (pin === '4321' ? { method: 'PIN', signedAt: new Date() } : Promise.reject(Object.assign(new Error('That PIN is not right. Try again.'), { statusCode: 403, code: 'PIN_INVALID' }))) }));

import router from './attendance-routes';

const app = express().use(express.json()).use(router);
app.use((err: { statusCode?: number; name?: string }, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.name === 'ZodError' ? 400 : (err.statusCode ?? 500)).json({ success: false });
});

const id = '0b8d3c6e-5f7a-4c1e-9d3a-2f4e6a8b0c12'; // also the test user's site, so a manager asking for "their" site is in scope
const as = (role: string, extra: Record<string, unknown> = {}) => JSON.stringify({ id: 'u1', role, siteId: id, ...extra });
const A = '/workforce/attendance';
const at = '2026-10-12T06:15:00+03:00';
const tap = { clientEventId: 'tap-0001-abcd' };
const fix = { employeeId: id, date: '2026-10-08', reason: 'Forgot to tap out', action: 'ADD', type: 'OUT', at };

type Cap = 'time.own' | 'today.read' | 'today.act' | 'timesheet.read' | 'time.fix' | 'attendance.switch';
type Case = { method: 'get' | 'post' | 'put'; path: string; body?: object; capability: Cap; status: number };
const cases: Case[] = [
  { method: 'get', path: `${A}/me`, capability: 'time.own', status: 200 },
  { method: 'post', path: `${A}/clock-in`, body: tap, capability: 'time.own', status: 201 },
  { method: 'post', path: `${A}/clock-out`, body: tap, capability: 'time.own', status: 201 },
  { method: 'post', path: `${A}/undo`, body: { clientEventId: 'undo-0001' }, capability: 'time.own', status: 200 },
  { method: 'post', path: `${A}/shift-end`, body: { rotaEntryId: id, answer: 'STAY_ON', reasonCode: 'BUSY' }, capability: 'time.own', status: 201 },
  { method: 'get', path: `${A}/board`, capability: 'today.read', status: 200 },
  { method: 'post', path: `${A}/clock-for`, body: { employeeId: id, type: 'IN', at, reason: 'Phone battery died' }, capability: 'today.act', status: 201 },
  { method: 'get', path: `${A}/day?employeeId=${id}&date=2026-10-12`, capability: 'timesheet.read', status: 200 },
  { method: 'post', path: `${A}/fixes/preview`, body: fix, capability: 'time.fix', status: 200 },
  { method: 'post', path: `${A}/fixes`, body: fix, capability: 'time.fix', status: 201 },
  { method: 'get', path: `${A}/lateness?from=2026-10-01&to=2026-10-12`, capability: 'timesheet.read', status: 200 },
  { method: 'get', path: `${A}/time/month?employeeId=${id}&month=2026-10`, capability: 'timesheet.read', status: 200 },
  { method: 'get', path: `${A}/time/tiles?employeeId=${id}`, capability: 'timesheet.read', status: 200 },
  { method: 'get', path: `${A}/switch?siteId=${id}`, capability: 'today.read', status: 200 },
  { method: 'put', path: `${A}/switch`, body: { siteId: id, enabled: true, pin: '4321' }, capability: 'attendance.switch', status: 200 },
  { method: 'get', path: `${A}/switch/sites`, capability: 'today.read', status: 200 },
];
// A role that holds the capability and one that does not.
const WITH: Record<Cap, string> = { 'time.own': 'WAITER', 'today.read': 'MANAGER', 'today.act': 'MANAGER', 'timesheet.read': 'MANAGER', 'time.fix': 'HR_MANAGER', 'attendance.switch': 'SYSTEM_ADMIN' };
const WITHOUT: Record<Cap, string> = { 'time.own': 'DIRECTOR', 'today.read': 'WAITER', 'today.act': 'HR_MANAGER', 'timesheet.read': 'WAITER', 'time.fix': 'WAITER', 'attendance.switch': 'HR_MANAGER' };
const call = (c: Case, user?: string) => {
  const r = request(app)[c.method](c.path);
  return (user ? r.set('x-test-user', user) : r).send(c.body);
};

describe('Attendance routes', () => {
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
    // S3 wraps its list as { sites }, every other route returns the service answer as is.
    expect(res.body).toEqual({ success: true, data: c.path.endsWith('/switch/sites') ? { sites: { ok: true } } : { ok: true } });
  });

  it('400 for bad bodies and queries, and nothing reaches a service', async () => {
    const waiter = as('WAITER');
    const hr = as('HR_MANAGER');
    expect((await request(app).post(`${A}/clock-in`).set('x-test-user', waiter).send({})).status).toBe(400);
    expect((await request(app).post(`${A}/clock-in`).set('x-test-user', waiter).send({ ...tap, latitude: -0.4 })).status).toBe(400);
    expect((await request(app).post(`${A}/clock-out`).set('x-test-user', waiter).send({ ...tap, deviceAt: 'noon' })).status).toBe(400);
    expect((await request(app).post(`${A}/shift-end`).set('x-test-user', waiter).send({ rotaEntryId: id, answer: 'STAY_ON', reasonCode: 'LAZY' })).status).toBe(400);
    expect((await request(app).post(`${A}/fixes`).set('x-test-user', hr).send({ ...fix, reason: '' })).status).toBe(400);
    expect((await request(app).post(`${A}/fixes`).set('x-test-user', hr).send({ ...fix, action: 'DELETE' })).status).toBe(400);
    expect((await request(app).get(`${A}/day?employeeId=nope&date=2026-10-12`).set('x-test-user', hr)).status).toBe(400);
    expect((await request(app).get(`${A}/lateness?from=2026-10-01`).set('x-test-user', hr)).status).toBe(400);
    expect(answer).not.toHaveBeenCalled();
  });

  it('a retried tap answers 200 and a new one 201', async () => {
    answer.mockResolvedValueOnce({ replayed: true } as never);
    expect((await request(app).post(`${A}/clock-in`).set('x-test-user', as('WAITER')).send(tap)).status).toBe(200);
    answer.mockResolvedValueOnce({ replayed: false } as never);
    expect((await request(app).post(`${A}/clock-in`).set('x-test-user', as('WAITER')).send(tap)).status).toBe(201);
  });

  it('a department head reads the board and clocks for their people, but cannot fix time or flip the switch', async () => {
    const head = as('WAITER', { isDepartmentHead: true });
    expect((await request(app).get(`${A}/board`).set('x-test-user', head)).status).toBe(200);
    expect((await request(app).post(`${A}/clock-for`).set('x-test-user', head).send({ employeeId: id, type: 'IN', at, reason: 'Phone battery died' })).status).toBe(201);
    expect((await request(app).post(`${A}/fixes`).set('x-test-user', head).send(fix)).status).toBe(403);
    expect((await request(app).put(`${A}/switch`).set('x-test-user', head).send({ siteId: id, enabled: true, pin: '4321' })).status).toBe(403);
  });

  it('the Time tab: a department head has none, the Accountant reads it, and bad queries never reach the service', async () => {
    const month = `${A}/time/month?employeeId=${id}&month=2026-10`;
    expect((await request(app).get(month).set('x-test-user', as('WAITER', { isDepartmentHead: true }))).status).toBe(403);
    expect((await request(app).get(month).set('x-test-user', as('ACCOUNTANT'))).status).toBe(200);
    answer.mockClear();
    const hr = as('HR_MANAGER');
    expect((await request(app).get(`${A}/time/month?employeeId=${id}&month=2026-13`).set('x-test-user', hr)).status).toBe(400);
    expect((await request(app).get(`${A}/time/month?employeeId=${id}&month=2026-10&filter=bogus`).set('x-test-user', hr)).status).toBe(400);
    expect((await request(app).get(`${A}/time/tiles`).set('x-test-user', hr)).status).toBe(400);
    expect(answer).not.toHaveBeenCalled();
  });

  it('the Accountant reads time and lateness but cannot see the board or act on it; the Store Attendant clocks like staff', async () => {
    const accountant = as('ACCOUNTANT');
    expect((await request(app).get(`${A}/lateness?from=2026-10-01&to=2026-10-12`).set('x-test-user', accountant)).status).toBe(200);
    expect((await request(app).get(`${A}/board`).set('x-test-user', accountant)).status).toBe(403);
    expect((await request(app).post(`${A}/clock-in`).set('x-test-user', as('STORE_ATTENDANT')).send(tap)).status).toBe(201);
  });

  it('a System Admin has no clock of their own but runs the board, fixes time and flips the switch', async () => {
    const admin = as('SYSTEM_ADMIN');
    expect((await request(app).post(`${A}/clock-in`).set('x-test-user', admin).send(tap)).status).toBe(403);
    expect((await request(app).post(`${A}/fixes`).set('x-test-user', admin).send(fix)).status).toBe(201);
    expect((await request(app).put(`${A}/switch`).set('x-test-user', admin).send({ siteId: id, enabled: false, pin: '4321' })).status).toBe(200);
  });

  it('the switch is signed with the caller\'s own PIN: no PIN is refused, a wrong PIN is refused, and the Director may switch like the System Admin', async () => {
    const director = as('DIRECTOR');
    expect((await request(app).put(`${A}/switch`).set('x-test-user', director).send({ siteId: id, enabled: true })).status).toBe(400);
    expect((await request(app).put(`${A}/switch`).set('x-test-user', director).send({ siteId: id, enabled: true, pin: '0000' })).status).toBe(403);
    expect((await request(app).put(`${A}/switch`).set('x-test-user', director).send({ siteId: id, enabled: true, pin: '4321' })).status).toBe(200);
  });
});
