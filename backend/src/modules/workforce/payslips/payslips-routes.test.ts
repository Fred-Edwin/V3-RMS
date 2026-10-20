/**
 * The payslip routes (Segment 3): 401 without a token; staff reads that show pay need a live unlock token for this person and this phone
 * (403 UNLOCK_REQUIRED, never 401, so the app does not sign anyone out); the System Admin has no payslip; HR and the Accountant open
 * anyone's without a code; only the Director reads the daily openings; only the Accountant confirms the P9 layout. Services are mocked.
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
const file = vi.hoisted(() => vi.fn(async () => ({ bytes: Buffer.from('%PDF-1.4 test'), filename: 'Payslip-PS-0001-2026-09.pdf', number: 'PS-0001', hash: 'h', variant: 'ORIGINAL' })));
vi.mock('./reads/reads-service', () => ({ list: answer, home: answer, history: answer, detail: answer, versionsOf: answer, documentOf: file }));
vi.mock('./reads/others-service', () => ({ openAny: answer, documentAny: file, openingsOfDay: answer }));
vi.mock('./p9/p9-service', () => ({ myP9Status: answer, myP9Document: file, generateP9: file, confirmP9Format: answer }));
vi.mock('./unlock/unlock-service', () => ({ unlock: answer, setFirstCode: answer, lock: answer, tokenHash: (t: string) => `hash:${t}` }));
const GOOD = { id: 'unlock1', userId: 'u1', deviceId: 'phone-0000-0001', lastUsedAt: new Date(), expiresAt: new Date(Date.now() + 3_600_000), revokedAt: null };
vi.mock('./unlock/unlock-repository', () => ({
  unlockRepository: { findUnlock: async (hash: string) => (hash === 'hash:good' ? GOOD : hash === 'hash:idle' ? { ...GOOD, lastUsedAt: new Date(Date.now() - 11 * 60_000) } : null), touch: async () => ({ count: 1 }) },
}));

import router from './payslips-routes';

const app = express().use(express.json()).use(router);
app.use((err: { statusCode?: number; code?: string; name?: string }, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.name === 'ZodError' ? 400 : (err.statusCode ?? 500)).json({ success: false, code: err.code });
});

const id = '0b8d3c6e-5f7a-4c1e-9d3a-2f4e6a8b0c12';
const as = (role: string, userId = 'u1') => JSON.stringify({ id: userId, role, siteId: id });
const P = '/workforce/payslips';
const open = { 'x-payslip-unlock': 'good', 'x-device-id': 'phone-0000-0001' };

const STAFF_ROLES = ['WAITER', 'BARISTA', 'CHEF', 'STEWARD', 'HOUSEKEEPING', 'STORE_ATTENDANT', 'DEPARTMENT_HEAD', 'MANAGER', 'STORE_MANAGER', 'HR_MANAGER', 'ACCOUNTANT', 'DIRECTOR'] as const;

describe('payslip routes: who has payslips', () => {
  it.each(STAFF_ROLES)('%s opens their own list with no code', async (role) => {
    expect((await request(app).get(`${P}/me`).set('x-test-user', as(role))).status).toBe(200);
  });
  it('the System Admin has no payslip: every staff route is 403', async () => {
    for (const path of [`${P}/me`, `${P}/me/home`, `${P}/me/${id}`, `${P}/me/${id}/document`]) {
      expect((await request(app).get(path).set('x-test-user', as('SYSTEM_ADMIN')).set(open)).status).toBe(403);
    }
    expect((await request(app).post(`${P}/me/unlock`).set('x-test-user', as('SYSTEM_ADMIN')).send({ code: '1234', deviceId: 'phone-0000-0001' })).status).toBe(403);
  });
  it('401 without a token on every route', async () => {
    for (const path of [`${P}/me`, `${P}/me/home`, `${P}/${id}`, `${P}/opens`]) expect((await request(app).get(path)).status).toBe(401);
  });
});

describe('payslip routes: the code is enforced by the server', () => {
  const pay = [`${P}/me/home`, `${P}/me/history`, `${P}/me/${id}`, `${P}/me/${id}/versions`, `${P}/me/${id}/document`, `${P}/me/p9/2026/document`];
  it.each(pay)('GET %s without an unlock token is 403 UNLOCK_REQUIRED (never 401)', async (path) => {
    const res = await request(app).get(path).set('x-test-user', as('BARISTA'));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('UNLOCK_REQUIRED');
  });
  it.each(pay)('GET %s with a good token for this person and phone is let in', async (path) => {
    expect((await request(app).get(path).set('x-test-user', as('BARISTA')).set(open)).status).toBe(200);
  });
  it('a token is not for another person, another phone, or an idle screen', async () => {
    const get = (user: string, headers: Record<string, string>) => request(app).get(`${P}/me/home`).set('x-test-user', as('BARISTA', user)).set(headers);
    expect((await get('someone-else', open)).body.code).toBe('UNLOCK_REQUIRED');
    expect((await get('u1', { ...open, 'x-device-id': 'another-phone-99' })).body.code).toBe('UNLOCK_REQUIRED');
    expect((await get('u1', { ...open, 'x-payslip-unlock': 'idle' })).body.code).toBe('UNLOCK_REQUIRED');
    expect((await get('u1', { ...open, 'x-payslip-unlock': 'made-up' })).body.code).toBe('UNLOCK_REQUIRED');
  });
  it('the P9 status needs no code (it carries no amount)', async () => {
    expect((await request(app).get(`${P}/me/p9/2026`).set('x-test-user', as('BARISTA'))).status).toBe(200);
  });
  it('the unlock, first code and lock bodies are checked (400)', async () => {
    const post = (path: string, body: object) => request(app).post(`${P}/me/${path}`).set('x-test-user', as('BARISTA')).send(body);
    expect((await post('unlock', { code: '12', deviceId: 'phone-0000-0001' })).status).toBe(400);
    expect((await post('unlock', { code: '1234', deviceId: 'x' })).status).toBe(400);
    expect((await post('unlock', { code: '1234', deviceId: 'phone-0000-0001', extra: 1 })).status).toBe(400);
    expect((await post('code', { code: 'abcd', deviceId: 'phone-0000-0001' })).status).toBe(400);
    expect((await post('lock', {})).status).toBe(400);
    expect((await post('unlock', { code: '1234', deviceId: 'phone-0000-0001' })).status).toBe(200);
    expect((await post('code', { code: '1234', deviceId: 'phone-0000-0001' })).status).toBe(201);
    expect((await post('lock', { deviceId: 'phone-0000-0001' })).status).toBe(200);
  });
  it('a payslip id that is not a uuid, and a bad year, are 400', async () => {
    expect((await request(app).get(`${P}/me/not-an-id`).set('x-test-user', as('BARISTA')).set(open)).status).toBe(400);
    expect((await request(app).get(`${P}/me/p9/1999`).set('x-test-user', as('BARISTA'))).status).toBe(400);
  });
});

describe('payslip routes: HR, the Accountant and the Director', () => {
  const anyone = [`${P}/${id}`, `${P}/${id}/document`];
  it.each(anyone)('GET %s is for HR and the Accountant only', async (path) => {
    for (const role of ['HR_MANAGER', 'ACCOUNTANT']) expect((await request(app).get(path).set('x-test-user', as(role))).status).toBe(200);
    for (const role of ['BARISTA', 'MANAGER', 'STORE_MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'DEPARTMENT_HEAD']) expect((await request(app).get(path).set('x-test-user', as(role))).status).toBe(403);
  });
  it('the daily openings are the Director’s alone (the System Admin reads the audit log, not this)', async () => {
    expect((await request(app).get(`${P}/opens`).set('x-test-user', as('DIRECTOR'))).status).toBe(200);
    for (const role of ['HR_MANAGER', 'ACCOUNTANT', 'SYSTEM_ADMIN', 'MANAGER', 'BARISTA']) expect((await request(app).get(`${P}/opens`).set('x-test-user', as(role))).status).toBe(403);
  });
  it('only the Accountant confirms the P9 layout; only HR and the Accountant build a card for someone', async () => {
    const confirm = (role: string) => request(app).post(`${P}/p9/format/confirm`).set('x-test-user', as(role)).send({ pin: '1234' });
    expect((await confirm('ACCOUNTANT')).status).toBe(200);
    for (const role of ['HR_MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'MANAGER', 'BARISTA']) expect((await confirm(role)).status).toBe(403);
    expect((await request(app).post(`${P}/p9/format/confirm`).set('x-test-user', as('ACCOUNTANT')).send({ pin: '12' })).status).toBe(400);
    const gen = (role: string) => request(app).post(`${P}/p9/2026/people/${id}/generate`).set('x-test-user', as(role));
    for (const role of ['HR_MANAGER', 'ACCOUNTANT']) expect((await gen(role)).status).toBe(200);
    for (const role of ['DIRECTOR', 'SYSTEM_ADMIN', 'MANAGER', 'BARISTA']) expect((await gen(role)).status).toBe(403);
  });
  it('the file is sent inline and never cached', async () => {
    const res = await request(app).get(`${P}/me/${id}/document?purpose=download`).set('x-test-user', as('BARISTA')).set(open);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['content-disposition']).toBe('inline; filename="Payslip-PS-0001-2026-09.pdf"');
    expect((await request(app).get(`${P}/me/${id}/document?purpose=print`).set('x-test-user', as('BARISTA')).set(open)).status).toBe(400);
  });
});
