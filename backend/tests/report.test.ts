import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { reportService } from '../src/services/report-service';
import { signAccessToken } from '../src/utils/jwt';
import { ValidationError } from '../src/utils/errors';

const managerToken = signAccessToken({
  userId: '11111111-1111-4111-8111-111111111111',
  role: 'MANAGER',
  organizationId: '22222222-2222-4222-8222-222222222222',
});

const directorToken = signAccessToken({
  userId: '33333333-3333-4333-8333-333333333333',
  role: 'DIRECTOR',
  organizationId: null,
});

const waiterToken = signAccessToken({
  userId: '44444444-4444-4444-8444-444444444444',
  role: 'WAITER',
  organizationId: '22222222-2222-4222-8222-222222222222',
});

describe('Report routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/reports/daily-summary returns summary totals', async () => {
    vi.spyOn(reportService, 'getDailySummary').mockResolvedValue({
      date: '2026-02-24',
      organizationId: '22222222-2222-4222-8222-222222222222',
      organizationName: 'Wendo Kingz',
      totalRevenue: '48500.00',
      orderCount: 43,
      ordersByType: {
        DINE_IN: 28,
        TAKE_AWAY: 11,
        DELIVERY: 4,
      },
      revenueByPaymentMethod: {
        MPESA: '35000.00',
        CASH: '10500.00',
        CARD: '3000.00',
      },
      topItems: [],
      averagePrepTimeMinutes: {
        KITCHEN: 14,
        BARISTA: 6,
      },
    });

    const response = await request(app)
      .get('/api/v1/reports/daily-summary?date=2026-02-24')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totalRevenue).toBe('48500.00');
    expect(response.body.data.orderCount).toBe(43);
  });

  it('GET /api/v1/reports/daily-summary allows director scoped branch query', async () => {
    vi.spyOn(reportService, 'getDailySummary').mockResolvedValue({
      date: '2026-02-24',
      organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      organizationName: 'Wendo Town',
      totalRevenue: '1200.00',
      orderCount: 2,
      ordersByType: {
        DINE_IN: 1,
        TAKE_AWAY: 1,
        DELIVERY: 0,
      },
      revenueByPaymentMethod: {
        MPESA: '700.00',
        CASH: '500.00',
        CARD: '0.00',
      },
      topItems: [],
      averagePrepTimeMinutes: {
        KITCHEN: 10,
        BARISTA: 5,
      },
    });

    const response = await request(app)
      .get('/api/v1/reports/daily-summary?date=2026-02-24&organizationId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .set('Authorization', `Bearer ${directorToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.organizationId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('GET /api/v1/reports/daily-summary returns 400 when director omits organizationId', async () => {
    vi.spyOn(reportService, 'getDailySummary').mockRejectedValue(
      new ValidationError('organizationId query param is required for directors'),
    );

    const response = await request(app)
      .get('/api/v1/reports/daily-summary?date=2026-02-24')
      .set('Authorization', `Bearer ${directorToken}`);

    expect(response.status).toBe(400);
  });

  it('GET /api/v1/reports/my-performance is scoped to authenticated user', async () => {
    const spy = vi.spyOn(reportService, 'getMyPerformance').mockImplementation(async (actor) => {
      expect(actor.id).toBe('44444444-4444-4444-8444-444444444444');
      return {
        role: 'WAITER',
        period: {
          startDate: '2026-02-01',
          endDate: '2026-02-24',
        },
        ordersHandled: 20,
        averageOrderValue: '850.00',
        totalRevenueGenerated: '17000.00',
        busiestDay: '2026-02-22',
        ordersOverTime: [],
        topItems: [],
      };
    });

    const response = await request(app)
      .get('/api/v1/reports/my-performance?startDate=2026-02-01&endDate=2026-02-24&userId=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe('WAITER');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('GET /api/v1/reports/staff-performance returns report rows', async () => {
    vi.spyOn(reportService, 'getStaffPerformance').mockResolvedValue({
      period: {
        startDate: '2026-02-01',
        endDate: '2026-02-24',
      },
      organizationId: '22222222-2222-4222-8222-222222222222',
      organizationName: 'Wendo Kingz',
      staff: [
        {
          id: 'staff-1',
          name: 'James Kamau',
          role: 'WAITER',
          ordersHandled: 32,
          averageOrderValue: '1000.00',
          averagePrepTimeMinutes: null,
          scheduledHours: 80,
          actualHours: 78.5,
        },
      ],
    });

    const response = await request(app)
      .get('/api/v1/reports/staff-performance?startDate=2026-02-01&endDate=2026-02-24')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.staff).toHaveLength(1);
    expect(response.body.data.staff[0].ordersHandled).toBe(32);
  });

  it('GET /api/v1/reports/branch-overview returns 403 for manager and 200 for director', async () => {
    vi.spyOn(reportService, 'getBranchOverview').mockResolvedValue({
      period: {
        startDate: '2026-02-01',
        endDate: '2026-02-24',
      },
      totalRevenue: '250000.00',
      totalOrders: 210,
      branches: [],
    });

    const managerResponse = await request(app)
      .get('/api/v1/reports/branch-overview?startDate=2026-02-01&endDate=2026-02-24')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(managerResponse.status).toBe(403);

    const directorResponse = await request(app)
      .get('/api/v1/reports/branch-overview?startDate=2026-02-01&endDate=2026-02-24')
      .set('Authorization', `Bearer ${directorToken}`);

    expect(directorResponse.status).toBe(200);
    expect(directorResponse.body.data.totalOrders).toBe(210);
  });

  it('GET /api/v1/reports/export returns csv attachment', async () => {
    vi.spyOn(reportService, 'exportReport').mockResolvedValue({
      buffer: Buffer.from('name,orders\nJames,10', 'utf-8'),
      filename: 'staff-performance.csv',
      contentType: 'text/csv; charset=utf-8',
    });

    const response = await request(app)
      .get('/api/v1/reports/export?reportType=staff_performance&format=csv&startDate=2026-02-01&endDate=2026-02-24')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.header['content-disposition']).toContain('attachment; filename="staff-performance.csv"');
    expect(response.header['content-type']).toContain('text/csv');
  });

  it('GET /api/v1/reports/export returns pdf attachment', async () => {
    vi.spyOn(reportService, 'exportReport').mockResolvedValue({
      buffer: Buffer.from('%PDF-1.3', 'utf-8'),
      filename: 'branch-overview.pdf',
      contentType: 'application/pdf',
    });

    const response = await request(app)
      .get('/api/v1/reports/export?reportType=branch_overview&format=pdf&startDate=2026-02-01&endDate=2026-02-24')
      .set('Authorization', `Bearer ${directorToken}`);

    expect(response.status).toBe(200);
    expect(response.header['content-disposition']).toContain('attachment; filename="branch-overview.pdf"');
    expect(response.header['content-type']).toContain('application/pdf');
  });
});

