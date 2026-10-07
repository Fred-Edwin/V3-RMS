import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../repositories/branch-repository';
import { auditLogRepository } from './audit-log-repository';
import { auditLogService } from './audit-log-service';
import { AuditLogQuerySchema } from './audit-log-validators';

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
    const scope = { hubId, restockOrgIds: [hubId, branchId] };
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
    expect(auditLogRepository.purchasingEntries).toHaveBeenCalledWith({ hubId, restockOrgIds: [hubId, branchId] }, expect.anything(), ['PURCHASING', 'PAYMENTS'], 50);
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
    expect(auditLogRepository.recipeVersions).toHaveBeenCalledWith({ hubId, restockOrgIds: [hubId, branchId] }, expect.anything(), 50);
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
