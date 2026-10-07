/**
 * GET /workforce/permissions/me: the signed-in person's row of the table, and (demo only) the System Admin previewing
 * another role's row with `?asRole=`. Anyone else's `asRole` is ignored.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import router, { PermissionsMeSchema } from './permissions-routes';

vi.mock('../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    else throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    next();
  },
}));

const app = express().use(router);
app.use((err: { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode ?? 500).json({ success: false });
});

const as = (role: string, extra: Record<string, unknown> = {}) => JSON.stringify({ id: 'u1', role, siteId: 's1', ...extra });
const get = (user: string, query = '') => request(app).get(`/workforce/permissions/me${query}`).set('x-test-user', user);
const scopes = (body: { data: { capabilities: { capability: string; scope: string }[] } }) =>
  Object.fromEntries(body.data.capabilities.map((c) => [c.capability, c.scope]));

describe('GET /workforce/permissions/me', () => {
  it('401 without a token', async () => {
    expect((await request(app).get('/workforce/permissions/me')).status).toBe(401);
  });

  it('returns the caller’s own row with scopes, and parses against the schema', async () => {
    const res = await get(as('MANAGER'));
    expect(res.status).toBe(200);
    expect(PermissionsMeSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.data).toMatchObject({ role: 'MANAGER', siteId: 's1', isDepartmentHead: false, tracksTime: false });
    expect(scopes(res.body)).toMatchObject({ 'timesheet.read': 'unit', 'rules.edit.lateness': 'unit' });
    expect(scopes(res.body)).not.toHaveProperty('time.own');
  });

  it('a department head sees dept scopes', async () => {
    const res = await get(as('CHEF', { isDepartmentHead: true, departmentTag: 'KITCHEN' }));
    expect(res.body.data).toMatchObject({ isDepartmentHead: true, departmentTag: 'KITCHEN' });
    expect(scopes(res.body)).toMatchObject({ 'rota.write': 'dept', 'me.payslip': 'own', 'time.own': 'own' });
  });

  it('a person who does not track time has no time.own', async () => {
    const res = await get(as('DIRECTOR'));
    expect(res.body.data.tracksTime).toBe(false);
    expect(scopes(res.body)).not.toHaveProperty('time.own');
  });

  it('lets the System Admin preview another role’s row', async () => {
    const res = await get(as('SYSTEM_ADMIN'), '?asRole=ACCOUNTANT');
    expect(res.body.data.role).toBe('ACCOUNTANT');
    expect(scopes(res.body)).toMatchObject({ 'rules.confirm.statutory': 'all', 'time.own': 'own' });
  });

  it('ignores asRole for anyone else, and for unknown roles', async () => {
    expect((await get(as('DIRECTOR'), '?asRole=SYSTEM_ADMIN')).body.data.role).toBe('DIRECTOR');
    expect((await get(as('WAITER'), '?asRole=DIRECTOR')).body.data.role).toBe('WAITER');
    expect((await get(as('SYSTEM_ADMIN'), '?asRole=NOT_A_ROLE')).body.data.role).toBe('SYSTEM_ADMIN');
  });
});
