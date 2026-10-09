/**
 * The branch waste routes through a real express app (contract §3.1, §4): the capability gates on BW4 and BW5 for every role, the 401
 * with no token, route order (`/mine`, `/branch`, `/branches`, `/items` before `/:id`, and `:id` only a uuid), validation (strict
 * bodies: no `locationId`, `departmentId` or `pin`), and the 200 / 201 on a replayed batch. The service is mocked; the gates are real.
 * The department rule and the per-role reach are the service's, tested in `branch-service.test.ts`.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler';
import { branchWasteService } from './branch-service';
import branchRouter from './branch-routes';

vi.mock('../../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    else throw Object.assign(new Error('Missing or invalid authorization header'), { statusCode: 401, code: 'AUTHENTICATION_ERROR' });
    next();
  },
}));
vi.mock('./branch-service', () => ({
  branchWasteService: { listItems: vi.fn(), log: vi.fn(), listMine: vi.fn(), listBranch: vi.fn(), listBranches: vi.fn(), detail: vi.fn(), reverse: vi.fn() },
}));

const app = express().use(express.json()).use(branchRouter).use(errorHandler);
const as = (role: string) => ({ 'x-test-user': JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', role, siteId: null }) });

const ID = 'e0000000-0000-4000-8000-000000000001';
const ITEM = '10000000-0000-4000-8000-000000000071';
const body = { entries: [{ inventoryItemId: ITEM, quantity: '2', reason: 'EXPIRY' }], idempotencyKey: 'idem-key-0001' };
const ROLES = ['MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'STORE_MANAGER', 'STORE_ATTENDANT', 'CHEF', 'WAITER', 'BARISTA'] as const;

const emptyList = { rows: [], departments: [], page: { page: 1, pageSize: 50, total: 0 } };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchWasteService.listItems).mockResolvedValue({ often: [], items: [] });
  vi.mocked(branchWasteService.log).mockResolvedValue({ result: { entries: [], replayed: false }, replayed: false });
  vi.mocked(branchWasteService.listMine).mockResolvedValue({ department: { id: ID, name: 'Kitchen' }, rows: [], bannerText: null, page: { page: 1, pageSize: 50, total: 0 } });
  vi.mocked(branchWasteService.listBranch).mockResolvedValue(emptyList);
  vi.mocked(branchWasteService.listBranches).mockResolvedValue(emptyList);
  vi.mocked(branchWasteService.detail).mockRejectedValue(new Error('not under test'));
  vi.mocked(branchWasteService.reverse).mockRejectedValue(new Error('not under test'));
});

describe('the access table on the desktop reads', () => {
  const BRANCH_READERS = ['MANAGER', 'SYSTEM_ADMIN'];
  const ANY_BRANCH_READERS = ['SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'STORE_MANAGER'];

  describe('BW4 GET /branch (branch_waste.read)', () => {
    it.each(BRANCH_READERS)('lets %s through', async (role) => {
      expect((await request(app).get('/branch').set(as(role))).status).toBe(200);
      expect(branchWasteService.listBranch).toHaveBeenCalledTimes(1);
    });

    it.each(ROLES.filter((r) => !BRANCH_READERS.includes(r)))('refuses %s with 403, before the service runs', async (role) => {
      expect((await request(app).get('/branch').set(as(role))).status).toBe(403);
      expect(branchWasteService.listBranch).not.toHaveBeenCalled();
    });
  });

  describe('BW5 GET /branches (branch_waste.read_any_branch)', () => {
    it.each(ANY_BRANCH_READERS)('lets %s through', async (role) => {
      expect((await request(app).get('/branches').set(as(role))).status).toBe(200);
      expect(branchWasteService.listBranches).toHaveBeenCalledTimes(1);
    });

    it.each(ROLES.filter((r) => !ANY_BRANCH_READERS.includes(r)))('refuses %s with 403, before the service runs', async (role) => {
      expect((await request(app).get('/branches').set(as(role))).status).toBe(403);
      expect(branchWasteService.listBranches).not.toHaveBeenCalled();
    });
  });

  it('every route is 401 with no token', async () => {
    for (const res of [
      await request(app).get('/items'),
      await request(app).post('/').send(body),
      await request(app).get('/mine'),
      await request(app).get('/branch'),
      await request(app).get('/branches'),
      await request(app).get(`/${ID}`),
      await request(app).post(`/${ID}/reverse`).send({ reason: 'WRONG_ITEM' }),
    ]) {
      expect(res.status).toBe(401);
    }
  });
});

describe('the department routes pass any signed-in caller to the service, which applies the department rule', () => {
  it('BW1, BW2 and BW3 are reached by a chef (no capability in the table)', async () => {
    expect((await request(app).get('/items').set(as('CHEF'))).status).toBe(200);
    expect((await request(app).post('/').set(as('CHEF')).send(body)).status).toBe(201);
    expect((await request(app).get('/mine').set(as('CHEF'))).status).toBe(200);
  });
});

describe('route order and what the service is handed', () => {
  it('/mine, /items, /branch and /branches are never taken for an id', async () => {
    await request(app).get('/mine').set(as('CHEF'));
    await request(app).get('/items').set(as('CHEF'));
    expect(branchWasteService.detail).not.toHaveBeenCalled();
    expect(branchWasteService.listMine).toHaveBeenCalledTimes(1);
    expect(branchWasteService.listItems).toHaveBeenCalledTimes(1);
  });

  it('a path that is not a uuid is not an entry (404 from the router), and reaches no service', async () => {
    expect((await request(app).get('/not-a-uuid').set(as('MANAGER'))).status).toBe(404);
    expect((await request(app).post('/not-a-uuid/reverse').set(as('MANAGER')).send({ reason: 'WRONG_ITEM' })).status).toBe(404);
    expect(branchWasteService.detail).not.toHaveBeenCalled();
    expect(branchWasteService.reverse).not.toHaveBeenCalled();
  });

  it('BW2: 201 for a new batch and 200 with replayed:true when the key was used before', async () => {
    expect((await request(app).post('/').set(as('CHEF')).send(body)).status).toBe(201);
    vi.mocked(branchWasteService.log).mockResolvedValue({ result: { entries: [], replayed: true }, replayed: true });
    const res = await request(app).post('/').set(as('CHEF')).send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { entries: [], replayed: true } });
  });

  it('BW1: the search and limit reach the service, limit defaults to 20', async () => {
    await request(app).get('/items?search=pilau').set(as('CHEF'));
    expect(branchWasteService.listItems).toHaveBeenCalledWith(expect.anything(), { search: 'pilau', limit: 20 });
  });

  it('BW3 and BW4: the pager and date range reach the service, page 1 of 50 by default', async () => {
    await request(app).get('/mine?from=2026-10-01&to=2026-10-07').set(as('CHEF'));
    expect(branchWasteService.listMine).toHaveBeenCalledWith(expect.anything(), { page: 1, pageSize: 50, from: '2026-10-01', to: '2026-10-07' });
    await request(app).get('/branch?departmentId=30000000-0000-4000-8000-000000000001&reason=EXPIRY&status=reversed&pageSize=25&page=2').set(as('MANAGER'));
    expect(branchWasteService.listBranch).toHaveBeenCalledWith(expect.anything(), {
      page: 2,
      pageSize: 25,
      departmentId: '30000000-0000-4000-8000-000000000001',
      reason: 'EXPIRY',
      status: 'reversed',
    });
  });

  it('BW6 and BW7: the uuid reaches the service', async () => {
    vi.mocked(branchWasteService.detail).mockResolvedValue({ entry: {} as never });
    vi.mocked(branchWasteService.reverse).mockResolvedValue({} as never);
    expect((await request(app).get(`/${ID}`).set(as('CHEF'))).status).toBe(200);
    expect(branchWasteService.detail).toHaveBeenCalledWith(expect.anything(), ID);
    const res = await request(app).post(`/${ID}/reverse`).set(as('CHEF')).send({ reason: 'OTHER', note: 'Counted in the wrong bin' });
    expect(res.status).toBe(200);
    expect(branchWasteService.reverse).toHaveBeenCalledWith(expect.anything(), ID, { reason: 'OTHER', note: 'Counted in the wrong bin' });
  });
});

describe('validation', () => {
  const chef = as('CHEF');

  it('BW2 refuses an empty batch, a zero quantity, an unknown reason, a short key, and 31 lines', async () => {
    expect((await request(app).post('/').set(chef).send({ ...body, entries: [] })).status).toBe(400);
    expect((await request(app).post('/').set(chef).send({ ...body, entries: [{ inventoryItemId: ITEM, quantity: '0', reason: 'EXPIRY' }] })).status).toBe(400);
    expect((await request(app).post('/').set(chef).send({ ...body, entries: [{ inventoryItemId: ITEM, quantity: '1', reason: 'STOLEN' }] })).status).toBe(400);
    expect((await request(app).post('/').set(chef).send({ ...body, idempotencyKey: 'short' })).status).toBe(400);
    expect((await request(app).post('/').set(chef).send({ ...body, entries: Array.from({ length: 31 }, () => body.entries[0]) })).status).toBe(400);
    expect(branchWasteService.log).not.toHaveBeenCalled();
  });

  it('BW2 is strict: a locationId, departmentId or pin is refused (the department comes from the caller, waste is never signed)', async () => {
    for (const extra of [{ locationId: ITEM }, { departmentId: ITEM }, { pin: '1234' }, { siteId: ITEM }]) {
      expect((await request(app).post('/').set(chef).send({ ...body, ...extra })).status, JSON.stringify(extra)).toBe(400);
    }
    expect((await request(app).post('/').set(chef).send({ ...body, entries: [{ ...body.entries[0], locationId: ITEM }] })).status).toBe(400);
    expect(branchWasteService.log).not.toHaveBeenCalled();
  });

  it('BW7 needs a reason, refuses Other without a note, an unknown reason, a long note and a pin', async () => {
    const manager = as('MANAGER');
    expect((await request(app).post(`/${ID}/reverse`).set(manager).send({})).status).toBe(400);
    expect((await request(app).post(`/${ID}/reverse`).set(manager).send({ reason: 'OTHER' })).status).toBe(400);
    expect((await request(app).post(`/${ID}/reverse`).set(manager).send({ reason: 'BORED' })).status).toBe(400);
    expect((await request(app).post(`/${ID}/reverse`).set(manager).send({ reason: 'WRONG_ITEM', note: 'x'.repeat(301) })).status).toBe(400);
    expect((await request(app).post(`/${ID}/reverse`).set(manager).send({ reason: 'WRONG_ITEM', pin: '1234' })).status).toBe(400);
    expect(branchWasteService.reverse).not.toHaveBeenCalled();
  });

  it('the lists refuse a bad pageSize, a bad date, an unknown reason or status, and a branchId that is not a uuid', async () => {
    expect((await request(app).get('/branch?pageSize=7').set(as('MANAGER'))).status).toBe(400);
    expect((await request(app).get('/branch?from=7%20Oct').set(as('MANAGER'))).status).toBe(400);
    expect((await request(app).get('/branch?reason=STOLEN').set(as('MANAGER'))).status).toBe(400);
    expect((await request(app).get('/branch?status=gone').set(as('MANAGER'))).status).toBe(400);
    expect((await request(app).get('/branches?branchId=nyeri').set(as('DIRECTOR'))).status).toBe(400);
    expect((await request(app).get('/mine?pageSize=1000').set(as('CHEF'))).status).toBe(400);
    expect(branchWasteService.listBranch).not.toHaveBeenCalled();
    expect(branchWasteService.listBranches).not.toHaveBeenCalled();
    expect(branchWasteService.listMine).not.toHaveBeenCalled();
  });
});
