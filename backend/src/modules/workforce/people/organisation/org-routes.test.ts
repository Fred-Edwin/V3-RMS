/**
 * The Organisation routes (O1 to O15): 401 without a token, 403 without the capability, 400 for a bad id or body, the
 * success envelope, and static paths before `/:id`. The services are mocked; their behaviour is tested in the database
 * flows and the unit tests beside them.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (!raw) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    req.user = JSON.parse(raw);
    next();
  },
}));
vi.mock('../employees/employees-repository', () => ({
  employeesRepository: { loadSubjectFacts: async () => ({ employeeId: null, tracksTime: null, headOfDepartmentIds: [] }) },
}));

const answer = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock('./departments/departments-read-service', () => ({ departmentsReadService: { overview: answer, getDepartment: answer } }));
vi.mock('./departments/departments-service', () => ({ departmentsService: { create: answer, update: answer, retire: answer, restore: answer } }));
vi.mock('./heads/heads-service', () => ({ headsService: { candidates: answer, withoutLogin: answer, preview: answer, assign: answer, end: answer } }));
vi.mock('./positions/positions-service', () => ({ positionsService: { list: answer, get: answer, create: answer, impact: answer, update: answer, retire: answer, restore: answer } }));

import router from '../org-routes';

const app = express().use(express.json()).use(router);
app.use((err: { statusCode?: number; name?: string }, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.name === 'ZodError' ? 400 : (err.statusCode ?? 500)).json({ success: false });
});

const as = (role: string, extra: Record<string, unknown> = {}) => JSON.stringify({ id: 'u1', role, siteId: 's1', ...extra });
const id = '0b8d3c6e-5f7a-4c1e-9d3a-2f4e6a8b0c12';
const O = '/workforce/org';
const head = { employeeId: id, mode: 'REPLACE' };

type Case = { method: 'get' | 'post' | 'patch'; path: string; body?: object; capability: 'org.read' | 'org.write' | 'org.write_heads'; status: number };
const cases: Case[] = [
  { method: 'get', path: O, capability: 'org.read', status: 200 },
  { method: 'get', path: `${O}/departments/${id}`, capability: 'org.read', status: 200 },
  { method: 'post', path: `${O}/departments`, body: { siteId: id, name: 'Bakery' }, capability: 'org.write', status: 201 },
  { method: 'patch', path: `${O}/departments/${id}`, body: { name: 'Bakery' }, capability: 'org.write', status: 200 },
  { method: 'post', path: `${O}/departments/${id}/retire`, capability: 'org.write', status: 200 },
  { method: 'post', path: `${O}/departments/${id}/restore`, capability: 'org.write', status: 200 },
  { method: 'get', path: `${O}/departments/${id}/head-candidates`, capability: 'org.write_heads', status: 200 },
  { method: 'get', path: `${O}/departments/${id}/head-candidates/no-login`, capability: 'org.write_heads', status: 200 },
  { method: 'post', path: `${O}/departments/${id}/head/preview`, body: head, capability: 'org.write_heads', status: 200 },
  { method: 'post', path: `${O}/departments/${id}/head`, body: head, capability: 'org.write_heads', status: 200 },
  { method: 'post', path: `${O}/departments/${id}/head/end`, body: { reason: 'Left' }, capability: 'org.write_heads', status: 200 },
  { method: 'get', path: `${O}/positions`, capability: 'org.read', status: 200 },
  { method: 'get', path: `${O}/positions/${id}`, capability: 'org.read', status: 200 },
  { method: 'post', path: `${O}/positions`, body: { name: 'Baker', defaultTracksTime: true }, capability: 'org.write', status: 201 },
  { method: 'get', path: `${O}/positions/${id}/impact?defaultTracksTime=false`, capability: 'org.write', status: 200 },
  { method: 'patch', path: `${O}/positions/${id}`, body: { casualsAllowed: false }, capability: 'org.write', status: 200 },
  { method: 'post', path: `${O}/positions/${id}/retire`, capability: 'org.write', status: 200 },
  { method: 'post', path: `${O}/positions/${id}/restore`, capability: 'org.write', status: 200 },
];
// One role per capability that holds it, and one that does not.
const WITH: Record<Case['capability'], string> = { 'org.read': 'DIRECTOR', 'org.write': 'HR_MANAGER', 'org.write_heads': 'HR_MANAGER' };
const WITHOUT: Record<Case['capability'], string> = { 'org.read': 'ACCOUNTANT', 'org.write': 'MANAGER', 'org.write_heads': 'ACCOUNTANT' };
const call = (c: Case, user?: string) => {
  const r = request(app)[c.method](c.path);
  return (user ? r.set('x-test-user', user) : r).send(c.body);
};

describe('Organisation routes', () => {
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

  it('400 for a bad id', async () => {
    expect((await request(app).get(`${O}/departments/not-a-uuid`).set('x-test-user', as('HR_MANAGER'))).status).toBe(400);
    expect((await request(app).get(`${O}/positions/not-a-uuid`).set('x-test-user', as('HR_MANAGER'))).status).toBe(400);
  });

  it('400 for a bad body: an acting head with no return day, an empty edit, a missing reason', async () => {
    const hr = as('HR_MANAGER');
    expect((await request(app).post(`${O}/departments/${id}/head`).set('x-test-user', hr).send({ employeeId: id, mode: 'ACTING' })).status).toBe(400);
    expect((await request(app).patch(`${O}/departments/${id}`).set('x-test-user', hr).send({})).status).toBe(400);
    expect((await request(app).post(`${O}/departments/${id}/head/end`).set('x-test-user', hr).send({})).status).toBe(400);
    expect((await request(app).get(`${O}/positions/${id}/impact`).set('x-test-user', hr)).status).toBe(400);
    expect(answer).not.toHaveBeenCalled();
  });

  it('a department head reads only: no write or head capability', async () => {
    const head = as('WAITER', { isDepartmentHead: true });
    expect((await request(app).get(O).set('x-test-user', head)).status).toBe(200);
    expect((await request(app).post(`${O}/departments/${id}/head`).set('x-test-user', head).send({ employeeId: id, mode: 'REPLACE' })).status).toBe(403);
    expect((await request(app).get(`${O}/positions`).set('x-test-user', as('WAITER'))).status).toBe(403);
  });

  it('a Branch Manager may name heads but not add departments', async () => {
    const manager = as('MANAGER');
    expect((await request(app).post(`${O}/departments/${id}/head`).set('x-test-user', manager).send({ employeeId: id, mode: 'REPLACE' })).status).toBe(200);
    expect((await request(app).post(`${O}/departments`).set('x-test-user', manager).send({ siteId: id, name: 'Bakery' })).status).toBe(403);
  });
});
