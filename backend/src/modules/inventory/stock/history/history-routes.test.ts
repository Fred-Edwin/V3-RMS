/**
 * The history routes through a real express app: the §3.1 grid for six roles on S3 to S5 (stock.read; the Attendant gets
 * 403), `/ledger/export` reaching the export and not the card, query validation, the CSV headers, and no token.
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler';
import { historyService } from './history-service';
import historyRouter from './history-routes';

vi.mock('../../../../middleware/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('x-test-user');
    if (raw) req.user = JSON.parse(raw);
    else throw Object.assign(new Error('Missing or invalid authorization header'), { statusCode: 401, code: 'AUTHENTICATION_ERROR' });
    next();
  },
}));
vi.mock('./history-service', () => ({ historyService: { list: vi.fn(), exportCsv: vi.fn(), card: vi.fn() } }));

const app = express().use(express.json()).use(historyRouter).use(errorHandler);
const as = (role: string) => ({ 'x-test-user': JSON.stringify({ id: '99999999-9999-4999-8999-999999999999', role, siteId: null }) });

const ITEM = '10000000-0000-4000-8000-000000000001';
const ROLES = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_ATTENDANT'] as const;
const READERS = ['STORE_MANAGER', 'SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER'];

type Call = { name: string; path: string; service: keyof typeof historyService };
const calls: Call[] = [
  { name: 'S3 GET /ledger', path: '/ledger', service: 'list' },
  { name: 'S4 GET /ledger/export', path: '/ledger/export', service: 'exportCsv' },
  { name: 'S5 GET /ledger/:itemId', path: `/ledger/${ITEM}`, service: 'card' },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(historyService.list).mockResolvedValue({} as never);
  vi.mocked(historyService.card).mockResolvedValue({} as never);
  vi.mocked(historyService.exportCsv).mockResolvedValue({ filename: 'stock-ledger-2026-09-14-to-2026-10-13.csv', csv: 'Item,Unit\r\n' });
});

describe('the role grid (§3.1): stock.read', () => {
  for (const call of calls) {
    describe(call.name, () => {
      it.each(READERS)('lets %s through', async (role) => {
        expect((await request(app).get(call.path).set(as(role))).status).toBe(200);
        expect(historyService[call.service]).toHaveBeenCalledTimes(1);
      });

      it.each(ROLES.filter((r) => !READERS.includes(r)))('refuses %s with 403, before any service runs', async (role) => {
        expect((await request(app).get(call.path).set(as(role))).status).toBe(403);
        expect(historyService[call.service]).not.toHaveBeenCalled();
      });

      it('is 401 with no token', async () => {
        expect((await request(app).get(call.path)).status).toBe(401);
      });
    });
  }
});

describe('S4 is registered before S5', () => {
  it('sends /ledger/export to the export and never reads "export" as an item id', async () => {
    const res = await request(app).get('/ledger/export').set(as('ACCOUNTANT'));
    expect(historyService.exportCsv).toHaveBeenCalledTimes(1);
    expect(historyService.card).not.toHaveBeenCalled();
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="stock-ledger-2026-09-14-to-2026-10-13.csv"');
    expect(res.text).toBe('Item,Unit\r\n');
  });
});

describe('query', () => {
  const manager = as('STORE_MANAGER');

  it('S3 defaults to chip all, page 1 of 50, and passes filters through', async () => {
    await request(app).get('/ledger').set(manager);
    expect(historyService.list).toHaveBeenLastCalledWith(expect.anything(), { chip: 'all', page: 1, pageSize: 50 });
    await request(app).get('/ledger?from=2026-10-01&to=2026-10-13&search=ADJ-3402&sectionId=5e000000-0000-4000-8000-000000000001&chip=waste&page=2&pageSize=25').set(manager);
    expect(historyService.list).toHaveBeenLastCalledWith(expect.anything(), {
      from: '2026-10-01', to: '2026-10-13', search: 'ADJ-3402', sectionId: '5e000000-0000-4000-8000-000000000001', chip: 'waste', page: 2, pageSize: 25,
    });
  });

  it('S5 defaults to byDay and daysWithMovement', async () => {
    await request(app).get(`/ledger/${ITEM}`).set(manager);
    expect(historyService.card).toHaveBeenLastCalledWith(expect.anything(), ITEM, { show: 'byDay', chip: 'daysWithMovement' });
  });

  it('refuses a malformed date, an unknown chip or show, a bad page size and a bad item id', async () => {
    expect((await request(app).get('/ledger?from=13-10-2026').set(manager)).status).toBe(400);
    expect((await request(app).get('/ledger?chip=everything').set(manager)).status).toBe(400);
    expect((await request(app).get('/ledger?pageSize=30').set(manager)).status).toBe(400);
    expect((await request(app).get(`/ledger/${ITEM}?show=weeks`).set(manager)).status).toBe(400);
    expect((await request(app).get('/ledger/not-a-uuid').set(manager)).status).toBe(400);
    expect(historyService.list).not.toHaveBeenCalled();
    expect(historyService.card).not.toHaveBeenCalled();
  });
});
