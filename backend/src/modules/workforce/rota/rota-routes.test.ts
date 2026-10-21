/**
 * The Rota routes (T1 to T5, G1 to G7): 401 without a token, 403 without the capability, 400 for a bad id, query or body,
 * the success envelope, and that no publish or amend route exists. Services are mocked; behaviour is in the database flows.
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
vi.mock('./templates/templates-service', () => ({ templatesService: { list: answer, create: answer, retire: answer, restore: answer } }));
vi.mock('./templates/templates-update-service', () => ({ templatesUpdateService: { update: answer } }));
vi.mock('./cells/cells-service', () => ({ cellsService: { setCells: answer, fill: answer, pattern: answer } }));
vi.mock('./copy/copy-service', () => ({ copyService: { preview: answer, copy: answer } }));
vi.mock('./weeks/weeks-read-service', () => ({ weeksReadService: { getWeek: answer } }));
vi.mock('./weeks/print-service', () => ({ printService: { get: answer } }));
vi.mock('./weeks/my-shifts-service', () => ({ myShiftsService: { list: answer } }));

import router from './rota-routes';

const app = express().use(express.json()).use(router);
app.use((err: { statusCode?: number; name?: string }, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.name === 'ZodError' ? 400 : (err.statusCode ?? 500)).json({ success: false });
});

const as = (role: string, extra: Record<string, unknown> = {}) => JSON.stringify({ id: 'u1', role, siteId: 's1', ...extra });
const id = '0b8d3c6e-5f7a-4c1e-9d3a-2f4e6a8b0c12';
const R = '/workforce/rota';
const week = '?weekStart=2026-10-19';
const shift = { siteId: id, name: 'Morning', colour: 'BLUE', startTime: '06:00', endTime: '14:00' };

type Cap = 'rota.read' | 'rota.write' | 'rota.template_write';
type Case = { method: 'get' | 'post' | 'put' | 'patch'; path: string; body?: object; capability: Cap; status: number };
const cases: Case[] = [
  { method: 'get', path: `${R}/templates`, capability: 'rota.read', status: 200 },
  { method: 'post', path: `${R}/templates`, body: shift, capability: 'rota.template_write', status: 201 },
  { method: 'patch', path: `${R}/templates/${id}`, body: { name: 'Early' }, capability: 'rota.template_write', status: 200 },
  { method: 'post', path: `${R}/templates/${id}/retire`, capability: 'rota.template_write', status: 200 },
  { method: 'post', path: `${R}/templates/${id}/restore`, capability: 'rota.template_write', status: 200 },
  { method: 'get', path: `${R}/week${week}`, capability: 'rota.read', status: 200 },
  { method: 'get', path: `${R}/week/print${week}`, capability: 'rota.read', status: 200 },
  { method: 'get', path: `${R}/mine`, capability: 'rota.read', status: 200 },
  { method: 'put', path: `${R}/cells`, body: { changes: [{ employeeId: id, date: '2026-10-20', templateIds: [id] }] }, capability: 'rota.write', status: 200 },
  { method: 'post', path: `${R}/fill`, body: { employeeIds: [id], dates: ['2026-10-20'], templateId: id }, capability: 'rota.write', status: 200 },
  { method: 'post', path: `${R}/pattern`, body: { employeeIds: [id], weekStart: '2026-10-19', byWeekday: { '1': id, '2': null } }, capability: 'rota.write', status: 200 },
  { method: 'post', path: `${R}/copy/preview`, body: { weekStart: '2026-10-26' }, capability: 'rota.write', status: 200 },
  { method: 'post', path: `${R}/copy`, body: { weekStart: '2026-10-26' }, capability: 'rota.write', status: 200 },
];
// A role that holds the capability and one that does not (a waiter only reads their own).
const WITH: Record<Cap, string> = { 'rota.read': 'WAITER', 'rota.write': 'MANAGER', 'rota.template_write': 'HR_MANAGER' };
const WITHOUT: Record<Cap, string> = { 'rota.read': 'KITCHEN_DISPLAY', 'rota.write': 'WAITER', 'rota.template_write': 'WAITER' };
const call = (c: Case, user?: string) => {
  const r = request(app)[c.method](c.path);
  return (user ? r.set('x-test-user', user) : r).send(c.body);
};

describe('Rota routes', () => {
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

  it('400 for bad ids, dates and bodies, and nothing reaches a service', async () => {
    const hr = as('HR_MANAGER');
    expect((await request(app).patch(`${R}/templates/nope`).set('x-test-user', hr).send({ name: 'x' })).status).toBe(400);
    expect((await request(app).patch(`${R}/templates/${id}`).set('x-test-user', hr).send({})).status).toBe(400);
    expect((await request(app).get(`${R}/week`).set('x-test-user', hr)).status).toBe(400);
    expect((await request(app).get(`${R}/week?weekStart=19-10-2026`).set('x-test-user', hr)).status).toBe(400);
    expect((await request(app).put(`${R}/cells`).set('x-test-user', hr).send({ changes: [] })).status).toBe(400);
    expect((await request(app).put(`${R}/cells`).set('x-test-user', hr).send({ changes: [{ employeeId: id, date: '2026-10-20', templateIds: [id, id] }] })).status).toBe(400);
    expect((await request(app).post(`${R}/templates`).set('x-test-user', hr).send({ ...shift, startTime: '6:00' })).status).toBe(400);
    expect((await request(app).post(`${R}/fill`).set('x-test-user', hr).send({ employeeIds: [], dates: ['2026-10-20'], templateId: null })).status).toBe(400);
    expect(answer).not.toHaveBeenCalled();
  });

  it('has no publish or amend route: edits are live', async () => {
    const hr = as('HR_MANAGER');
    for (const path of ['publish', 'amend', 'week/publish']) expect((await request(app).post(`${R}/${path}`).set('x-test-user', hr).send({})).status).toBe(404);
  });

  it('a department head edits the rota; a Director only reads it', async () => {
    const head = as('WAITER', { isDepartmentHead: true });
    expect((await request(app).put(`${R}/cells`).set('x-test-user', head).send({ changes: [{ employeeId: id, date: '2026-10-20', templateIds: [] }] })).status).toBe(200);
    expect((await request(app).get(`${R}/week${week}`).set('x-test-user', as('DIRECTOR'))).status).toBe(200);
    expect((await request(app).post(`${R}/templates`).set('x-test-user', head).send(shift)).status).toBe(403);
  });
});
