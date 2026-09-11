import { beforeEach, describe, expect, it, vi } from 'vitest';
import { orderCorrectionRepository } from '../src/repositories/order-correction-repository';
import { orderCorrectionService } from '../src/services/order-correction-service';
import { ConflictError, ForbiddenError } from '../src/utils/errors';

vi.mock('../src/repositories/order-correction-repository', () => ({
  orderCorrectionRepository: {
    findById: vi.fn(),
    removeOrderItem: vi.fn(),
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

const buildOrder = (overrides: Partial<{ organizationId: string; createdAt: Date; status: string }> = {}) => ({
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  organizationId: overrides.organizationId ?? ownBranchId,
  createdAt: overrides.createdAt ?? new Date(),
  status: overrides.status ?? 'CLOSED',
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
