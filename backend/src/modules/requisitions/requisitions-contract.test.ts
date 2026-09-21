/**
 * Contract drift guard (Milestone Two/Three precedent: receiving-contract.
 * test.ts / prep-contract.test.ts): asserts request schemas accept valid /
 * reject invalid payloads, and the service's actual serialized output
 * satisfies the response schemas declared in requisitions-validators.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { requisitionService } from './requisitions-service';
import { requisitionRepository } from './requisitions-repository';
import {
  ListRequisitionsQuerySchema,
  OpenRequisitionSchema,
  RequisitionListRowSchema,
  RequisitionSectionDetailSchema,
  UpsertRequisitionLinesSchema,
} from './requisitions-validators';

vi.mock('./requisitions-repository', () => ({
  requisitionRepository: {
    create: vi.fn(),
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    markPendingApprovalIfOpen: vi.fn(),
    findSectionWithLines: vi.fn(),
    findSectionById: vi.fn(),
    updateLineQty: vi.fn(),
    createLine: vi.fn(),
    updateManagerNote: vi.fn(),
    setSectionStatus: vi.fn(),
  },
}));

vi.mock('../inventory/inventory-repository', () => ({
  inventoryItemRepository: { findLiveByIds: vi.fn() },
  restockLevelRepository: { findByItemIdsForLocation: vi.fn() },
}));

vi.mock('../../repositories/location-repository', () => ({
  locationRepository: { findByOrganizationTypeDepartment: vi.fn() },
}));

vi.mock('../../repositories/branch-repository', () => ({
  branchRepository: { findHub: vi.fn() },
}));

vi.mock('../../config/database', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
    category: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const branchOrgId = '11111111-1111-4111-8111-111111111111';
const requisitionId = '22222222-2222-4222-8222-222222222222';
const sectionId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';
const lineId = '66666666-6666-4666-8666-666666666666';

const kitchenHead = {
  id: 'head-1',
  role: 'CHEF' as const,
  organizationId: branchOrgId,
  isDepartmentHead: true,
  departmentTag: 'KITCHEN' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Requisition request schemas', () => {
  it('OpenRequisitionSchema accepts a valid payload', () => {
    expect(() => OpenRequisitionSchema.parse({ type: 'MORNING' })).not.toThrow();
    expect(() => OpenRequisitionSchema.parse({ type: 'AD_HOC', note: 'Weekend stock-up' })).not.toThrow();
  });

  it('OpenRequisitionSchema rejects an invalid type', () => {
    expect(() => OpenRequisitionSchema.parse({ type: 'NOON' })).toThrow();
  });

  it('ListRequisitionsQuerySchema defaults limit to 25', () => {
    const parsed = ListRequisitionsQuerySchema.parse({});
    expect(parsed.limit).toBe(25);
  });

  it('UpsertRequisitionLinesSchema accepts "0" for zero-not-delete', () => {
    expect(() =>
      UpsertRequisitionLinesSchema.parse({ lines: [{ id: lineId, requestedQty: '0' }] }),
    ).not.toThrow();
  });

  it('UpsertRequisitionLinesSchema rejects a negative decimal', () => {
    expect(() =>
      UpsertRequisitionLinesSchema.parse({ lines: [{ id: lineId, requestedQty: '-1' }] }),
    ).toThrow();
  });

  it('UpsertRequisitionLinesSchema rejects a line with neither id nor inventoryItemId', () => {
    expect(() => UpsertRequisitionLinesSchema.parse({ lines: [{ requestedQty: '5' }] })).toThrow();
  });

  it('UpsertRequisitionLinesSchema accepts a new line keyed by inventoryItemId only', () => {
    expect(() =>
      UpsertRequisitionLinesSchema.parse({ lines: [{ inventoryItemId: itemId, requestedQty: '5' }] }),
    ).not.toThrow();
  });

  it('UpsertRequisitionLinesSchema accepts a null requestedQty (manager-added, head never asked)', () => {
    expect(() =>
      UpsertRequisitionLinesSchema.parse({ lines: [{ id: lineId, requestedQty: null }] }),
    ).not.toThrow();
  });
});

describe('Requisition response contract shapes', () => {
  it('listRequisitions output satisfies RequisitionListRowSchema', async () => {
    vi.mocked(requisitionRepository.findAllByOrganization).mockResolvedValue([
      {
        id: requisitionId,
        organizationId: branchOrgId,
        type: 'MORNING',
        note: null,
        status: 'OPEN',
        openedById: kitchenHead.id,
        openedAt: new Date('2026-09-21T06:00:00Z'),
        approvedById: null,
        approvedAt: null,
        sections: [{ departmentTag: 'KITCHEN', status: 'DRAFT' }],
      },
    ] as never);

    const rows = await requisitionService.listRequisitions(kitchenHead, { limit: 25 });
    for (const row of rows) {
      expect(() => RequisitionListRowSchema.parse(row)).not.toThrow();
    }
  });

  it('getSection output satisfies RequisitionSectionDetailSchema', async () => {
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue({
      id: sectionId,
      requisitionId,
      departmentTag: 'KITCHEN',
      status: 'DRAFT',
      submittedById: null,
      submittedAt: null,
      returnedNote: null,
      managerNote: 'Please rush this',
      requisition: { id: requisitionId, status: 'OPEN' },
      lines: [
        {
          id: lineId,
          requisitionSectionId: sectionId,
          inventoryItemId: itemId,
          parAtRequest: new Prisma.Decimal(20),
          requestedQty: new Prisma.Decimal(5),
          approvedQty: null,
          addedFromNote: false,
          editedById: null,
          editReason: null,
          deletedAt: null,
          item: { id: itemId, name: 'Chicken', usageUnit: 'kg', category: { id: 'cat-1', name: 'Meat', parentCategoryId: null } },
        },
      ],
    } as never);

    const detail = await requisitionService.getSection(kitchenHead, requisitionId, 'KITCHEN');
    expect(() => RequisitionSectionDetailSchema.parse(detail)).not.toThrow();
  });

  it('getSection output satisfies the schema when parAtRequest is null (no RestockLevel yet)', async () => {
    vi.mocked(requisitionRepository.findSectionWithLines).mockResolvedValue({
      id: sectionId,
      requisitionId,
      departmentTag: 'KITCHEN',
      status: 'NOT_STARTED',
      submittedById: null,
      submittedAt: null,
      returnedNote: null,
      managerNote: null,
      requisition: { id: requisitionId, status: 'OPEN' },
      lines: [
        {
          id: lineId,
          requisitionSectionId: sectionId,
          inventoryItemId: itemId,
          parAtRequest: null,
          requestedQty: null,
          approvedQty: null,
          addedFromNote: false,
          editedById: null,
          editReason: null,
          deletedAt: null,
          item: { id: itemId, name: 'Chicken', usageUnit: 'kg', category: null },
        },
      ],
    } as never);

    const detail = await requisitionService.getSection(kitchenHead, requisitionId, 'KITCHEN');
    expect(detail.lines[0]!.parAtRequest).toBeNull();
    expect(() => RequisitionSectionDetailSchema.parse(detail)).not.toThrow();
  });
});
