/**
 * The setup routes through a real express app: the §3.1 grid for six roles on every endpoint (C15 to C22), validation, route
 * order, and no token. The service is mocked; the capability gate is the real one.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler';
import { setupService } from './setup-service';
import setupRouter from './setup-routes';

vi.mock('../../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    else throw Object.assign(new Error('Missing or invalid authorization header'), { statusCode: 401, code: 'AUTHENTICATION_ERROR' });
    next();
  },
}));
vi.mock('./setup-service', () => ({
  setupService: { view: vi.fn(), sectionItems: vi.fn(), addSection: vi.fn(), saveLayout: vi.fn(), addableItems: vi.fn(), addItems: vi.fn(), moveItem: vi.fn(), undoMove: vi.fn() },
}));

const app = express().use(express.json()).use(setupRouter).use(errorHandler);
const as = (role: string) => JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', role, siteId: null });

const SECTION = '5e000000-0000-4000-8000-000000000001';
const ITEM = '10000000-0000-4000-8000-000000000001';
const MOVE = 'b0000000-0000-4000-8000-000000000001';

const ROLES = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_ATTENDANT'] as const;
const READERS = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER'];
const WRITERS = ['STORE_MANAGER', 'SYSTEM_ADMIN'];
const MOVERS = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'STORE_ATTENDANT'];

const layout = { version: 'abc', sections: [{ id: SECTION, itemIds: [ITEM] }] };

type Call = { name: string; send: (role: string) => request.Test; allowed: readonly string[]; service: keyof typeof setupService };
const as_ = (role: string) => ({ 'x-test-user': as(role) });
const calls: Call[] = [
  { name: 'C15 GET /count-setup', send: (r) => request(app).get('/count-setup').set(as_(r)), allowed: READERS, service: 'view' },
  { name: 'C16 GET /count-setup/sections/:id/items', send: (r) => request(app).get(`/count-setup/sections/${SECTION}/items`).set(as_(r)), allowed: READERS, service: 'sectionItems' },
  { name: 'C16 (unsectioned)', send: (r) => request(app).get('/count-setup/sections/unsectioned/items').set(as_(r)), allowed: READERS, service: 'sectionItems' },
  { name: 'C17 POST /count-setup/sections', send: (r) => request(app).post('/count-setup/sections').set(as_(r)).send({ name: 'Packaging' }), allowed: WRITERS, service: 'addSection' },
  { name: 'C18 PUT /count-setup/layout', send: (r) => request(app).put('/count-setup/layout').set(as_(r)).send(layout), allowed: WRITERS, service: 'saveLayout' },
  { name: 'C19 GET /count-setup/add-items', send: (r) => request(app).get(`/count-setup/add-items?sectionId=${SECTION}&q=oat`).set(as_(r)), allowed: WRITERS, service: 'addableItems' },
  { name: 'C20 POST /count-setup/sections/:id/items', send: (r) => request(app).post(`/count-setup/sections/${SECTION}/items`).set(as_(r)).send({ itemIds: [ITEM] }), allowed: WRITERS, service: 'addItems' },
  { name: 'C21 POST /count-setup/items/:itemId/move', send: (r) => request(app).post(`/count-setup/items/${ITEM}/move`).set(as_(r)).send({ toSectionId: SECTION }), allowed: MOVERS, service: 'moveItem' },
  { name: 'C22 POST /count-setup/moves/:id/undo', send: (r) => request(app).post(`/count-setup/moves/${MOVE}/undo`).set(as_(r)), allowed: WRITERS, service: 'undoMove' },
];

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(setupService)) (fn as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
});

describe('the role grid (§3.1)', () => {
  for (const call of calls) {
    describe(call.name, () => {
      it.each(call.allowed)('lets %s through', async (role) => {
        const res = await call.send(role);
        expect(res.status).toBe(call.name.startsWith('C17') ? 201 : 200);
        expect(setupService[call.service]).toHaveBeenCalledTimes(1);
      });

      it.each(ROLES.filter((r) => !call.allowed.includes(r)))('refuses %s with 403, before any service runs', async (role) => {
        expect((await call.send(role)).status).toBe(403);
        expect(setupService[call.service]).not.toHaveBeenCalled();
      });
    });
  }

  it('is 401 on every endpoint with no token', async () => {
    expect((await request(app).get('/count-setup')).status).toBe(401);
    expect((await request(app).get(`/count-setup/sections/${SECTION}/items`)).status).toBe(401);
    expect((await request(app).post('/count-setup/sections').send({ name: 'X' })).status).toBe(401);
    expect((await request(app).put('/count-setup/layout').send(layout)).status).toBe(401);
    expect((await request(app).get('/count-setup/add-items')).status).toBe(401);
    expect((await request(app).post(`/count-setup/sections/${SECTION}/items`).send({ itemIds: [ITEM] })).status).toBe(401);
    expect((await request(app).post(`/count-setup/items/${ITEM}/move`).send({ toSectionId: SECTION })).status).toBe(401);
    expect((await request(app).post(`/count-setup/moves/${MOVE}/undo`)).status).toBe(401);
  });
});

describe('validation', () => {
  const manager = as_('STORE_MANAGER');

  it('C17: a blank or very long name is 400', async () => {
    expect((await request(app).post('/count-setup/sections').set(manager).send({ name: '   ' })).status).toBe(400);
    expect((await request(app).post('/count-setup/sections').set(manager).send({ name: 'x'.repeat(41) })).status).toBe(400);
    expect((await request(app).post('/count-setup/sections').set(manager).send({ name: 'ok', extra: 1 })).status).toBe(400);
  });

  it('C18: a missing version, a non-uuid section id and an empty layout are 400; "unsectioned" is a valid id', async () => {
    expect((await request(app).put('/count-setup/layout').set(manager).send({ sections: layout.sections })).status).toBe(400);
    expect((await request(app).put('/count-setup/layout').set(manager).send({ version: 'v', sections: [{ id: 'nope', itemIds: [] }] })).status).toBe(400);
    expect((await request(app).put('/count-setup/layout').set(manager).send({ version: 'v', sections: [] })).status).toBe(400);
    expect((await request(app).put('/count-setup/layout').set(manager).send({ version: 'v', sections: [{ id: 'unsectioned', itemIds: [] }] })).status).toBe(200);
  });

  it('C16, C20: a section id that is neither a uuid nor "unsectioned" is 400', async () => {
    expect((await request(app).get('/count-setup/sections/nope/items').set(manager)).status).toBe(400);
    expect((await request(app).post('/count-setup/sections/nope/items').set(manager).send({ itemIds: [ITEM] })).status).toBe(400);
  });

  it('C19: sectionId is required and must be a uuid; the pager sizes are 25, 50 or 100', async () => {
    expect((await request(app).get('/count-setup/add-items').set(manager)).status).toBe(400);
    expect((await request(app).get(`/count-setup/add-items?sectionId=${SECTION}&pageSize=10`).set(manager)).status).toBe(400);
    expect((await request(app).get(`/count-setup/add-items?sectionId=${SECTION}&pageSize=25&tab=other`).set(manager)).status).toBe(200);
    expect(setupService.addableItems).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sectionId: SECTION, tab: 'other', page: 1, pageSize: 25 }));
  });

  it('C20, C21, C22: empty or non-uuid ids are 400', async () => {
    expect((await request(app).post(`/count-setup/sections/${SECTION}/items`).set(manager).send({ itemIds: [] })).status).toBe(400);
    expect((await request(app).post('/count-setup/items/nope/move').set(manager).send({ toSectionId: SECTION })).status).toBe(400);
    expect((await request(app).post(`/count-setup/items/${ITEM}/move`).set(manager).send({ toSectionId: 'x' })).status).toBe(400);
    expect((await request(app).post('/count-setup/moves/nope/undo').set(manager)).status).toBe(400);
  });
});

describe('route order', () => {
  it('GET /count-setup/add-items is the add-items search, not a section', async () => {
    await request(app).get(`/count-setup/add-items?sectionId=${SECTION}`).set(as_('STORE_MANAGER'));
    expect(setupService.addableItems).toHaveBeenCalledTimes(1);
    expect(setupService.sectionItems).not.toHaveBeenCalled();
  });
});
