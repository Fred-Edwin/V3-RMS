import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/database';
import { marketPurchaseOrderRepository } from '../repositories/market-purchase-order-repository';
import { locationRepository } from '../repositories/location-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { branchRepository } from '../repositories/branch-repository';
import { marketPurchaseOrderService } from './market-purchase-order-service';
import { ConflictError, ForbiddenError, ValidationError, NotFoundError } from '../utils/errors';

vi.mock('../config/database', () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock('../repositories/market-purchase-order-repository', () => ({
  marketPurchaseOrderRepository: {
    generateOrderNumber: vi.fn(),
    findActiveDraft: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findAllByOrganization: vi.fn(),
    findByIdForDepartment: vi.fn(),
    addLine: vi.fn(),
    updateLineRequestedQty: vi.fn(),
    removeLine: vi.fn(),
    updateLineReconciliation: vi.fn(),
    confirmLinesForDepartment: vi.fn(),
    transitionStatus: vi.fn(),
  },
}));

vi.mock('../repositories/location-repository', () => ({
  locationRepository: {
    findByOrganizationTypeDepartment: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-item-repository', () => ({
  inventoryItemRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-transaction-repository', () => ({
  inventoryTransactionRepository: {
    create: vi.fn(),
  },
}));

vi.mock('../repositories/branch-repository', () => ({
  branchRepository: {
    findHub: vi.fn(),
  },
}));

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const branchOrgId = '11111111-1111-4111-8111-111111111111';
const hubOrgId = '22222222-2222-4222-8222-222222222222';
const kitchenHeadId = '33333333-3333-4333-8333-333333333333';
const pastryHeadId = '99999999-9999-4999-8999-999999999999';
const managerId = '44444444-4444-4444-8444-444444444444';
const locationId = '55555555-5555-4555-8555-555555555555';
const itemId = '66666666-6666-4666-8666-666666666666';
const orderId = '77777777-7777-4777-8777-777777777777';
const kitchenLineId = '88888888-8888-4888-8888-888888888888';
const pastryLineId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const kitchenHeadActor = {
  id: kitchenHeadId,
  role: 'DEPARTMENT_HEAD' as const,
  organizationId: branchOrgId,
  departmentTag: 'KITCHEN' as const,
};

const pastryHeadActor = {
  id: pastryHeadId,
  role: 'DEPARTMENT_HEAD' as const,
  organizationId: branchOrgId,
  departmentTag: 'PASTRY' as const,
};

const managerActor = { id: managerId, role: 'MANAGER' as const, organizationId: branchOrgId };

const buildLine = (overrides: Record<string, unknown> = {}) => ({
  id: kitchenLineId,
  marketPurchaseOrderId: orderId,
  departmentTag: 'KITCHEN' as const,
  requestedById: kitchenHeadId,
  inventoryItemId: itemId,
  requestedQty: d(6),
  actualQty: null,
  unitPrice: null,
  confirmedById: null,
  confirmedAt: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  inventoryItem: { id: itemId, name: 'Tomatoes', buyUnit: 'kg', usageUnit: 'kg' },
  requestedBy: { id: kitchenHeadId, name: 'Peter Njoroge' },
  confirmedBy: null,
  ...overrides,
});

const buildOrder = (overrides: Record<string, unknown> = {}) => ({
  id: orderId,
  organizationId: branchOrgId,
  orderNumber: 'MPO-260823-01',
  status: 'DRAFT' as const,
  createdById: kitchenHeadId,
  approvedById: null,
  approvedAt: null,
  reconciledById: null,
  reconciledAt: null,
  rejectionReason: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { id: kitchenHeadId, name: 'Peter Njoroge', role: 'DEPARTMENT_HEAD' },
  approvedBy: null,
  reconciledBy: null,
  lines: [buildLine()],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) => (fn as (tx: unknown) => Promise<unknown>)(prisma));
});

describe('marketPurchaseOrderService.requestItems', () => {
  it('rejects a non-department-head actor', async () => {
    await expect(
      marketPurchaseOrderService.requestItems(managerActor as never, {
        lines: [{ inventoryItemId: itemId, requestedQty: 5 }],
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('creates a new draft when none is active, then adds the line to it', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({ id: itemId } as never);
    vi.mocked(marketPurchaseOrderRepository.findActiveDraft).mockResolvedValue(null);
    vi.mocked(marketPurchaseOrderRepository.generateOrderNumber).mockResolvedValue('MPO-260823-01');
    vi.mocked(marketPurchaseOrderRepository.create).mockResolvedValue(buildOrder({ lines: [] }) as never);
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(buildOrder() as never);

    const result = await marketPurchaseOrderService.requestItems(kitchenHeadActor as never, {
      lines: [{ inventoryItemId: itemId, requestedQty: 6 }],
    });

    expect(marketPurchaseOrderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: branchOrgId, createdById: kitchenHeadId }),
      expect.anything(),
    );
    expect(marketPurchaseOrderRepository.addLine).toHaveBeenCalledWith(
      expect.objectContaining({ departmentTag: 'KITCHEN', requestedById: kitchenHeadId, inventoryItemId: itemId }),
      expect.anything(),
    );
    expect(result.id).toBe(orderId);
  });

  it('reuses the existing active draft instead of creating a second one', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({ id: itemId } as never);
    vi.mocked(marketPurchaseOrderRepository.findActiveDraft).mockResolvedValue(buildOrder() as never);
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(buildOrder() as never);

    await marketPurchaseOrderService.requestItems(pastryHeadActor as never, {
      lines: [{ inventoryItemId: itemId, requestedQty: 3 }],
    });

    expect(marketPurchaseOrderRepository.create).not.toHaveBeenCalled();
    expect(marketPurchaseOrderRepository.addLine).toHaveBeenCalledWith(
      expect.objectContaining({ marketPurchaseOrderId: orderId, departmentTag: 'PASTRY' }),
      expect.anything(),
    );
  });

  it('rejects a zero or negative requested quantity', async () => {
    await expect(
      marketPurchaseOrderService.requestItems(kitchenHeadActor as never, {
        lines: [{ inventoryItemId: itemId, requestedQty: 0 }],
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('marketPurchaseOrderService.approve / sendToMarket', () => {
  it('rejects approval by a non-manager', async () => {
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(buildOrder() as never);
    await expect(marketPurchaseOrderService.approve(kitchenHeadActor as never, orderId)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('rejects approving an empty draft', async () => {
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(buildOrder({ lines: [] }) as never);
    await expect(marketPurchaseOrderService.approve(managerActor as never, orderId)).rejects.toThrow(
      ValidationError,
    );
  });

  it('approves a non-empty draft and stamps approver/timestamp', async () => {
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(buildOrder() as never);
    vi.mocked(marketPurchaseOrderRepository.transitionStatus).mockResolvedValue(true);

    await marketPurchaseOrderService.approve(managerActor as never, orderId);

    expect(marketPurchaseOrderRepository.transitionStatus).toHaveBeenCalledWith(
      orderId,
      branchOrgId,
      ['DRAFT'],
      'APPROVED',
      expect.objectContaining({ approvedById: managerId }),
    );
  });

  it('rejects sending to market an order that is not yet approved', async () => {
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(buildOrder({ status: 'DRAFT' }) as never);
    await expect(marketPurchaseOrderService.sendToMarket(managerActor as never, orderId)).rejects.toThrow(
      ConflictError,
    );
  });
});

describe('marketPurchaseOrderService.reconcileLines / complete', () => {
  it('rejects reconciling with a negative actual quantity', async () => {
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(
      buildOrder({ status: 'SENT_TO_MARKET' }) as never,
    );
    await expect(
      marketPurchaseOrderService.reconcileLines(managerActor as never, orderId, [
        { lineId: kitchenLineId, actualQty: -1, unitPrice: 100 },
      ]),
    ).rejects.toThrow(ValidationError);
  });

  it('transitions SENT_TO_MARKET -> RECONCILING on first reconcile call', async () => {
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(
      buildOrder({ status: 'SENT_TO_MARKET' }) as never,
    );
    vi.mocked(marketPurchaseOrderRepository.transitionStatus).mockResolvedValue(true);

    await marketPurchaseOrderService.reconcileLines(managerActor as never, orderId, [
      { lineId: kitchenLineId, actualQty: 6, unitPrice: 180 },
    ]);

    expect(marketPurchaseOrderRepository.transitionStatus).toHaveBeenCalledWith(
      orderId,
      branchOrgId,
      ['SENT_TO_MARKET'],
      'RECONCILING',
      {},
      expect.anything(),
    );
    expect(marketPurchaseOrderRepository.updateLineReconciliation).toHaveBeenCalledWith(
      kitchenLineId,
      orderId,
      { actualQty: 6, unitPrice: 180 },
      expect.anything(),
    );
  });

  it('rejects completing when a line is missing actualQty/unitPrice', async () => {
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(
      buildOrder({ status: 'RECONCILING' }) as never,
    );
    await expect(marketPurchaseOrderService.complete(managerActor as never, orderId)).rejects.toThrow(
      ValidationError,
    );
  });

  it('completes a fully reconciled order and writes one MARKET_RECEIVE per line at its department location', async () => {
    const reconciledOrder = buildOrder({
      status: 'RECONCILING',
      lines: [buildLine({ actualQty: d(6), unitPrice: d(180) })],
    });
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(reconciledOrder as never);
    vi.mocked(marketPurchaseOrderRepository.transitionStatus).mockResolvedValue(true);
    vi.mocked(locationRepository.findByOrganizationTypeDepartment).mockResolvedValue({ id: locationId } as never);

    await marketPurchaseOrderService.complete(managerActor as never, orderId);

    expect(inventoryTransactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: branchOrgId,
        locationId,
        inventoryItemId: itemId,
        type: 'MARKET_RECEIVE',
        quantity: d(6),
        unitCost: d(180),
        marketPurchaseOrderLineId: kitchenLineId,
      }),
      expect.anything(),
    );
    expect(marketPurchaseOrderRepository.transitionStatus).toHaveBeenCalledWith(
      orderId,
      branchOrgId,
      ['RECONCILING'],
      'COMPLETED',
      expect.objectContaining({ reconciledById: managerId }),
      expect.anything(),
    );
  });
});

describe('marketPurchaseOrderService.confirmReceived', () => {
  it('scopes a Dept Head to only their own department lines', async () => {
    const scoped = buildOrder({ status: 'COMPLETED', lines: [buildLine()] });
    vi.mocked(marketPurchaseOrderRepository.findByIdForDepartment).mockResolvedValue(scoped as never);

    await marketPurchaseOrderService.getForDepartment(kitchenHeadActor as never, orderId);

    expect(marketPurchaseOrderRepository.findByIdForDepartment).toHaveBeenCalledWith(
      orderId,
      branchOrgId,
      'KITCHEN',
    );
  });

  it('throws NotFoundError when the department has no lines on this order', async () => {
    vi.mocked(marketPurchaseOrderRepository.findByIdForDepartment).mockResolvedValue(
      buildOrder({ lines: [] }) as never,
    );
    await expect(marketPurchaseOrderService.getForDepartment(pastryHeadActor as never, orderId)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('confirms only this department\'s lines and does not flip the order to RECEIVED while another department is unconfirmed', async () => {
    const kitchenScoped = buildOrder({
      status: 'COMPLETED',
      lines: [buildLine({ actualQty: d(6), unitPrice: d(180) })],
    });
    const fullOrderStillPending = buildOrder({
      status: 'COMPLETED',
      lines: [
        buildLine({ actualQty: d(6), unitPrice: d(180), confirmedById: kitchenHeadId, confirmedAt: new Date() }),
        buildLine({
          id: pastryLineId,
          departmentTag: 'PASTRY',
          requestedById: pastryHeadId,
          actualQty: d(2),
          unitPrice: d(90),
          confirmedById: null,
        }),
      ],
    });

    vi.mocked(marketPurchaseOrderRepository.findByIdForDepartment)
      .mockResolvedValueOnce(kitchenScoped as never)
      .mockResolvedValueOnce(kitchenScoped as never);
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(fullOrderStillPending as never);

    await marketPurchaseOrderService.confirmReceived(kitchenHeadActor as never, orderId);

    expect(marketPurchaseOrderRepository.confirmLinesForDepartment).toHaveBeenCalledWith(
      orderId,
      'KITCHEN',
      kitchenHeadId,
      expect.anything(),
    );
    expect(marketPurchaseOrderRepository.transitionStatus).not.toHaveBeenCalled();
  });

  it('flips the order COMPLETED -> RECEIVED once every department has confirmed', async () => {
    const kitchenScoped = buildOrder({ status: 'COMPLETED', lines: [buildLine()] });
    const fullyConfirmed = buildOrder({
      status: 'COMPLETED',
      lines: [
        buildLine({ confirmedById: kitchenHeadId, confirmedAt: new Date() }),
        buildLine({ id: pastryLineId, departmentTag: 'PASTRY', confirmedById: pastryHeadId, confirmedAt: new Date() }),
      ],
    });

    vi.mocked(marketPurchaseOrderRepository.findByIdForDepartment)
      .mockResolvedValueOnce(kitchenScoped as never)
      .mockResolvedValueOnce(kitchenScoped as never);
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(fullyConfirmed as never);
    vi.mocked(marketPurchaseOrderRepository.transitionStatus).mockResolvedValue(true);

    await marketPurchaseOrderService.confirmReceived(kitchenHeadActor as never, orderId);

    expect(marketPurchaseOrderRepository.transitionStatus).toHaveBeenCalledWith(
      orderId,
      branchOrgId,
      ['COMPLETED'],
      'RECEIVED',
      {},
      expect.anything(),
    );
  });
});

describe('marketPurchaseOrderService.reject', () => {
  it('requires a non-empty reason', async () => {
    await expect(marketPurchaseOrderService.reject(managerActor as never, orderId, '')).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects a draft or approved order', async () => {
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(buildOrder({ status: 'APPROVED' }) as never);
    vi.mocked(marketPurchaseOrderRepository.transitionStatus).mockResolvedValue(true);

    await marketPurchaseOrderService.reject(managerActor as never, orderId, 'Wrong items requested');

    expect(marketPurchaseOrderRepository.transitionStatus).toHaveBeenCalledWith(
      orderId,
      branchOrgId,
      ['DRAFT', 'APPROVED'],
      'REJECTED',
      { rejectionReason: 'Wrong items requested' },
    );
  });

  it('refuses to reject an order already sent to market', async () => {
    vi.mocked(marketPurchaseOrderRepository.findById).mockResolvedValue(
      buildOrder({ status: 'SENT_TO_MARKET' }) as never,
    );
    await expect(
      marketPurchaseOrderService.reject(managerActor as never, orderId, 'too late'),
    ).rejects.toThrow(ConflictError);
  });
});
