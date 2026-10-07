/**
 * GET /inventory/permissions/me: the signed-in person's row of the table, and (demo only) the System Admin previewing
 * another role's row with `?asRole=`. Anyone else's `asRole` is ignored, so nobody can read a bigger row than their own.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import router from './permissions-routes';

vi.mock('../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    next();
  },
}));

const app = express().use(router);
const as = (role: string) => JSON.stringify({ id: 'u1', role, siteId: null });
const caps = async (role: string, query = ''): Promise<{ role: string; capabilities: string[] }> => {
  const res = await request(app).get(`/inventory/permissions/me${query}`).set('x-test-user', as(role));
  expect(res.status).toBe(200);
  return res.body.data;
};

describe('GET /inventory/permissions/me', () => {
  it('returns the caller’s own row', async () => {
    const data = await caps('ACCOUNTANT');
    expect(data.role).toBe('ACCOUNTANT');
    expect(data.capabilities).toContain('payables.record_deposit');
    expect(data.capabilities).not.toContain('orders.request');
  });

  it('lets the System Admin preview another role’s row', async () => {
    const data = await caps('SYSTEM_ADMIN', '?asRole=STORE_ATTENDANT');
    expect(data.role).toBe('STORE_ATTENDANT');
    expect(data.capabilities.sort()).toEqual(['catalog.add_missing', 'catalog.read', 'catalog.see_costs', 'counts.record', 'orders.read', 'orders.receive', 'orders.request', 'prep.read', 'prep.record', 'suppliers.quick_add', 'suppliers.read_basic', 'waste.log', 'waste.read', 'waste.reverse_own']);
  });

  it('gives the Accountant the Prep read rows and no Prep write rows', async () => {
    const data = await caps('ACCOUNTANT');
    expect(data.capabilities).toEqual(expect.arrayContaining(['prep.read', 'prep.see_costs', 'prep.read_flags']));
    expect(data.capabilities).not.toContain('prep.record');
  });

  it('ignores asRole for anyone who is not the System Admin, and for unknown roles', async () => {
    expect((await caps('DIRECTOR', '?asRole=STORE_MANAGER')).role).toBe('DIRECTOR');
    expect((await caps('SYSTEM_ADMIN', '?asRole=NOT_A_ROLE')).role).toBe('SYSTEM_ADMIN');
  });
});
