import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { locationRepository } from '../../../../repositories/location-repository';
import { ForbiddenError } from '../../../../utils/errors';
import { needsRestockingRepository } from './needs-restocking-repository';
import needsRestockingRouter from './needs-restocking-routes';
import { needsRestockingService } from './needs-restocking-service';

vi.mock('./needs-restocking-repository', () => ({
  needsRestockingRepository: { findBelowLevel: vi.fn(), findStockForItems: vi.fn(), findSupplierLines: vi.fn(), findLinesForSupplier: vi.fn(), findOrderableSuppliers: vi.fn() },
}));
vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../repositories/location-repository', () => ({ locationRepository: { findCentralStore: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));
vi.mock('../../../../middleware/authenticate', () => ({ authenticate: (_req: unknown, _res: unknown, next: () => void) => next() }));

const D = (v: number) => new Prisma.Decimal(v);
const HUB = 'hub-1';
const attendant = { id: 'att', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const manager = { id: 'sm', role: 'STORE_MANAGER', siteId: HUB } as never;
const branchAttendant = { id: 'ba', role: 'STORE_ATTENDANT', siteId: 'branch-9' } as never;
const branchManager = { id: 'bm', role: 'MANAGER', siteId: 'branch-9' } as never; // Branch Manager reads the hub from a branch

const samrat = { id: 's1', name: 'Samrat', code: 'SUPPLIER-0001', type: 'REGULAR' as const, defaultPaymentTerms: 'INVOICE_TO_FOLLOW' as const, paymentDays: 14 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue({ id: 'loc-1', siteId: HUB } as never);
  vi.mocked(needsRestockingRepository.findBelowLevel).mockResolvedValue([
    { id: 'sugar', name: 'Sugar', category: 'Dry goods', usageUnit: 'kg', buyUnit: 'kg', packSize: null, preferredSupplierId: null, onHand: D(18), level: D(100) },
  ]);
  vi.mocked(needsRestockingRepository.findSupplierLines).mockResolvedValue([
    { inventoryItemId: 'sugar', buyUnit: 'kg', packSize: null, lastPrice: D(168), lastPriceAt: null, isPreferred: true, supplier: samrat },
  ]);
  vi.mocked(needsRestockingRepository.findOrderableSuppliers).mockResolvedValue([samrat]);
});

describe('getNeeds and the blind rule', () => {
  it('gives the Store Manager the stock figures', async () => {
    const r = await needsRestockingService.getNeeds(manager, {});
    expect(r.groups[0]?.lines[0]).toMatchObject({ onHand: '18', level: '100', suggestedQty: '82' });
  });

  it('gives the Attendant the list and prices but no on-hand or level', async () => {
    const r = await needsRestockingService.getNeeds(attendant, {});
    const l = r.groups[0]?.lines[0];
    expect(l).toMatchObject({ itemName: 'Sugar', status: 'LOW', lastPrice: '168.00', estimatedTotal: '13776.00', suggestedQty: '82' });
    expect(JSON.stringify(r)).not.toMatch(/"onHand"|"level"/);
  });

  it('asks the repository for the hub and the Central Store location only', async () => {
    await needsRestockingService.getNeeds(manager, { q: 'sug' });
    expect(needsRestockingRepository.findBelowLevel).toHaveBeenCalledWith({ siteId: HUB, locationId: 'loc-1' }, 'sug');
    expect(needsRestockingRepository.findSupplierLines).toHaveBeenCalledWith(HUB, ['sugar']);
  });

  it('lets the Branch Manager read the hub list from a branch (read-any-org)', async () => {
    await expect(needsRestockingService.getNeeds(branchManager, {})).resolves.toMatchObject({ itemCount: 1 });
  });

  it('refuses an Attendant who sits outside the hub (D-15)', async () => {
    await expect(needsRestockingService.getNeeds(branchAttendant, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(needsRestockingRepository.findBelowLevel).not.toHaveBeenCalled();
  });

  it('counts the same list for the tab badge', async () => {
    await expect(needsRestockingService.countNeeds(manager)).resolves.toBe(1);
  });
});

describe('getCatalog and the blind rule', () => {
  beforeEach(() => {
    vi.mocked(needsRestockingRepository.findLinesForSupplier).mockResolvedValue([
      {
        inventoryItemId: 'sugar',
        buyUnit: 'kg',
        packSize: null,
        lastPrice: D(168),
        lastPriceAt: null,
        isPreferred: false,
        supplier: samrat,
        item: { id: 'sugar', name: 'Sugar', category: 'Dry goods', usageUnit: 'kg', buyUnit: 'kg', packSize: null },
      },
    ]);
    vi.mocked(needsRestockingRepository.findStockForItems).mockResolvedValue([{ inventoryItemId: 'sugar', onHand: D(18), level: D(100) }]);
  });

  it('gives the Manager on-hand and level and the Attendant price and quantity only', async () => {
    const m = await needsRestockingService.getCatalog(manager, { supplierId: 's1' });
    expect(m.items[0]).toMatchObject({ onHand: '18', level: '100', price: '168.00', qty: '82' });
    const a = await needsRestockingService.getCatalog(attendant, { supplierId: 's1' });
    expect(a.items[0]).toMatchObject({ price: '168.00', qty: '82', status: 'LOW' });
    expect(JSON.stringify(a)).not.toMatch(/"onHand"|"level"/);
  });
});

// Route capability matrix, read off the router the way the suppliers contract test does.
type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] } };
const ROLES = ['SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER', 'MANAGER', 'ACCOUNTANT', 'WAITER', 'CHEF', 'STORE_MANAGER', 'STORE_ATTENDANT', 'DEPARTMENT_HEAD'];
const allowedRoles = (path: string): string[] => {
  const layer = (needsRestockingRouter.stack as unknown as Layer[]).find((l) => l.route?.path === path && l.route.methods['get']);
  if (!layer?.route) throw new Error(`route not found: ${path}`);
  const guard = layer.route.stack[0]!.handle;
  return ROLES.filter((role) => {
    const next = vi.fn() as unknown as NextFunction;
    try {
      guard({ user: { id: 'u', role, siteId: HUB } } as Request, {} as Response, next);
    } catch {
      return false;
    }
    return vi.mocked(next).mock.calls.length === 1;
  }).sort();
};

describe('route capability matrix', () => {
  it('GET /needs-restocking: every desktop role and the Store Attendant (orders.read or orders.request)', () => {
    expect(allowedRoles('/needs-restocking')).toEqual(['ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'STORE_ATTENDANT', 'STORE_MANAGER', 'SYSTEM_ADMIN']);
  });
  it('GET /catalog: only who may raise an order (orders.request)', () => {
    expect(allowedRoles('/catalog')).toEqual(['STORE_ATTENDANT', 'STORE_MANAGER', 'SYSTEM_ADMIN']);
  });
  it('refuses a waiter, a chef, HR and a department head on both', () => {
    for (const role of ['WAITER', 'CHEF', 'HR_MANAGER', 'DEPARTMENT_HEAD']) {
      expect(allowedRoles('/needs-restocking')).not.toContain(role);
      expect(allowedRoles('/catalog')).not.toContain(role);
    }
  });
});
