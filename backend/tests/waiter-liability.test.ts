import request from 'supertest';
import { Prisma, OrderStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { reportService } from '../src/services/report-service';
import { reportRepository } from '../src/repositories/report-repository';
import { branchRepository } from '../src/repositories/branch-repository';
import { signAccessToken } from '../src/utils/jwt';

const BRANCH_A = '22222222-2222-4222-8222-222222222222';
const BRANCH_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WAITER_ID = '44444444-4444-4444-8444-444444444444';
const WAITER_2_ID = '55555555-5555-4555-8555-555555555555';

const waiterToken = signAccessToken({ userId: WAITER_ID, role: 'WAITER', organizationId: BRANCH_A });
const hrToken = signAccessToken({ userId: '66666666-6666-4666-8666-666666666666', role: 'HR_MANAGER', organizationId: null });
const directorToken = signAccessToken({ userId: '33333333-3333-4333-8333-333333333333', role: 'DIRECTOR', organizationId: null });
const accountantToken = signAccessToken({ userId: '77777777-7777-4777-8777-777777777777', role: 'ACCOUNTANT', organizationId: null });
const chefToken = signAccessToken({ userId: '88888888-8888-4888-8888-888888888888', role: 'CHEF', organizationId: BRANCH_A });

type Row = Awaited<ReturnType<typeof reportRepository.getWaiterStaleLiabilities>>[number];

const makeRow = (overrides: Partial<Row>): Row => ({
  id: 'order-1',
  dailyNumber: 1,
  status: OrderStatus.READY,
  orderDate: new Date('2026-06-23T00:00:00.000Z'),
  tableNumber: '5',
  total: new Prisma.Decimal('850.00'),
  waiterId: WAITER_ID,
  waiterName: 'James Kamau',
  branchName: 'Wendo Kingz',
  ...overrides,
});

describe('Waiter stale-order liability', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Auth / RBAC ──

  it('GET /reports/my-liabilities → 401 without a token', async () => {
    const res = await request(app).get('/api/v1/reports/my-liabilities');
    expect(res.status).toBe(401);
  });

  it('GET /reports/my-liabilities → 403 for non-waiter (chef)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/my-liabilities')
      .set('Authorization', `Bearer ${chefToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /reports/waiter-liabilities → 403 for waiter', async () => {
    const res = await request(app)
      .get('/api/v1/reports/waiter-liabilities')
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(res.status).toBe(403);
  });

  // ── Waiter self-service: own list + total ──

  it('GET /reports/my-liabilities returns the waiter own orders and summed total', async () => {
    const spy = vi
      .spyOn(reportRepository, 'getWaiterStaleLiabilities')
      .mockResolvedValue([
        makeRow({ id: 'o1', dailyNumber: 12, total: new Prisma.Decimal('850.00') }),
        makeRow({ id: 'o2', dailyNumber: 18, total: new Prisma.Decimal('1200.50') }),
      ]);

    const res = await request(app)
      .get('/api/v1/reports/my-liabilities')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalOrders).toBe(2);
    expect(res.body.data.totalLiability).toBe('2050.50');
    expect(res.body.data.orders).toHaveLength(2);
    // scoped to the waiter own branch + own id
    expect(spy).toHaveBeenCalledWith([BRANCH_A], WAITER_ID);
  });

  it('returns a zeroed report when the waiter has no stale orders', async () => {
    vi.spyOn(reportRepository, 'getWaiterStaleLiabilities').mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/reports/my-liabilities')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalOrders).toBe(0);
    expect(res.body.data.totalLiability).toBe('0.00');
    expect(res.body.data.orders).toEqual([]);
  });

  // ── HR rollup: per-waiter aggregation + scoping ──

  it('HR summary rolls up multiple orders per waiter across branches', async () => {
    vi.spyOn(branchRepository, 'findActiveIds').mockResolvedValue([BRANCH_A, BRANCH_B]);
    vi.spyOn(reportRepository, 'getWaiterStaleLiabilities').mockResolvedValue([
      makeRow({ id: 'o1', waiterId: WAITER_ID, waiterName: 'James', total: new Prisma.Decimal('500.00') }),
      makeRow({ id: 'o2', waiterId: WAITER_ID, waiterName: 'James', total: new Prisma.Decimal('300.00') }),
      makeRow({ id: 'o3', waiterId: WAITER_2_ID, waiterName: 'Mary', branchName: 'Wendo Town', total: new Prisma.Decimal('1000.00') }),
    ]);

    const res = await request(app)
      .get('/api/v1/reports/waiter-liabilities')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalWaiters).toBe(2);
    expect(res.body.data.totalOrders).toBe(3);
    expect(res.body.data.totalLiability).toBe('1800.00');
    // sorted by liability desc — Mary (1000) before James (800)
    expect(res.body.data.waiters[0].waiterName).toBe('Mary');
    expect(res.body.data.waiters[0].totalLiability).toBe('1000.00');
    expect(res.body.data.waiters[1].waiterName).toBe('James');
    expect(res.body.data.waiters[1].orderCount).toBe(2);
    expect(res.body.data.waiters[1].totalLiability).toBe('800.00');
    // each rollup row carries the waiter's individual orders for the HR drill-down
    expect(res.body.data.waiters[1].orders).toHaveLength(2);
    expect(res.body.data.waiters[0].orders).toHaveLength(1);
    expect(res.body.data.waiters[0].orders[0].dailyNumber).toBe(1);
  });

  it('HR/Director without organizationId queries all active branches', async () => {
    const branchSpy = vi.spyOn(branchRepository, 'findActiveIds').mockResolvedValue([BRANCH_A, BRANCH_B]);
    const repoSpy = vi.spyOn(reportRepository, 'getWaiterStaleLiabilities').mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/reports/waiter-liabilities')
      .set('Authorization', `Bearer ${directorToken}`);

    expect(res.status).toBe(200);
    expect(branchSpy).toHaveBeenCalledTimes(1);
    expect(repoSpy).toHaveBeenCalledWith([BRANCH_A, BRANCH_B]);
  });

  it('HR with organizationId scopes to that single branch', async () => {
    const repoSpy = vi.spyOn(reportRepository, 'getWaiterStaleLiabilities').mockResolvedValue([]);

    const res = await request(app)
      .get(`/api/v1/reports/waiter-liabilities?organizationId=${BRANCH_B}`)
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(repoSpy).toHaveBeenCalledWith([BRANCH_B]);
  });

  it('ACCOUNTANT must pass organizationId → 400 when omitted', async () => {
    const res = await request(app)
      .get('/api/v1/reports/waiter-liabilities')
      .set('Authorization', `Bearer ${accountantToken}`);

    expect(res.status).toBe(400);
  });

  it('rejects an invalid organizationId query param (Zod)', async () => {
    const res = await request(app)
      .get('/api/v1/reports/waiter-liabilities?organizationId=not-a-uuid')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(400);
  });
});
