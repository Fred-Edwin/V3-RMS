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
  ApproveRequisitionSchema,
  ListRequisitionHistoryQuerySchema,
  ListRequisitionsQuerySchema,
  OpenRequisitionSchema,
  RequisitionApprovalDetailSchema,
  RequisitionHistoryRowSchema,
  RequisitionListRowSchema,
  RequisitionManagerListRowSchema,
  RequisitionSectionDetailSchema,
  ReturnSectionSchema,
  UpsertApprovalLinesSchema,
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
    findByIdWithAllSections: vi.fn(),
    findAllByOrganizationForManager: vi.fn(),
    updateLineApproval: vi.fn(),
    softDeleteLine: vi.fn(),
    createManagerLine: vi.fn(),
    markApprovedIfPendingApproval: vi.fn(),
    findHistoryRows: vi.fn(),
    findBranchManagers: vi.fn().mockResolvedValue([]),
    findSectionHeads: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../repositories/auth-repository', () => ({
  authRepository: { findUserByIdWithPassword: vi.fn() },
}));

vi.mock('../../sockets/socket-service', () => ({
  socketService: {
    emitRequisitionSubmitted: vi.fn(),
    emitRequisitionDecision: vi.fn(),
    emitRequisitionSectionReturned: vi.fn(),
    emitRequisitionNudge: vi.fn(),
  },
}));

vi.mock('../../services/fcm-service', () => ({
  fcmService: {
    sendRequisitionSubmittedPush: vi.fn().mockResolvedValue(undefined),
    sendRequisitionDecisionPush: vi.fn().mockResolvedValue(undefined),
    sendRequisitionSectionReturnedPush: vi.fn().mockResolvedValue(undefined),
    sendRequisitionNudgePush: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../utils/password', () => ({
  comparePin: vi.fn(),
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

const manager = {
  id: 'manager-1',
  role: 'MANAGER' as const,
  organizationId: branchOrgId,
  isDepartmentHead: false,
  departmentTag: null,
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

// ---------------------------------------------------------------------------
// Session B — Branch Manager approval.
// ---------------------------------------------------------------------------

describe('Requisition approval request schemas', () => {
  it('UpsertApprovalLinesSchema accepts approvedQty: "0"', () => {
    expect(() => UpsertApprovalLinesSchema.parse({ lines: [{ id: lineId, approvedQty: '0' }] })).not.toThrow();
  });

  it('UpsertApprovalLinesSchema rejects a negative approvedQty', () => {
    expect(() => UpsertApprovalLinesSchema.parse({ lines: [{ id: lineId, approvedQty: '-1' }] })).toThrow();
  });

  it('UpsertApprovalLinesSchema rejects a line with neither id nor itemId', () => {
    expect(() => UpsertApprovalLinesSchema.parse({ lines: [{ approvedQty: '5' }] })).toThrow();
  });

  it('ApproveRequisitionSchema rejects a 5-digit PIN', () => {
    expect(() => ApproveRequisitionSchema.parse({ pin: '12345' })).toThrow();
  });

  it('ApproveRequisitionSchema accepts a 4-digit PIN', () => {
    expect(() => ApproveRequisitionSchema.parse({ pin: '1234' })).not.toThrow();
  });

  it('ReturnSectionSchema rejects an empty note', () => {
    expect(() => ReturnSectionSchema.parse({ note: '' })).toThrow();
  });

  it('ListRequisitionHistoryQuerySchema defaults limit to 25 and caps at 100', () => {
    expect(ListRequisitionHistoryQuerySchema.parse({}).limit).toBe(25);
    expect(() => ListRequisitionHistoryQuerySchema.parse({ limit: 101 })).toThrow();
  });
});

describe('Requisition approval response contract shapes', () => {
  const buildApprovalSection = (overrides: Record<string, unknown> = {}) => ({
    id: sectionId,
    requisitionId,
    departmentTag: 'KITCHEN' as const,
    status: 'SUBMITTED' as const,
    submittedById: 'head-1',
    submittedAt: new Date('2026-09-21T06:00:00Z'),
    returnedNote: null,
    managerNote: null,
    submittedBy: { id: 'head-1', name: 'Kitchen Head' },
    lines: [] as unknown[],
    ...overrides,
  });

  const editedLine = {
    id: lineId,
    requisitionSectionId: sectionId,
    inventoryItemId: itemId,
    parAtRequest: new Prisma.Decimal(20),
    requestedQty: new Prisma.Decimal(14),
    approvedQty: new Prisma.Decimal(20),
    addedFromNote: false,
    editedById: 'manager-1',
    editReason: 'Low stock',
    deletedAt: null,
    item: { id: itemId, name: 'Chicken', usageUnit: 'kg', category: null },
  };

  const addedLineId = '88888888-8888-4888-8888-888888888888';
  const addedItemId = '99999999-9999-4999-9999-999999999999';

  const managerAddedLine = {
    id: addedLineId,
    requisitionSectionId: sectionId,
    inventoryItemId: addedItemId,
    parAtRequest: null,
    requestedQty: null,
    approvedQty: new Prisma.Decimal(5),
    addedFromNote: true,
    editedById: 'manager-1',
    editReason: null,
    deletedAt: null,
    item: { id: addedItemId, name: 'Extra napkins', usageUnit: 'pack', category: null },
  };

  it('getRequisitionForApproval output satisfies RequisitionApprovalDetailSchema, with a mixed fixture (edited, manager-added, as-requested, not-submitted sections) and soft-deleted lines absent', async () => {
    vi.mocked(requisitionRepository.findByIdWithAllSections).mockResolvedValue({
      id: requisitionId,
      organizationId: branchOrgId,
      type: 'MORNING',
      note: null,
      status: 'PENDING_APPROVAL',
      openedById: 'head-1',
      openedAt: new Date('2026-09-21T06:00:00Z'),
      approvedById: null,
      approvedAt: null,
      approvedBy: null,
      sections: [
        buildApprovalSection({ lines: [editedLine, managerAddedLine] }),
        buildApprovalSection({
          id: 'section-2',
          departmentTag: 'BARISTA',
          lines: [
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              requisitionSectionId: 'section-2',
              inventoryItemId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              parAtRequest: new Prisma.Decimal(10),
              requestedQty: new Prisma.Decimal(10),
              approvedQty: new Prisma.Decimal(10),
              addedFromNote: false,
              editedById: null,
              editReason: null,
              deletedAt: null,
              item: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Milk', usageUnit: 'L', category: null },
            },
          ],
        }),
        buildApprovalSection({ id: 'section-3', departmentTag: 'SERVICE', status: 'NOT_STARTED', submittedById: null, submittedAt: null, submittedBy: null, lines: [] }),
      ],
    } as never);

    const detail = await requisitionService.getRequisitionForApproval(manager, requisitionId);
    expect(() => RequisitionApprovalDetailSchema.parse(detail)).not.toThrow();

    // onHand null on every line
    expect(detail.sections.flatMap((s) => s.lines).every((l) => l.onHand === null)).toBe(true);

    // Soft-deleted lines are excluded at the repository layer (`where:
    // { deletedAt: null }` on `approvalSectionInclude`) — this fixture only
    // ever contains live lines, proving the serializer adds nothing back.
    const allLineIds = detail.sections.flatMap((s) => s.lines).map((l) => l.id);
    expect(new Set(allLineIds).size).toBe(allLineIds.length);

    const kitchenSection = detail.sections.find((s) => s.departmentTag === 'KITCHEN')!;
    expect(kitchenSection.isAsRequested).toBe(false);
    expect(kitchenSection.changedLineCount).toBe(2);

    const baristaSection = detail.sections.find((s) => s.departmentTag === 'BARISTA')!;
    expect(baristaSection.isAsRequested).toBe(true);

    const serviceSection = detail.sections.find((s) => s.departmentTag === 'SERVICE')!;
    expect(serviceSection.status).toBe('NOT_STARTED');
  });

  it('listForManagerApproval output satisfies RequisitionManagerListRowSchema', async () => {
    vi.mocked(requisitionRepository.findAllByOrganizationForManager).mockResolvedValue([
      {
        id: requisitionId,
        organizationId: branchOrgId,
        type: 'MORNING',
        note: null,
        status: 'PENDING_APPROVAL',
        openedById: 'head-1',
        openedAt: new Date('2026-09-21T06:00:00Z'),
        approvedById: null,
        approvedAt: null,
        sections: [
          { status: 'SUBMITTED', lines: [{ requestedQty: new Prisma.Decimal(5), approvedQty: null }] },
          { status: 'NOT_STARTED', lines: [] },
        ],
      },
    ] as never);

    const rows = await requisitionService.listForManagerApproval(manager, { limit: 25 });
    for (const row of rows) {
      expect(() => RequisitionManagerListRowSchema.parse(row)).not.toThrow();
    }
  });

  it('listHistory output satisfies RequisitionHistoryRowSchema', async () => {
    vi.mocked(requisitionRepository.findHistoryRows).mockResolvedValue([
      {
        id: requisitionId,
        organizationId: branchOrgId,
        type: 'MORNING',
        note: null,
        status: 'APPROVED',
        openedById: 'head-1',
        openedAt: new Date('2026-09-21T06:00:00Z'),
        approvedById: 'manager-1',
        approvedAt: new Date('2026-09-21T07:00:00Z'),
        approvedBy: { id: 'manager-1', name: 'Branch Manager' },
        sections: [{ status: 'SUBMITTED', returnedNote: null, lines: [{ requestedQty: new Prisma.Decimal(5), approvedQty: new Prisma.Decimal(5) }] }],
      },
    ] as never);

    const rows = await requisitionService.listHistory(manager, { limit: 25 });
    for (const row of rows) {
      expect(() => RequisitionHistoryRowSchema.parse(row)).not.toThrow();
    }
  });
});
