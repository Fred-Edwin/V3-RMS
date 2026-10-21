/**
 * The Payroll routes (Segment 2A): 401 without a token, 403 without the capability, 400 for bad input and the success envelope.
 * Who reads, who reviews, who approves, who reminds and who approves for a site. Services are mocked; behaviour is in the unit
 * tests and the database flow.
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
vi.mock('./months/months-service', () => ({ listMonths: answer, getMonth: answer }));
vi.mock('./reads/tabs-service', () => ({ rulesApplied: answer, taxAndDeductions: answer, casualPay: answer, totals: answer }));
vi.mock('./reads/payslips-service', async () => ({ ...(await vi.importActual<object>('./reads/payslips-service')), listPayslips: answer, payslipDetail: answer }));
vi.mock('./estimate/estimate-service', () => ({ readEstimate: answer }));
vi.mock('./review/review-service', () => ({ listReview: answer, checkLine: answer, checkKind: answer, recalculate: answer, isStale: async () => false }));
vi.mock('./review/adjustments-service', () => ({ addAdjustment: answer, leaveOut: answer, removeAdjustment: answer }));
vi.mock('./approval/approval-service', () => ({ sendToAccountant: answer, sendBack: answer, approveMonth: answer }));
vi.mock('./sites/sites-service', () => ({ remindSite: answer, approveSiteLate: answer }));
vi.mock('./publish/publish-service', () => ({ publishMonth: answer }));
vi.mock('./corrections/correction-service', () => ({ correctionInputs: answer, previewCorrection: answer, correctPayslip: answer }));
vi.mock('./paid/paid-service', () => ({ markPaid: answer }));
vi.mock('./bank/bank-service', () => ({ payoutView: answer, downloadBankFile: vi.fn(async () => ({ filename: 'bank-2026-09.csv', text: 'a,b\r\n', version: 1, hash: 'h', repeat: false })) }));
vi.mock('./exports/exports-service', () => ({ exportMonth: vi.fn(async () => ({ buffer: Buffer.from('%PDF-'), filename: 'x.pdf', contentType: 'application/pdf', documentNumber: null, revision: 1 })) }));

import router from './payroll-routes';

const app = express().use(express.json()).use(router);
app.use((err: { statusCode?: number; name?: string }, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.name === 'ZodError' ? 400 : (err.statusCode ?? 500)).json({ success: false });
});

const id = '0b8d3c6e-5f7a-4c1e-9d3a-2f4e6a8b0c12';
const as = (role: string) => JSON.stringify({ id: 'u1', role, siteId: role === 'MANAGER' ? id : null });
const P = '/workforce/payroll';
const M = `${P}/months/2026-09`;
const key = 'request-key-0001';

type Cap = 'payroll.read' | 'payroll.review' | 'payroll.approve' | 'payroll.remind' | 'payroll.estimate.read' | 'payroll.approve_site_late' | 'payroll.publish' | 'payroll.correct' | 'payroll.pay' | 'payroll.export';
type Case = { method: 'get' | 'post' | 'delete'; path: string; body?: object; capability: Cap; file?: boolean };
const pin = '1234';
const change = { kind: 'LATE_DAYS', changes: { lateDaysCounted: 1 } };
const cases: Case[] = [
  { method: 'get', path: `${P}/months?page=1&rows=5`, capability: 'payroll.read' },
  { method: 'get', path: M, capability: 'payroll.read' },
  { method: 'get', path: `${M}/rules-applied`, capability: 'payroll.read' },
  { method: 'get', path: `${M}/tax`, capability: 'payroll.read' },
  { method: 'get', path: `${M}/casual`, capability: 'payroll.read' },
  { method: 'get', path: `${M}/totals`, capability: 'payroll.read' },
  { method: 'get', path: `${M}/payslips?q=an&page=1&rows=50`, capability: 'payroll.read' },
  { method: 'get', path: `${M}/payslips/${id}`, capability: 'payroll.read' },
  { method: 'get', path: `${M}/estimate`, capability: 'payroll.estimate.read' },
  { method: 'get', path: `${M}/review?state=OPEN&page=1&rows=25`, capability: 'payroll.read' },
  { method: 'post', path: `${M}/recalculate`, body: { idempotencyKey: key, stateVersion: 1 }, capability: 'payroll.review' },
  { method: 'post', path: `${M}/review/check-kind`, body: { kind: 'LATENESS_DEDUCTION', stateVersion: 1 }, capability: 'payroll.review' },
  { method: 'post', path: `${M}/review/${id}/check`, body: { checked: true, stateVersion: 1 }, capability: 'payroll.review' },
  { method: 'post', path: `${M}/review/${id}/leave-out`, body: { reason: 'No pay profile yet', stateVersion: 1, idempotencyKey: key }, capability: 'payroll.review' },
  { method: 'post', path: `${M}/adjustments`, body: { employeeId: id, type: 'ALLOWANCE', label: 'Airtime', amount: '500', taxable: true, reason: 'Agreed with the Director', pin: '1234', idempotencyKey: key, stateVersion: 1 }, capability: 'payroll.review' },
  { method: 'delete', path: `${M}/adjustments/${id}`, body: { stateVersion: 2, idempotencyKey: key }, capability: 'payroll.review' },
  { method: 'post', path: `${M}/send-to-accountant`, body: { idempotencyKey: key, stateVersion: 1 }, capability: 'payroll.review' },
  { method: 'post', path: `${M}/send-back`, body: { reason: 'The overtime looks high', idempotencyKey: key, stateVersion: 2 }, capability: 'payroll.approve' },
  { method: 'post', path: `${M}/approve`, body: { pin: '1234', idempotencyKey: key, stateVersion: 2, expectedTotals: { gross: '100.00', net: '90.00', taxStatutory: '10.00', other: '0.00', headcount: 2 } }, capability: 'payroll.approve' },
  { method: 'post', path: `${M}/sites/${id}/remind`, body: { idempotencyKey: key }, capability: 'payroll.remind' },
  { method: 'post', path: `${M}/sites/${id}/approve-late`, body: { pin: '1234', idempotencyKey: key, expectedTotals: { workedMinutes: 100, overtimeAuthorisedMinutes: 0, headcount: 3 } }, capability: 'payroll.approve_site_late' },
  // Segment 2B
  { method: 'post', path: `${M}/publish`, body: { pin, idempotencyKey: key, stateVersion: 3 }, capability: 'payroll.publish' },
  { method: 'get', path: `${M}/payslips/${id}/correction-inputs?version=1`, capability: 'payroll.correct' },
  { method: 'post', path: `${M}/payslips/${id}/correction-preview`, body: { change, expectedVersion: 1 }, capability: 'payroll.correct' },
  { method: 'post', path: `${M}/payslips/${id}/correct`, body: { change, reason: 'One late day was excused', pin, expectedVersion: 1, idempotencyKey: key }, capability: 'payroll.correct' },
  { method: 'get', path: `${M}/payout`, capability: 'payroll.read' },
  { method: 'post', path: `${M}/bank-file`, body: { idempotencyKey: key }, capability: 'payroll.pay', file: true },
  { method: 'post', path: `${M}/mark-paid`, body: { pin, idempotencyKey: key, stateVersion: 4, bankFileHash: 'a'.repeat(64) }, capability: 'payroll.pay' },
  { method: 'post', path: `${M}/exports`, body: { kind: 'REGISTER', format: 'pdf', idempotencyKey: key }, capability: 'payroll.export', file: true },
];
const WITH: Record<Cap, string> = {
  'payroll.read': as('ACCOUNTANT'),
  'payroll.review': as('HR_MANAGER'),
  'payroll.approve': as('ACCOUNTANT'),
  'payroll.remind': as('DIRECTOR'),
  'payroll.estimate.read': as('SYSTEM_ADMIN'),
  'payroll.approve_site_late': as('DIRECTOR'),
  'payroll.publish': as('HR_MANAGER'),
  'payroll.correct': as('HR_MANAGER'),
  'payroll.pay': as('ACCOUNTANT'),
  'payroll.export': as('DIRECTOR'),
};
const WITHOUT: Record<Cap, string> = {
  'payroll.read': as('MANAGER'),
  'payroll.review': as('ACCOUNTANT'),
  'payroll.approve': as('HR_MANAGER'),
  'payroll.remind': as('MANAGER'),
  'payroll.estimate.read': as('MANAGER'),
  'payroll.approve_site_late': as('HR_MANAGER'),
  'payroll.publish': as('ACCOUNTANT'),
  'payroll.correct': as('DIRECTOR'),
  'payroll.pay': as('HR_MANAGER'),
  'payroll.export': as('MANAGER'),
};
const call = (c: Case, user?: string) => {
  const r = request(app)[c.method](c.path);
  return (user ? r.set('x-test-user', user) : r).send(c.body);
};

describe('Payroll routes', () => {
  beforeEach(() => answer.mockClear());

  it.each(cases)('$method $path: 401 without a token', async (c) => {
    expect((await call(c)).status).toBe(401);
  });
  it.each(cases)('$method $path: 403 without $capability, and no service is reached', async (c) => {
    expect((await call(c, WITHOUT[c.capability])).status).toBe(403);
    expect(answer).not.toHaveBeenCalled();
  });
  it.each(cases.filter((c) => !c.file))('$method $path: answers in the envelope with $capability', async (c) => {
    const res = await call(c, WITH[c.capability]);
    expect([200, 201]).toContain(res.status);
    expect(res.body).toEqual({ success: true, data: { ok: true } });
  });

  it('the bank file and the exports stream a file that is never cached', async () => {
    for (const c of cases.filter((x) => x.file)) {
      const res = await call(c, WITH[c.capability]);
      expect(res.status, c.path).toBe(200);
      expect(res.header['cache-control'], c.path).toBe('no-store');
      expect(res.header['content-disposition'], c.path).toMatch(/^attachment; filename="/);
    }
  });

  it('who may do what in part 2: HR publishes, the Accountant pays, both correct, four export (the Director and System Admin too), the bank file is the Accountant only', async () => {
    const as2 = { hr: as('HR_MANAGER'), acc: as('ACCOUNTANT'), dir: as('DIRECTOR'), admin: as('SYSTEM_ADMIN'), bm: as('MANAGER'), sm: as('STORE_MANAGER'), waiter: as('WAITER') };
    const status = async (path: string, user: string, body: object) => (await request(app).post(path).set('x-test-user', user).send(body)).status;
    const publish = { pin, idempotencyKey: key, stateVersion: 3 };
    const correct = { change, reason: 'One late day was excused', pin, expectedVersion: 1, idempotencyKey: key };
    const pay = { pin, idempotencyKey: key, stateVersion: 4 };
    const exp = { kind: 'SUMMARY', format: 'pdf', idempotencyKey: key };
    expect(await status(`${M}/publish`, as2.hr, publish)).toBe(200);
    for (const u of [as2.acc, as2.dir, as2.admin, as2.bm, as2.sm, as2.waiter]) expect(await status(`${M}/publish`, u, publish)).toBe(403);
    for (const u of [as2.hr, as2.acc]) expect(await status(`${M}/payslips/${id}/correct`, u, correct)).toBe(200);
    for (const u of [as2.dir, as2.admin, as2.bm, as2.sm, as2.waiter]) expect(await status(`${M}/payslips/${id}/correct`, u, correct)).toBe(403);
    expect(await status(`${M}/mark-paid`, as2.acc, pay)).toBe(200);
    for (const u of [as2.hr, as2.dir, as2.admin, as2.bm, as2.sm, as2.waiter]) {
      expect(await status(`${M}/mark-paid`, u, pay)).toBe(403);
      expect(await status(`${M}/bank-file`, u, { idempotencyKey: key })).toBe(403);
    }
    for (const u of [as2.acc, as2.hr, as2.dir, as2.admin]) expect(await status(`${M}/exports`, u, exp)).toBe(200);
    for (const u of [as2.bm, as2.sm, as2.waiter]) expect(await status(`${M}/exports`, u, exp)).toBe(403);
  });

  it('400 for a bad part 2 body, and nothing reaches a service', async () => {
    const post = (path: string, user: string, body: object) => request(app).post(path).set('x-test-user', user).send(body);
    const hr = as('HR_MANAGER');
    const acc = as('ACCOUNTANT');
    const ok = { change, reason: 'One late day was excused', pin, expectedVersion: 1, idempotencyKey: key };
    expect((await post(`${M}/publish`, hr, { pin: '12', idempotencyKey: key, stateVersion: 1 })).status).toBe(400);
    expect((await post(`${M}/publish`, hr, { pin, idempotencyKey: key })).status).toBe(400);
    expect((await post(`${M}/payslips/${id}/correct`, hr, { ...ok, reason: 'no' })).status).toBe(400);
    expect((await post(`${M}/payslips/${id}/correct`, hr, { ...ok, reason: 'Paid 12500 too little' })).status).toBe(400);
    expect((await post(`${M}/payslips/${id}/correct`, hr, { ...ok, change: { kind: 'LATE_DAYS', changes: { absentDays: 1 } } })).status).toBe(400);
    expect((await post(`${M}/payslips/${id}/correct`, hr, { ...ok, expectedVersion: 0 })).status).toBe(400);
    expect((await post(`${M}/payslips/not-an-id/correct`, hr, ok)).status).toBe(400);
    expect((await post(`${M}/payslips/${id}/correction-preview`, hr, { change })).status).toBe(400);
    expect((await request(app).get(`${M}/payslips/${id}/correction-inputs`).set('x-test-user', hr)).status).toBe(400); // the version is required
    expect((await post(`${M}/mark-paid`, acc, { pin, idempotencyKey: key, stateVersion: 1, bankFileHash: 'xyz' })).status).toBe(400);
    expect((await post(`${M}/mark-paid`, acc, { pin: 'abcd', idempotencyKey: key, stateVersion: 1 })).status).toBe(400);
    expect((await post(`${M}/bank-file`, acc, { idempotencyKey: 'short' })).status).toBe(400);
    expect((await post(`${M}/exports`, acc, { kind: 'SUMMARY', format: 'xlsx', idempotencyKey: key })).status).toBe(400);
    expect((await post(`${M}/exports`, acc, { kind: 'NOPE', format: 'pdf', idempotencyKey: key })).status).toBe(400);
    expect(answer).not.toHaveBeenCalled();
  });

  it('a Branch Manager, a Store Manager, a head and a waiter read no payroll at all', async () => {
    for (const role of ['MANAGER', 'STORE_MANAGER', 'WAITER', 'CHEF']) {
      expect((await request(app).get(`${P}/months`).set('x-test-user', as(role))).status, role).toBe(403);
      expect((await request(app).get(M).set('x-test-user', as(role))).status, role).toBe(403);
    }
  });

  it('the Director and the System Admin read but never write, and HR cannot approve or send back', async () => {
    for (const role of ['DIRECTOR', 'SYSTEM_ADMIN']) {
      for (const c of cases.filter((x) => x.method !== 'get' && !['payroll.remind', 'payroll.approve_site_late', 'payroll.export'].includes(x.capability))) expect((await call(c, as(role))).status, `${role} ${c.path}`).toBe(403);
    }
    for (const path of ['approve', 'send-back']) expect((await request(app).post(`${M}/${path}`).set('x-test-user', as('HR_MANAGER')).send({})).status).toBe(403);
    expect((await request(app).post(`${M}/sites/${id}/approve-late`).set('x-test-user', as('HR_MANAGER')).send({})).status).toBe(403);
  });

  it('400 for bad bodies and queries, and nothing reaches a service', async () => {
    const hr = as('HR_MANAGER');
    const acc = as('ACCOUNTANT');
    const post = (path: string, user: string, body: object) => request(app).post(path).set('x-test-user', user).send(body);
    const adj = { employeeId: id, type: 'ALLOWANCE', label: 'Airtime', amount: '500', taxable: true, reason: 'Agreed with the Director', pin: '1234', idempotencyKey: key, stateVersion: 1 };
    expect((await post(`${M}/adjustments`, hr, { ...adj, amount: '0' })).status).toBe(400);
    expect((await post(`${M}/adjustments`, hr, { ...adj, amount: '12.345' })).status).toBe(400);
    expect((await post(`${M}/adjustments`, hr, { ...adj, amount: '10000001' })).status).toBe(400);
    expect((await post(`${M}/adjustments`, hr, { ...adj, type: 'BONUS' })).status).toBe(400);
    expect((await post(`${M}/adjustments`, hr, { ...adj, reason: 'ok' })).status).toBe(400);
    expect((await post(`${M}/adjustments`, hr, { ...adj, pin: '12' })).status).toBe(400);
    expect((await post(`${M}/adjustments`, hr, { ...adj, label: '' })).status).toBe(400);
    expect((await post(`${M}/adjustments`, hr, { ...adj, extra: 1 })).status).toBe(400); // strict
    expect((await post(`${M}/send-back`, acc, { reason: 'Please recheck 4,126,400 again', idempotencyKey: key, stateVersion: 1 })).status).toBe(400); // no figures in a reason
    expect((await post(`${M}/send-back`, acc, { reason: 'no', idempotencyKey: key, stateVersion: 1 })).status).toBe(400);
    expect((await post(`${M}/approve`, acc, { pin: '1234', idempotencyKey: key, stateVersion: 1 })).status).toBe(400); // the figures are required
    expect((await post(`${M}/approve`, acc, { pin: '1234', idempotencyKey: 'short', stateVersion: 1, expectedTotals: { gross: '1', net: '1', taxStatutory: '0', other: '0', headcount: 1 } })).status).toBe(400);
    expect((await post(`${M}/recalculate`, hr, { idempotencyKey: key })).status).toBe(400); // the version is required
    expect((await post(`${P}/months/2026-13/recalculate`, hr, { idempotencyKey: key, stateVersion: 1 })).status).toBe(400); // not a month
    expect((await post(`${M}/review/not-an-id/check`, hr, { checked: true, stateVersion: 1 })).status).toBe(400);
    expect((await request(app).get(`${M}/review?rows=7`).set('x-test-user', hr)).status).toBe(400); // 25, 50 or 100
    expect((await request(app).get(`${M}/payslips?rows=500`).set('x-test-user', hr)).status).toBe(400);
    expect(answer).not.toHaveBeenCalled();
  });
});
