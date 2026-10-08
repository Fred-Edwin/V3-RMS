import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../repositories/branch-repository';
import { auditLogRepository } from './audit-log-repository';
import { auditLogService } from './audit-log-service';
import { AuditLogQuerySchema } from './audit-log-validators';
import { stockAdjustmentsSource } from './sources/stock-adjustments-source';
import { requisitionsSource } from './sources/requisitions-source';
import { stockCountsSource } from './sources/stock-counts-source';
import { wasteSource } from './sources/waste-source';

vi.mock('../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn(), findActiveBranchOptions: vi.fn() } }));
vi.mock('./audit-log-repository', () => ({
  auditLogRepository: {
    itemChanges: vi.fn(),
    countItemChanges: vi.fn(),
    supplierAudits: vi.fn(),
    countSupplierAudits: vi.fn(),
    suppliersCreated: vi.fn(),
    countSuppliersCreated: vi.fn(),
    restockChanges: vi.fn(),
    countRestockChanges: vi.fn(),
    purchasingEntries: vi.fn(),
    countPurchasingEntries: vi.fn(),
    recipeVersions: vi.fn(),
    countRecipeVersions: vi.fn(),
    runEntries: vi.fn(),
    countRunEntries: vi.fn(),
    itemNames: vi.fn(),
    userNames: vi.fn(),
    actorIds: vi.fn(),
  },
}));

vi.mock('./sources/stock-counts-source', () => ({ stockCountsSource: { area: 'STOCK_COUNTS', entries: vi.fn(), count: vi.fn(), actorIds: vi.fn() } }));
vi.mock('./sources/requisitions-source', () => ({ requisitionsSource: { area: 'REQUISITIONS', entries: vi.fn(), count: vi.fn(), actorIds: vi.fn() } }));
vi.mock('./sources/waste-source', () => ({ wasteSource: { area: 'WASTE', entries: vi.fn(), count: vi.fn(), actorIds: vi.fn() } }));
vi.mock('./sources/stock-adjustments-source', () => ({ stockAdjustmentsSource: { area: 'STOCK_ADJUSTMENTS', entries: vi.fn(), count: vi.fn(), actorIds: vi.fn() } }));

const hubId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const sm = { id: 'u1', role: 'STORE_MANAGER', siteId: hubId } as never;
const outsider = { id: 'u2', role: 'STORE_MANAGER', siteId: branchId } as never;
const query = (over: Record<string, unknown> = {}) => AuditLogQuerySchema.parse({ ...over });

const at = (hh: string) => new Date(`2026-10-03T${hh}:00.000Z`);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubId } as never);
  vi.mocked(branchRepository.findActiveBranchOptions).mockResolvedValue([{ id: branchId, name: 'Nyeri Town' }]);
  vi.mocked(auditLogRepository.itemChanges).mockResolvedValue([
    { id: 'i1', kind: 'RETIRED', summary: 'retired the item', reason: 'Added twice. Replaced by Brown sugar.', createdAt: at('11:02'), changedBy: { id: 'u1', name: 'Isabel' }, inventoryItem: { name: 'Sugar, brown' } },
  ] as never);
  vi.mocked(auditLogRepository.supplierAudits).mockResolvedValue([
    { id: 's1', action: 'STATUS_CHANGED', before: { status: 'ACTIVE' }, after: { status: 'ARCHIVED', reason: 'Closed down.' }, createdAt: at('11:15'), actor: { id: 'u1', name: 'Isabel' }, supplier: { name: 'Samrat' } },
  ] as never);
  vi.mocked(auditLogRepository.suppliersCreated).mockResolvedValue([{ id: 'c1', name: 'Kagumo', code: 'SUPPLIER-0008', createdAt: at('10:30'), createdById: 'u1' }] as never);
  vi.mocked(auditLogRepository.restockChanges).mockResolvedValue([
    {
      id: 'r1', oldLevel: { toString: () => '12.0000' }, newLevel: { toString: () => '14.0000' }, reason: null, createdAt: at('10:48'),
      changedBy: { id: 'u3', name: 'Frederick' }, inventoryItem: { name: 'Chapati dough', usageUnit: 'kg' },
      location: { type: 'BRANCH_DEPARTMENT', departmentTag: 'KITCHEN', site: { name: 'Nyeri Town' } },
    },
  ] as never);
  vi.mocked(auditLogRepository.countItemChanges).mockResolvedValue(1);
  vi.mocked(auditLogRepository.countSupplierAudits).mockResolvedValue(1);
  vi.mocked(auditLogRepository.countSuppliersCreated).mockResolvedValue(1);
  vi.mocked(auditLogRepository.countRestockChanges).mockResolvedValue(1);
  vi.mocked(auditLogRepository.purchasingEntries).mockResolvedValue([]);
  vi.mocked(auditLogRepository.countPurchasingEntries).mockResolvedValue(0);
  vi.mocked(auditLogRepository.recipeVersions).mockResolvedValue([]);
  vi.mocked(auditLogRepository.countRecipeVersions).mockResolvedValue(0);
  vi.mocked(auditLogRepository.runEntries).mockResolvedValue([]);
  vi.mocked(auditLogRepository.countRunEntries).mockResolvedValue(0);
  vi.mocked(auditLogRepository.itemNames).mockResolvedValue(new Map());
  vi.mocked(auditLogRepository.userNames).mockResolvedValue(new Map([['u1', 'Isabel'], ['u3', 'Frederick']]));
  vi.mocked(auditLogRepository.actorIds).mockResolvedValue(['u3', 'u1']);
  for (const source of [stockCountsSource, wasteSource, stockAdjustmentsSource, requisitionsSource]) {
    vi.mocked(source.entries).mockResolvedValue([]);
    vi.mocked(source.count).mockResolvedValue(0);
    vi.mocked(source.actorIds).mockResolvedValue([]);
  }
});

describe('auditLogService.list', () => {
  it('merges the sources newest first with who, what and why', async () => {
    const page = await auditLogService.list(sm, query());
    expect(page.entries.map((e) => e.id)).toEqual(['supplier:s1', 'item:i1', 'restock:r1', 'created:c1']);
    expect(page.entries[0]).toMatchObject({ area: 'SUPPLIERS', what: 'Samrat: archived', reason: 'Closed down.', actor: { name: 'Isabel' } });
    expect(page.entries[1]).toMatchObject({ area: 'CATALOG', what: 'Retired Sugar, brown', reason: 'Added twice. Replaced by Brown sugar.' });
    expect(page.entries[2]).toMatchObject({ area: 'RESTOCK_LEVELS', what: 'Kitchen · Nyeri Town: Chapati dough 12 → 14 kg', reason: null });
    expect(page.pagination).toEqual({ total: 4, page: 1, perPage: 50, totalPages: 1 });
    expect(page.actors).toEqual([{ id: 'u3', name: 'Frederick' }, { id: 'u1', name: 'Isabel' }]);
  });

  it('scopes every read to the hub, and restock reads to the hub and its branches', async () => {
    await auditLogService.list(sm, query());
    const scope = { hubId, restockOrgIds: [hubId, branchId], peopleOrgIds: [hubId, branchId] };
    expect(auditLogRepository.itemChanges).toHaveBeenCalledWith(scope, expect.anything(), 50);
    expect(auditLogRepository.restockChanges).toHaveBeenCalledWith(scope, expect.anything(), 50);
    expect(auditLogRepository.userNames).toHaveBeenCalledWith(scope, expect.any(Array));
  });

  it('reads only the area asked for', async () => {
    await auditLogService.list(sm, query({ area: 'CATALOG' }));
    expect(auditLogRepository.itemChanges).toHaveBeenCalled();
    expect(auditLogRepository.supplierAudits).not.toHaveBeenCalled();
    expect(auditLogRepository.restockChanges).not.toHaveBeenCalled();
  });

  it('cuts the merged list to the page asked for', async () => {
    const second = await auditLogService.list(sm, query({ perPage: 2, page: 2 }));
    expect(second.entries.map((e) => e.id)).toEqual(['restock:r1', 'created:c1']);
    expect(auditLogRepository.itemChanges).toHaveBeenCalledWith(expect.anything(), expect.anything(), 4);
    expect(second.pagination.totalPages).toBe(2);
  });

  it('adds Purchasing and Payments rows with the purchase file they belong to', async () => {
    vi.mocked(auditLogRepository.purchasingEntries).mockResolvedValue([
      {
        id: 'p1', area: 'PAYMENTS', action: 'Recorded payment', document: 'PAY-0031', detail: 'KES 12,000 by M-Pesa', what: 'Paid KES 12,000 on LPO-0044',
        at: at('12:00'), actor: { id: 'u4', name: 'Grace', role: 'ACCOUNTANT' }, order: { id: 'o1', reference: 'LPO-0044' }, supplier: { name: 'Samrat' },
      },
    ] as never);
    vi.mocked(auditLogRepository.countPurchasingEntries).mockResolvedValue(1);
    const page = await auditLogService.list(sm, query());
    expect(page.entries[0]).toMatchObject({
      id: 'purchasing:p1',
      area: 'PAYMENTS',
      what: 'Paid KES 12,000 on LPO-0044',
      actor: { id: 'u4', name: 'Grace', role: 'ACCOUNTANT' },
      purchasing: { action: 'Recorded payment', document: 'PAY-0031', detail: 'KES 12,000 by M-Pesa', orderId: 'o1', orderReference: 'LPO-0044', supplierName: 'Samrat' },
    });
    expect(page.pagination.total).toBe(5);
    expect(auditLogRepository.purchasingEntries).toHaveBeenCalledWith({ hubId, restockOrgIds: [hubId, branchId], peopleOrgIds: [hubId, branchId] }, expect.anything(), ['PURCHASING', 'PAYMENTS'], 50);
  });

  it('reads only the Payments rows when that area is asked for', async () => {
    await auditLogService.list(sm, query({ area: 'PAYMENTS' }));
    expect(auditLogRepository.purchasingEntries).toHaveBeenCalledWith(expect.anything(), expect.anything(), ['PAYMENTS'], 50);
    expect(auditLogRepository.itemChanges).not.toHaveBeenCalled();
  });

  it('derives Recipe set and Recipe changed entries (area PREP) from the recipe version rows', async () => {
    vi.mocked(auditLogRepository.recipeVersions).mockResolvedValue([
      { id: 'v2', version: 2, reason: 'PORTION_SIZE_CHANGED', reasonNote: null, createdAt: at('13:00'), createdBy: { id: 'u1', name: 'Isabel' }, recipe: { outputItem: { name: 'Fried chicken' } } },
      { id: 'v3', version: 3, reason: 'OTHER', reasonNote: 'Client asked for less salt', createdAt: at('13:30'), createdBy: { id: 'u1', name: 'Isabel' }, recipe: { outputItem: { name: 'Fried chicken' } } },
      { id: 'v1', version: 1, reason: null, reasonNote: null, createdAt: at('12:30'), createdBy: { id: 'u1', name: 'Isabel' }, recipe: { outputItem: { name: 'Fried chicken' } } },
    ] as never);
    vi.mocked(auditLogRepository.countRecipeVersions).mockResolvedValue(3);
    const page = await auditLogService.list(sm, query({ area: 'PREP' }));
    expect(page.entries.map((e) => e.id)).toEqual(['recipe:v3', 'recipe:v2', 'recipe:v1']);
    expect(page.entries[0]).toMatchObject({ area: 'PREP', what: 'Recipe changed for Fried chicken', reason: 'Client asked for less salt' });
    expect(page.entries[1]).toMatchObject({ what: 'Recipe changed for Fried chicken', reason: 'Portion size changed' });
    expect(page.entries[2]).toMatchObject({ what: 'Recipe set for Fried chicken', reason: null, actor: { name: 'Isabel' } });
    expect(page.pagination.total).toBe(3);
    expect(auditLogRepository.itemChanges).not.toHaveBeenCalled();
    expect(auditLogRepository.recipeVersions).toHaveBeenCalledWith({ hubId, restockOrgIds: [hubId, branchId], peopleOrgIds: [hubId, branchId] }, expect.anything(), 50);
  });

  it('derives Recorded, Corrected, Cancelled and Reviewed entries (area PREP) from the run columns', async () => {
    const run = (over: Record<string, unknown>) => ({
      id: 'r1', reference: 'PREP-0130', actualYield: { toString: () => '38' }, createdAt: at('08:00'), closedAt: null, reviewedAt: null,
      correctionReason: null, cancelReason: null, reasonNote: null, outputItem: { name: 'Marinated chicken', usageUnit: 'portions' },
      createdBy: { id: 'u3', name: 'Frederick' }, closedBy: null, reviewedBy: null, ...over,
    });
    vi.mocked(auditLogRepository.runEntries).mockImplementation(((_scope: unknown, _filter: unknown, kind: string) => {
      if (kind === 'RECORDED') return Promise.resolve([run({})]);
      if (kind === 'CORRECTED') return Promise.resolve([run({ id: 'r2', reference: 'PREP-0131', createdAt: at('09:00'), correctionReason: 'TYPO' })]);
      if (kind === 'CANCELLED') return Promise.resolve([run({ id: 'r3', reference: 'PREP-0129', closedAt: at('10:00'), closedBy: { id: 'u1', name: 'Isabel' }, cancelReason: 'OTHER', reasonNote: 'Wrong day' })]);
      return Promise.resolve([run({ id: 'r4', reviewedAt: at('11:00'), reviewedBy: { id: 'u1', name: 'Isabel' } })]);
    }) as never);
    vi.mocked(auditLogRepository.countRunEntries).mockResolvedValue(1);
    const page = await auditLogService.list(sm, query({ area: 'PREP' }));
    expect(page.entries.map((e) => e.id)).toEqual(['run:reviewed:r4', 'run:cancelled:r3', 'run:corrected:r2', 'run:recorded:r1']);
    expect(page.entries[3]).toMatchObject({ area: 'PREP', what: 'Recorded PREP-0130 · Marinated chicken 38 portions', actor: { name: 'Frederick' }, reason: null });
    expect(page.entries[2]).toMatchObject({ what: 'Corrected PREP-0131 · Marinated chicken 38 portions', reason: 'Typo', actor: { name: 'Frederick' } });
    expect(page.entries[1]).toMatchObject({ what: 'Cancelled PREP-0129 · Marinated chicken 38 portions', reason: 'Wrong day', actor: { name: 'Isabel' } });
    expect(page.entries[0]).toMatchObject({ what: 'Reviewed PREP-0130 · Marinated chicken 38 portions', actor: { name: 'Isabel' } });
    expect(page.pagination.total).toBe(4);
  });

  it('leaves the run entries out when another area is asked for', async () => {
    await auditLogService.list(sm, query({ area: 'CATALOG' }));
    expect(auditLogRepository.runEntries).not.toHaveBeenCalled();
  });

  it('merges the derived areas (Stock counts, Waste, Stock adjustments) with the record link each carries', async () => {
    vi.mocked(stockCountsSource.entries).mockResolvedValue([
      { id: 'count:approved:c9', at: at('14:00').toISOString(), actor: { id: 'u1', name: 'Isabel' }, area: 'STOCK_COUNTS', what: 'Approved the count · 2 adjustments, net −KES 300 · signed with PIN', reason: null, record: { kind: 'COUNT', id: 'c9', label: 'CNT-2026-1013' } },
    ]);
    vi.mocked(wasteSource.entries).mockResolvedValue([
      { id: 'waste:logged:w1', at: at('14:30').toISOString(), actor: { id: 'u5', name: 'Peter' }, area: 'WASTE', what: 'Logged waste · Milk 6 L · Spoiled · KES 600', reason: null, record: { kind: 'STOCK_CARD', id: 'i9', label: 'Stock ledger entry', day: '2026-10-03' } },
    ]);
    vi.mocked(stockAdjustmentsSource.entries).mockResolvedValue([
      { id: 'adjustment:a1', at: at('14:15').toISOString(), actor: { id: 'u1', name: 'Isabel' }, area: 'STOCK_ADJUSTMENTS', what: 'Posted a movement · Eggs −2 trays', reason: null, record: { kind: 'LEDGER_SEARCH', id: 'ADJ-0042', label: 'ADJ-0042', day: '2026-10-03' } },
    ]);
    vi.mocked(stockCountsSource.count).mockResolvedValue(2);
    vi.mocked(wasteSource.count).mockResolvedValue(3);
    vi.mocked(stockAdjustmentsSource.count).mockResolvedValue(4);
    vi.mocked(wasteSource.actorIds).mockResolvedValue(['u5']);
    vi.mocked(auditLogRepository.userNames).mockResolvedValue(new Map([['u1', 'Isabel'], ['u3', 'Frederick'], ['u5', 'Peter']]));
    const page = await auditLogService.list(sm, query());
    expect(page.entries.slice(0, 3).map((e) => e.id)).toEqual(['waste:logged:w1', 'adjustment:a1', 'count:approved:c9']);
    expect(page.entries[0]?.record).toEqual({ kind: 'STOCK_CARD', id: 'i9', label: 'Stock ledger entry', day: '2026-10-03' });
    expect(page.pagination.total).toBe(4 + 2 + 3 + 4);
    expect(page.actors.map((a) => a.name)).toEqual(['Frederick', 'Isabel', 'Peter']);
  });

  it('reads only the derived area asked for', async () => {
    await auditLogService.list(sm, query({ area: 'WASTE' }));
    expect(wasteSource.entries).toHaveBeenCalledTimes(1);
    expect(stockCountsSource.entries).not.toHaveBeenCalled();
    expect(stockAdjustmentsSource.entries).not.toHaveBeenCalled();
    expect(auditLogRepository.itemChanges).not.toHaveBeenCalled();
  });

  describe('REQUISITIONS (branch-site source, Block 1)', () => {
    const bm = { id: 'm1', role: 'MANAGER', siteId: branchId } as never;
    const otherBm = { id: 'm2', role: 'MANAGER', siteId: '44444444-4444-4444-8444-444444444444' } as never;
    const entry = {
      id: 'requisition:e1', at: at('12:00').toISOString(), actor: { id: 'm1', name: 'Mary', role: 'Branch Manager' }, area: 'REQUISITIONS' as const,
      what: 'Approved REQ-NYR-0112 · 40 lines · signed with PIN', reason: null, record: { kind: 'REQUISITION' as const, id: 'r1', label: 'REQ-NYR-0112' },
    };

    it('a hub role reads every branch: the source gets the hub scope with no branch, and its rows are merged in', async () => {
      vi.mocked(requisitionsSource.entries).mockResolvedValue([entry]);
      vi.mocked(requisitionsSource.count).mockResolvedValue(1);
      const page = await auditLogService.list(sm, query({ area: 'REQUISITIONS' }));
      expect(requisitionsSource.entries).toHaveBeenCalledWith({ hubId, restockOrgIds: [hubId, branchId], peopleOrgIds: [hubId, branchId] }, expect.anything(), 50);
      expect(page.entries[0]).toMatchObject({ area: 'REQUISITIONS', what: 'Approved REQ-NYR-0112 · 40 lines · signed with PIN', record: { kind: 'REQUISITION', label: 'REQ-NYR-0112' } });
      expect(page.pagination.total).toBe(1);
    });

    it('the Branch filter keeps the source and still drops the hub\'s own areas', async () => {
      await auditLogService.list(sm, query({ branchId }));
      expect(requisitionsSource.entries).toHaveBeenCalledWith(expect.objectContaining({ branchId }), expect.anything(), 50);
      expect(wasteSource.entries).not.toHaveBeenCalled();
    });

    it('the Branch filter lists the people of the branch sources in the Who list, not the hub\'s', async () => {
      vi.mocked(requisitionsSource.actorIds).mockResolvedValue(['u1']);
      vi.mocked(wasteSource.actorIds).mockResolvedValue(['u5']);
      await auditLogService.list(sm, query({ branchId }));
      expect(requisitionsSource.actorIds).toHaveBeenCalled();
      expect(wasteSource.actorIds).not.toHaveBeenCalled();
    });

    it('a Branch Manager reads their own branch only: the scope is forced to it and the hub areas answer nothing', async () => {
      await auditLogService.list(bm, query());
      expect(requisitionsSource.entries).toHaveBeenCalledWith({ hubId, restockOrgIds: [branchId], peopleOrgIds: [branchId], branchId }, expect.anything(), 50);
      expect(auditLogRepository.itemChanges).not.toHaveBeenCalled();
      expect(wasteSource.entries).not.toHaveBeenCalled();
    });

    it('a Branch Manager naming another branch is refused (403), and so is one with no branch', async () => {
      await expect(auditLogService.list(bm, query({ branchId: '33333333-3333-4333-8333-333333333333' }))).rejects.toMatchObject({ statusCode: 403 });
      await expect(auditLogService.list({ id: 'm3', role: 'MANAGER', siteId: null } as never, query())).rejects.toMatchObject({ statusCode: 403 });
      expect(requisitionsSource.entries).not.toHaveBeenCalled();
    });

    it('a Branch Manager whose branch is not active gets BRANCH_NOT_FOUND, never another branch', async () => {
      await expect(auditLogService.list(otherBm, query())).rejects.toMatchObject({ code: 'BRANCH_NOT_FOUND' });
    });
  });

  it('lists the Branches areas and answers them with nothing until each block adds its source', async () => {
    for (const area of ['DISPATCH', 'DISCREPANCIES', 'BRANCH_DAY', 'BRANCH_WASTE'] as const) {
      const page = await auditLogService.list(sm, query({ area }));
      expect(page.entries).toEqual([]);
      expect(page.pagination.total).toBe(0);
    }
    expect(auditLogRepository.itemChanges).not.toHaveBeenCalled();
  });

  it('with the Branch filter on, reads only that branch’s restock changes and none of the hub’s own areas', async () => {
    await auditLogService.list(sm, query({ branchId }));
    const scope = { hubId, restockOrgIds: [branchId], peopleOrgIds: [hubId, branchId], branchId };
    expect(auditLogRepository.restockChanges).toHaveBeenCalledWith(scope, expect.anything(), 50);
    expect(auditLogRepository.itemChanges).not.toHaveBeenCalled();
    expect(auditLogRepository.supplierAudits).not.toHaveBeenCalled();
    expect(auditLogRepository.purchasingEntries).not.toHaveBeenCalled();
    expect(auditLogRepository.recipeVersions).not.toHaveBeenCalled();
    expect(stockCountsSource.entries).not.toHaveBeenCalled();
    expect(wasteSource.entries).not.toHaveBeenCalled();
    expect(stockAdjustmentsSource.entries).not.toHaveBeenCalled();
  });

  it('refuses a branch that is not one of the active branches', async () => {
    await expect(auditLogService.list(sm, query({ branchId: '33333333-3333-4333-8333-333333333333' }))).rejects.toMatchObject({ statusCode: 400, code: 'BRANCH_NOT_FOUND' });
  });

  it('refuses anyone outside the hub', async () => {
    await expect(auditLogService.list(outsider, query())).rejects.toThrow(/hub/i);
  });
});

describe('AuditLogQuerySchema', () => {
  it('rejects a backwards date range and an oversize page', () => {
    expect(() => query({ from: '2026-10-04', to: '2026-10-03' })).toThrow();
    expect(() => query({ perPage: 500 })).toThrow();
  });
});
