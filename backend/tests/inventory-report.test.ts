import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { inventoryReportService } from '../src/services/inventory-report-service';
import { signAccessToken } from '../src/utils/jwt';

const organizationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const managerToken = signAccessToken({
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'STORE_MANAGER',
  organizationId,
});

const attendantToken = signAccessToken({
  userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  role: 'STORE_ATTENDANT',
  organizationId,
});

const locationId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';

type RouteCase = {
  name: string;
  path: string;
  serviceMethod: keyof typeof inventoryReportService;
};

const routes: RouteCase[] = [
  {
    name: 'stock valuation',
    path: `/api/v1/inventory-reports/stock-valuation?locationId=${locationId}`,
    serviceMethod: 'getStockValuation',
  },
  {
    name: 'low-stock alerts',
    path: `/api/v1/inventory-reports/low-stock-alerts?locationId=${locationId}`,
    serviceMethod: 'getLowStockAlerts',
  },
  {
    name: 'price history',
    path: `/api/v1/inventory-reports/price-history?inventoryItemId=${itemId}`,
    serviceMethod: 'getPriceHistory',
  },
  {
    name: 'prep yield',
    path: '/api/v1/inventory-reports/prep-yield',
    serviceMethod: 'getPrepYield',
  },
  {
    name: 'count discrepancy',
    path: '/api/v1/inventory-reports/count-discrepancy',
    serviceMethod: 'getCountDiscrepancy',
  },
  {
    name: 'true cost per prepped item',
    path: '/api/v1/inventory-reports/prepped-item-cost',
    serviceMethod: 'getTrueCostPerPreppedItem',
  },
  {
    name: 'supplier AP aging',
    path: '/api/v1/inventory-reports/supplier-ap-aging',
    serviceMethod: 'getSupplierApAging',
  },
];

describe('Inventory report routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe.each(routes)('$name', ({ path, serviceMethod }) => {
    it('returns 200 for a Store Manager (happy path)', async () => {
      vi.spyOn(inventoryReportService, serviceMethod).mockResolvedValue([] as never);

      const res = await request(app).get(path).set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: [] });
      expect(inventoryReportService[serviceMethod]).toHaveBeenCalled();
    });

    it('returns 403 for a Store Attendant (Manager-only per §8.3)', async () => {
      const spy = vi.spyOn(inventoryReportService, serviceMethod);

      const res = await request(app).get(path).set('Authorization', `Bearer ${attendantToken}`);

      expect(res.status).toBe(403);
      expect(spy).not.toHaveBeenCalled();
    });

    it('returns 401 with no token', async () => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    });
  });
});
