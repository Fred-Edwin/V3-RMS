import { beforeEach, describe, expect, it, vi } from 'vitest';
import { orderCorrectionRepository } from '../src/repositories/order-correction-repository';
import { orderCorrectionService } from '../src/services/order-correction-service';
import { ConflictError, ForbiddenError } from '../src/utils/errors';

vi.mock('../src/repositories/order-correction-repository', () => ({
  orderCorrectionRepository: {
    findById: vi.fn(),
    removeOrderItem: vi.fn(),
    removeSplitLine: vi.fn(),
    addSplitLine: vi.fn(),
    convertToSplit: vi.fn(),
  },
}));

const ownBranchId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const otherBranchId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const managerActor = {
  id: '55555555-5555-4555-8555-555555555555',
  role: 'MANAGER' as const,
  organizationId: ownBranchId,
};

const systemAdminActor = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'SYSTEM_ADMIN' as const,
  organizationId: ownBranchId,
};

const itemId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const lineId = '66666666-6666-4666-8666-666666666666';
const orderId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const buildOrder = (
  overrides: Partial<{
    organizationId: string;
    createdAt: Date;
    status: string;
    total: string;
    paymentMethod: string | null;
    splitPaymentLines: Array<{ id: string; label: string; amount: string; method: string; mpesaCode: string | null }>;
  }> = {},
) => ({
  id: orderId,
  organizationId: overrides.organizationId ?? ownBranchId,
  createdAt: overrides.createdAt ?? new Date(),
  status: overrides.status ?? 'CLOSED',
  total: overrides.total ?? '900.00',
  paymentMethod: overrides.paymentMethod ?? 'CASH',
  items: [
    {
      id: itemId,
      menuItemId: '11111111-1111-4111-8111-111111111111',
      subtotal: '700.00',
      menuItem: { name: 'Latte' },
    },
    {
      id: '99999999-9999-4999-8999-999999999999',
      menuItemId: '22222222-2222-4222-8222-222222222222',
      subtotal: '200.00',
      menuItem: { name: 'Hot Chocolate' },
    },
  ],
  splitPaymentLines:
    overrides.splitPaymentLines ??
    [
      { id: lineId, label: 'Guest 1', amount: '500.00', method: 'MPESA', mpesaCode: 'QKA123XY' },
      { id: '77777777-7777-4777-8777-777777777777', label: 'Guest 2', amount: '400.00', method: 'CASH', mpesaCode: null },
    ],
});

describe('orderCorrectionService — branch scoping and correction window', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('MANAGER can remove an item from their own branch order', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(buildOrder() as never);
    vi.mocked(orderCorrectionRepository.removeOrderItem).mockResolvedValue({ count: 1 } as never);

    await expect(
      orderCorrectionService.removeOrderItem('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', itemId, managerActor, {
        reason: 'Customer disputed this item after order was closed',
      }),
    ).resolves.toBeUndefined();
  });

  it('MANAGER cannot access an order from another branch', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(
      buildOrder({ organizationId: otherBranchId }) as never,
    );

    await expect(
      orderCorrectionService.removeOrderItem('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', itemId, managerActor, {
        reason: 'Customer disputed this item after order was closed',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('SYSTEM_ADMIN can access orders from any branch', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(
      buildOrder({ organizationId: otherBranchId }) as never,
    );
    vi.mocked(orderCorrectionRepository.removeOrderItem).mockResolvedValue({ count: 1 } as never);

    await expect(
      orderCorrectionService.removeOrderItem('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', itemId, systemAdminActor, {
        reason: 'Customer disputed this item after order was closed',
      }),
    ).resolves.toBeUndefined();
  });

  it('MANAGER is blocked from correcting an order older than 90 days', async () => {
    const old = new Date();
    old.setDate(old.getDate() - 91);
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(buildOrder({ createdAt: old }) as never);

    await expect(
      orderCorrectionService.removeOrderItem('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', itemId, managerActor, {
        reason: 'Customer disputed this item after order was closed',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('MANAGER can correct an order within the 90-day window even if older than 7 days', async () => {
    const nineDaysAgo = new Date();
    nineDaysAgo.setDate(nineDaysAgo.getDate() - 9);
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(
      buildOrder({ createdAt: nineDaysAgo }) as never,
    );
    vi.mocked(orderCorrectionRepository.removeOrderItem).mockResolvedValue({ count: 1 } as never);

    await expect(
      orderCorrectionService.removeOrderItem('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', itemId, managerActor, {
        reason: 'Customer disputed this item after order was closed',
      }),
    ).resolves.toBeUndefined();
  });

  it('SYSTEM_ADMIN has no correction-age limit', async () => {
    const veryOld = new Date();
    veryOld.setFullYear(veryOld.getFullYear() - 1);
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(buildOrder({ createdAt: veryOld }) as never);
    vi.mocked(orderCorrectionRepository.removeOrderItem).mockResolvedValue({ count: 1 } as never);

    await expect(
      orderCorrectionService.removeOrderItem('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', itemId, systemAdminActor, {
        reason: 'Customer disputed this item after order was closed',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('orderCorrectionService — split payment line correction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('MANAGER can remove a split line from their own branch order', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(buildOrder() as never);
    vi.mocked(orderCorrectionRepository.removeSplitLine).mockResolvedValue({ id: lineId } as never);

    await expect(
      orderCorrectionService.removeSplitLine(orderId, lineId, managerActor, {
        reason: 'Guest 1 actually paid cash, not M-Pesa as recorded',
      }),
    ).resolves.toBeUndefined();
  });

  it('cannot remove a split line from an order that is not CLOSED', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(buildOrder({ status: 'READY' }) as never);

    await expect(
      orderCorrectionService.removeSplitLine(orderId, lineId, managerActor, {
        reason: 'Guest 1 actually paid cash, not M-Pesa as recorded',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('cannot remove the last remaining split line', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(
      buildOrder({
        splitPaymentLines: [{ id: lineId, label: 'Guest 1', amount: '900.00', method: 'MPESA', mpesaCode: 'QKA123XY' }],
      }) as never,
    );

    await expect(
      orderCorrectionService.removeSplitLine(orderId, lineId, managerActor, {
        reason: 'Guest 1 actually paid cash, not M-Pesa as recorded',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('MANAGER cannot remove a split line from another branch order', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(
      buildOrder({ organizationId: otherBranchId }) as never,
    );

    await expect(
      orderCorrectionService.removeSplitLine(orderId, lineId, managerActor, {
        reason: 'Guest 1 actually paid cash, not M-Pesa as recorded',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('MANAGER can add a corrected split line within the order total', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(
      buildOrder({ splitPaymentLines: [] }) as never,
    );
    vi.mocked(orderCorrectionRepository.addSplitLine).mockResolvedValue({ id: lineId } as never);

    await expect(
      orderCorrectionService.addSplitLine(orderId, managerActor, {
        label: 'Guest 1',
        amount: 500,
        method: 'CASH',
        reason: 'Guest 1 actually paid cash, not M-Pesa as recorded',
      }),
    ).resolves.toBeDefined();
  });

  it('rejects a new split line that would push the total over the order total', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(buildOrder() as never);

    await expect(
      orderCorrectionService.addSplitLine(orderId, managerActor, {
        label: 'Guest 3',
        amount: 500,
        method: 'CASH',
        reason: 'Guest 1 actually paid cash, not M-Pesa as recorded',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('orderCorrectionService — convert to split payment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('MANAGER can convert a single-method order to split with matching lines', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(
      buildOrder({ paymentMethod: 'CASH', splitPaymentLines: [] }) as never,
    );
    vi.mocked(orderCorrectionRepository.convertToSplit).mockResolvedValue([{ id: lineId }] as never);

    await expect(
      orderCorrectionService.convertToSplit(orderId, managerActor, {
        lines: [
          { label: 'Guest 1', amount: 500, method: 'CASH' },
          { label: 'Guest 2', amount: 400, method: 'CASH' },
        ],
        reason: 'Table actually split the bill between two guests, not one cash payment',
      }),
    ).resolves.toBeDefined();
  });

  it('rejects conversion when the order is not CLOSED', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(
      buildOrder({ status: 'READY', paymentMethod: 'CASH' }) as never,
    );

    await expect(
      orderCorrectionService.convertToSplit(orderId, managerActor, {
        lines: [
          { label: 'Guest 1', amount: 500, method: 'CASH' },
          { label: 'Guest 2', amount: 400, method: 'CASH' },
        ],
        reason: 'Table actually split the bill between two guests, not one cash payment',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects conversion when the order is already SPLIT', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(
      buildOrder({ paymentMethod: 'SPLIT' }) as never,
    );

    await expect(
      orderCorrectionService.convertToSplit(orderId, managerActor, {
        lines: [
          { label: 'Guest 1', amount: 500, method: 'CASH' },
          { label: 'Guest 2', amount: 400, method: 'CASH' },
        ],
        reason: 'Table actually split the bill between two guests, not one cash payment',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects conversion when the lines do not sum to the order total', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(
      buildOrder({ paymentMethod: 'CASH', total: '900.00', splitPaymentLines: [] }) as never,
    );

    await expect(
      orderCorrectionService.convertToSplit(orderId, managerActor, {
        lines: [
          { label: 'Guest 1', amount: 500, method: 'CASH' },
          { label: 'Guest 2', amount: 300, method: 'CASH' },
        ],
        reason: 'Table actually split the bill between two guests, not one cash payment',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('MANAGER cannot convert an order from another branch', async () => {
    vi.mocked(orderCorrectionRepository.findById).mockResolvedValue(
      buildOrder({ organizationId: otherBranchId, paymentMethod: 'CASH' }) as never,
    );

    await expect(
      orderCorrectionService.convertToSplit(orderId, managerActor, {
        lines: [
          { label: 'Guest 1', amount: 500, method: 'CASH' },
          { label: 'Guest 2', amount: 400, method: 'CASH' },
        ],
        reason: 'Table actually split the bill between two guests, not one cash payment',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
