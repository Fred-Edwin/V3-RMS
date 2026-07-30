import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/database';
import { purchaseOrderRepository } from '../repositories/purchase-order-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { supplierRepository } from '../repositories/supplier-repository';
import { inventoryTransactionService } from './inventory-transaction-service';
import { purchaseOrderService } from './purchase-order-service';
import { ConflictError } from '../utils/errors';

vi.mock('../config/database', () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock('../repositories/purchase-order-repository', () => ({
  purchaseOrderRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    transitionStatus: vi.fn(),
    updateLineReceipt: vi.fn(),
    findLineById: vi.fn(),
    replaceLines: vi.fn(),
    resetLineReceipt: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-transaction-repository', () => ({
  inventoryTransactionRepository: {
    create: vi.fn(),
    findLatestReceiveByPurchaseOrderLine: vi.fn(),
  },
}));

vi.mock('../repositories/inventory-item-repository', () => ({
  inventoryItemRepository: {
    findById: vi.fn(),
    findAllByOrganization: vi.fn(),
    updateCurrentCost: vi.fn(),
  },
}));

vi.mock('../repositories/supplier-repository', () => ({
  supplierRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('./inventory-transaction-service', () => ({
  inventoryTransactionService: {
    recordReceive: vi.fn(),
  },
}));

const organizationId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const supplierId = '33333333-3333-4333-8333-333333333333';
const locationId = '44444444-4444-4444-8444-444444444444';
const poId = '55555555-5555-4555-8555-555555555555';
const lineId = '66666666-6666-4666-8666-666666666666';
const itemId = '77777777-7777-4777-8777-777777777777';

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const actor = { id: userId, role: 'STORE_MANAGER' as const, organizationId };

const buildPoLine = (overrides: Record<string, unknown> = {}) => ({
  id: lineId,
  organizationId,
  purchaseOrderId: poId,
  inventoryItemId: itemId,
  orderedQty: d(10),
  receivedQty: d(0),
  unitPrice: d(300),
  invoicePrice: null,
  receivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  inventoryItem: { id: itemId, name: 'Chicken Breast', buyUnit: 'kg' },
  ...overrides,
});

const buildPo = (overrides: Record<string, unknown> = {}) => ({
  id: poId,
  organizationId,
  supplierId,
  locationId,
  poNumber: 'PO-260728-AB12',
  status: 'SENT' as const,
  createdById: userId,
  sentAt: new Date(),
  cancelledAt: null,
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  supplier: { id: supplierId, name: 'Metro Supermarket' },
  lines: [buildPoLine()],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) =>
    (fn as (tx: unknown) => Promise<unknown>)(prisma),
  );
});

describe('purchaseOrderService.receiveLine', () => {
  it('calls inventoryTransactionService.recordReceive (never reimplements costing) and the resulting currentCost change is Session 2\'s responsibility, not this service\'s', async () => {
    vi.mocked(purchaseOrderRepository.findById).mockResolvedValue(buildPo() as never);
    vi.mocked(purchaseOrderRepository.updateLineReceipt).mockResolvedValue(undefined);
    vi.mocked(purchaseOrderRepository.transitionStatus).mockResolvedValue(true);
    vi.mocked(inventoryTransactionService.recordReceive).mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
      organizationId,
      locationId,
      inventoryItemId: itemId,
      type: 'RECEIVE',
      quantity: d(5000),
      unitCost: d(0.31),
      userId,
      reason: null,
      purchaseOrderLineId: lineId,
      prepRecordId: null,
      wasteLogId: null,
      stockCountLineId: null,
      createdAt: new Date(),
    } as never);

    await purchaseOrderService.receiveLine(actor, poId, lineId, {
      receivedQty: '5',
      invoicePrice: '310',
    });

    // Assert receiveLine delegates to Session 2's recordReceive with this
    // PO line's inputs, rather than writing InventoryTransaction rows or
    // recomputing weighted-average cost itself.
    expect(inventoryTransactionService.recordReceive).toHaveBeenCalledWith({
      organizationId,
      locationId,
      userId,
      inventoryItemId: itemId,
      buyQty: expect.any(Prisma.Decimal),
      unitPrice: '310',
      purchaseOrderLineId: lineId,
    });

    // currentCost is only ever mutated inside recordReceive's own
    // transaction (Session 2) — receiveLine itself must never call
    // updateCurrentCost directly.
    expect(inventoryItemRepository.updateCurrentCost).not.toHaveBeenCalled();
  });

  it('partial receipt (receivedQty < orderedQty) transitions the PO to PARTIALLY_RECEIVED', async () => {
    vi.mocked(purchaseOrderRepository.findById)
      .mockResolvedValueOnce(buildPo() as never)
      .mockResolvedValueOnce(
        buildPo({ lines: [buildPoLine({ receivedQty: d(5) })] }) as never,
      )
      .mockResolvedValueOnce(
        buildPo({ status: 'PARTIALLY_RECEIVED', lines: [buildPoLine({ receivedQty: d(5) })] }) as never,
      );
    vi.mocked(purchaseOrderRepository.updateLineReceipt).mockResolvedValue(undefined);
    vi.mocked(purchaseOrderRepository.transitionStatus).mockResolvedValue(true);
    vi.mocked(inventoryTransactionService.recordReceive).mockResolvedValue({} as never);

    const result = await purchaseOrderService.receiveLine(actor, poId, lineId, {
      receivedQty: '5',
      invoicePrice: '310',
    });

    expect(purchaseOrderRepository.transitionStatus).toHaveBeenCalledWith(
      poId,
      organizationId,
      ['SENT', 'PARTIALLY_RECEIVED'],
      'PARTIALLY_RECEIVED',
      {},
      prisma,
    );
    expect(result.status).toBe('PARTIALLY_RECEIVED');
  });

  it('full receipt (receivedQty >= orderedQty on every line) closes the PO to CLOSED', async () => {
    vi.mocked(purchaseOrderRepository.findById)
      .mockResolvedValueOnce(buildPo() as never)
      .mockResolvedValueOnce(
        buildPo({ lines: [buildPoLine({ receivedQty: d(10) })] }) as never,
      )
      .mockResolvedValueOnce(
        buildPo({ status: 'CLOSED', lines: [buildPoLine({ receivedQty: d(10) })] }) as never,
      );
    vi.mocked(purchaseOrderRepository.updateLineReceipt).mockResolvedValue(undefined);
    vi.mocked(purchaseOrderRepository.transitionStatus).mockResolvedValue(true);
    vi.mocked(inventoryTransactionService.recordReceive).mockResolvedValue({} as never);

    const result = await purchaseOrderService.receiveLine(actor, poId, lineId, {
      receivedQty: '10',
      invoicePrice: '310',
    });

    expect(purchaseOrderRepository.transitionStatus).toHaveBeenCalledWith(
      poId,
      organizationId,
      ['SENT', 'PARTIALLY_RECEIVED'],
      'CLOSED',
      { closedAt: expect.any(Date) },
      prisma,
    );
    expect(result.status).toBe('CLOSED');
  });

  it('rejects receiving against a DRAFT purchase order (409)', async () => {
    vi.mocked(purchaseOrderRepository.findById).mockResolvedValue(
      buildPo({ status: 'DRAFT' }) as never,
    );

    await expect(
      purchaseOrderService.receiveLine(actor, poId, lineId, { receivedQty: '5', invoicePrice: '310' }),
    ).rejects.toThrow(ConflictError);
    expect(inventoryTransactionService.recordReceive).not.toHaveBeenCalled();
  });
});

describe('purchaseOrderService.send / cancel', () => {
  it('send() transitions DRAFT -> SENT', async () => {
    vi.mocked(purchaseOrderRepository.transitionStatus).mockResolvedValue(true);
    vi.mocked(purchaseOrderRepository.findById).mockResolvedValue(buildPo({ status: 'SENT' }) as never);

    const result = await purchaseOrderService.send(actor, poId);

    expect(purchaseOrderRepository.transitionStatus).toHaveBeenCalledWith(
      poId,
      organizationId,
      ['DRAFT'],
      'SENT',
      { sentAt: expect.any(Date) },
    );
    expect(result.status).toBe('SENT');
  });

  it('cancel() transitions DRAFT or SENT -> CANCELLED', async () => {
    vi.mocked(purchaseOrderRepository.transitionStatus).mockResolvedValue(true);
    vi.mocked(purchaseOrderRepository.findById).mockResolvedValue(
      buildPo({ status: 'CANCELLED' }) as never,
    );

    const result = await purchaseOrderService.cancel(actor, poId);

    expect(purchaseOrderRepository.transitionStatus).toHaveBeenCalledWith(
      poId,
      organizationId,
      ['DRAFT', 'SENT'],
      'CANCELLED',
      { cancelledAt: expect.any(Date) },
    );
    expect(result.status).toBe('CANCELLED');
  });
});

describe('purchaseOrderService.create', () => {
  it('validates the supplier and every line item exist before creating', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue({ id: supplierId } as never);
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({ id: itemId } as never);
    vi.mocked(purchaseOrderRepository.create).mockResolvedValue(buildPo({ status: 'DRAFT' }) as never);

    const result = await purchaseOrderService.create(actor, {
      supplierId,
      locationId,
      lines: [{ inventoryItemId: itemId, orderedQty: '10', unitPrice: '300' }],
    });

    expect(supplierRepository.findById).toHaveBeenCalledWith(supplierId, organizationId);
    expect(inventoryItemRepository.findById).toHaveBeenCalledWith(itemId, organizationId);
    expect(result.status).toBe('DRAFT');
  });

  it('rejects when supplierId does not reference a known supplier', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(null);

    await expect(
      purchaseOrderService.create(actor, {
        supplierId,
        locationId,
        lines: [{ inventoryItemId: itemId, orderedQty: '10', unitPrice: '300' }],
      }),
    ).rejects.toThrow('supplierId does not reference a known supplier');
  });
});

describe('purchaseOrderService.updateLines', () => {
  it('replaces a DRAFT order\'s lines', async () => {
    vi.mocked(purchaseOrderRepository.findById)
      .mockResolvedValueOnce(buildPo({ status: 'DRAFT' }) as never)
      .mockResolvedValueOnce(buildPo({ status: 'DRAFT' }) as never);
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({ id: itemId } as never);
    vi.mocked(purchaseOrderRepository.replaceLines).mockResolvedValue(undefined);

    await purchaseOrderService.updateLines(actor, poId, {
      lines: [{ inventoryItemId: itemId, orderedQty: '20', unitPrice: '305' }],
    });

    expect(purchaseOrderRepository.replaceLines).toHaveBeenCalledWith(
      poId,
      organizationId,
      [{ inventoryItemId: itemId, orderedQty: '20', unitPrice: '305' }],
      prisma,
    );
  });

  it('rejects editing lines on a non-DRAFT order (409)', async () => {
    vi.mocked(purchaseOrderRepository.findById).mockResolvedValue(buildPo({ status: 'SENT' }) as never);

    await expect(
      purchaseOrderService.updateLines(actor, poId, {
        lines: [{ inventoryItemId: itemId, orderedQty: '20', unitPrice: '305' }],
      }),
    ).rejects.toThrow(ConflictError);
    expect(purchaseOrderRepository.replaceLines).not.toHaveBeenCalled();
  });
});

describe('purchaseOrderService.unsend', () => {
  it('transitions SENT -> DRAFT', async () => {
    vi.mocked(purchaseOrderRepository.transitionStatus).mockResolvedValue(true);
    vi.mocked(purchaseOrderRepository.findById).mockResolvedValue(buildPo({ status: 'DRAFT' }) as never);

    const result = await purchaseOrderService.unsend(actor, poId);

    expect(purchaseOrderRepository.transitionStatus).toHaveBeenCalledWith(
      poId,
      organizationId,
      ['SENT'],
      'DRAFT',
      { sentAt: null },
    );
    expect(result.status).toBe('DRAFT');
  });

  it('rejects unsending a PARTIALLY_RECEIVED order with a message pointing at reversing receipts first', async () => {
    vi.mocked(purchaseOrderRepository.transitionStatus).mockResolvedValue(false);
    vi.mocked(purchaseOrderRepository.findById).mockResolvedValue(
      buildPo({ status: 'PARTIALLY_RECEIVED' }) as never,
    );

    await expect(purchaseOrderService.unsend(actor, poId)).rejects.toThrow(
      'reverse those receipts before unsending',
    );
  });
});

describe('purchaseOrderService.reverseLineReceipt', () => {
  it('posts an offsetting ADJUSTMENT at the reversed receipt\'s own price and resets the line', async () => {
    const receivedLine = buildPoLine({ receivedQty: d(5), invoicePrice: d(310), receivedAt: new Date() });
    vi.mocked(purchaseOrderRepository.findById)
      .mockResolvedValueOnce(buildPo({ status: 'PARTIALLY_RECEIVED', lines: [receivedLine] }) as never)
      .mockResolvedValueOnce(buildPo({ status: 'SENT', lines: [buildPoLine()] }) as never)
      .mockResolvedValueOnce(buildPo({ status: 'SENT', lines: [buildPoLine()] }) as never);
    vi.mocked(inventoryTransactionRepository.findLatestReceiveByPurchaseOrderLine).mockResolvedValue({
      id: '99999999-9999-4999-8999-999999999999',
      organizationId,
      locationId,
      inventoryItemId: itemId,
      type: 'RECEIVE',
      quantity: d(5000),
      unitCost: d(0.31),
      userId,
      reason: null,
      purchaseOrderLineId: lineId,
      prepRecordId: null,
      wasteLogId: null,
      stockCountLineId: null,
      createdAt: new Date(),
    } as never);
    vi.mocked(inventoryTransactionRepository.create).mockResolvedValue({} as never);
    vi.mocked(purchaseOrderRepository.resetLineReceipt).mockResolvedValue(undefined);
    vi.mocked(purchaseOrderRepository.transitionStatus).mockResolvedValue(true);

    const result = await purchaseOrderService.reverseLineReceipt(actor, poId, lineId);

    expect(inventoryTransactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        locationId,
        inventoryItemId: itemId,
        type: 'ADJUSTMENT',
        unitCost: d(0.31),
        purchaseOrderLineId: lineId,
      }),
      prisma,
    );
    // Reversal quantity must be the negation of the original receive quantity.
    const calls = vi.mocked(inventoryTransactionRepository.create).mock.calls;
    const adjustmentArg = calls[0]?.[0];
    expect((adjustmentArg as { quantity: Prisma.Decimal }).quantity.toString()).toBe(d(-5000).toString());

    expect(purchaseOrderRepository.resetLineReceipt).toHaveBeenCalledWith(lineId, organizationId, prisma);
    expect(result.status).toBe('SENT');
  });

  it('drops back to SENT (not PARTIALLY_RECEIVED) when the reversed line was the only one received', async () => {
    const receivedLine = buildPoLine({ receivedQty: d(5), invoicePrice: d(310), receivedAt: new Date() });
    vi.mocked(purchaseOrderRepository.findById)
      .mockResolvedValueOnce(buildPo({ status: 'PARTIALLY_RECEIVED', lines: [receivedLine] }) as never)
      .mockResolvedValueOnce(buildPo({ status: 'PARTIALLY_RECEIVED', lines: [buildPoLine({ receivedQty: d(0) })] }) as never)
      .mockResolvedValueOnce(buildPo({ status: 'SENT', lines: [buildPoLine()] }) as never);
    vi.mocked(inventoryTransactionRepository.findLatestReceiveByPurchaseOrderLine).mockResolvedValue({
      quantity: d(5000),
      unitCost: d(0.31),
    } as never);
    vi.mocked(inventoryTransactionRepository.create).mockResolvedValue({} as never);
    vi.mocked(purchaseOrderRepository.resetLineReceipt).mockResolvedValue(undefined);
    vi.mocked(purchaseOrderRepository.transitionStatus).mockResolvedValue(true);

    await purchaseOrderService.reverseLineReceipt(actor, poId, lineId);

    expect(purchaseOrderRepository.transitionStatus).toHaveBeenCalledWith(
      poId,
      organizationId,
      ['SENT', 'PARTIALLY_RECEIVED', 'CLOSED'],
      'SENT',
      {},
      prisma,
    );
  });

  it('rejects reversing a line that has not been received (409)', async () => {
    vi.mocked(purchaseOrderRepository.findById).mockResolvedValue(
      buildPo({ status: 'SENT', lines: [buildPoLine({ receivedQty: d(0) })] }) as never,
    );

    await expect(purchaseOrderService.reverseLineReceipt(actor, poId, lineId)).rejects.toThrow(ConflictError);
    expect(inventoryTransactionRepository.create).not.toHaveBeenCalled();
  });
});
