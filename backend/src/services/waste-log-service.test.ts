import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/database';
import { wasteLogRepository } from '../repositories/waste-log-repository';
import { inventoryItemRepository } from '../repositories/inventory-item-repository';
import { inventoryTransactionRepository } from '../repositories/inventory-transaction-repository';
import { wasteLogService } from './waste-log-service';
import { ValidationError } from '../utils/errors';

vi.mock('../config/database', () => ({
  prisma: {
    $transaction: vi.fn(),
    wasteLog: { create: vi.fn() },
  },
}));

vi.mock('../repositories/waste-log-repository', () => ({
  wasteLogRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
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

const organizationId = '11111111-1111-4111-8111-111111111111';
const managerId = '22222222-2222-4222-8222-222222222222';
const attendantId = '33333333-3333-4333-8333-333333333333';
const locationId = '44444444-4444-4444-8444-444444444444';
const itemId = '55555555-5555-4555-8555-555555555555';
const entryId = '66666666-6666-4666-8666-666666666666';

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const managerActor = { id: managerId, role: 'STORE_MANAGER' as const, organizationId };
const attendantActor = { id: attendantId, role: 'STORE_ATTENDANT' as const, organizationId };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) =>
    (fn as (tx: unknown) => Promise<unknown>)(prisma),
  );
});

describe('wasteLogService.list visibility (§8.3 footnote)', () => {
  it('Manager sees all entries — no loggedById filter applied', async () => {
    vi.mocked(wasteLogRepository.findAllByOrganization).mockResolvedValue([] as never);

    await wasteLogService.list(managerActor, { locationId });

    expect(wasteLogRepository.findAllByOrganization).toHaveBeenCalledWith(organizationId, {
      locationId,
      loggedById: undefined,
    });
  });

  it('Attendant sees only entries they logged themselves', async () => {
    vi.mocked(wasteLogRepository.findAllByOrganization).mockResolvedValue([] as never);

    await wasteLogService.list(attendantActor, { locationId });

    expect(wasteLogRepository.findAllByOrganization).toHaveBeenCalledWith(organizationId, {
      locationId,
      loggedById: attendantId,
    });
  });
});

describe('wasteLogService.create', () => {
  it('writes the WasteLog row and a negative-quantity WASTE ledger transaction atomically', async () => {
    vi.mocked(inventoryItemRepository.findById).mockResolvedValue({ id: itemId, currentCost: d(150) } as never);
    vi.mocked(prisma.wasteLog.create).mockResolvedValue({ id: entryId } as never);
    vi.mocked(wasteLogRepository.findById).mockResolvedValue({
      id: entryId,
      organizationId,
      locationId,
      inventoryItemId: itemId,
      quantity: d(1.2),
      reason: 'SPOILED',
      note: null,
      loggedById: attendantId,
      loggedAt: new Date(),
      inventoryItem: { id: itemId, name: 'Milk', usageUnit: 'l' },
    } as never);

    await wasteLogService.create(attendantActor, {
      locationId,
      inventoryItemId: itemId,
      quantity: '1.2',
      reason: 'SPOILED',
    });

    expect(inventoryTransactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        locationId,
        inventoryItemId: itemId,
        type: 'WASTE',
        unitCost: d(150),
        userId: attendantId,
        reason: 'SPOILED',
        wasteLogId: entryId,
      }),
      prisma,
    );
    const call = vi.mocked(inventoryTransactionRepository.create).mock.calls[0]![0];
    expect((call.quantity as Prisma.Decimal).toString()).toBe('-1.2');
  });

  it('rejects a zero quantity', async () => {
    await expect(
      wasteLogService.create(attendantActor, {
        locationId,
        inventoryItemId: itemId,
        quantity: '0',
        reason: 'SPOILED',
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('wasteLogService.getById own-entry enforcement for Attendant', () => {
  it('Attendant cannot fetch another user\'s entry (surfaced as not found)', async () => {
    vi.mocked(wasteLogRepository.findById).mockResolvedValue({
      id: entryId,
      loggedById: managerId,
    } as never);

    await expect(wasteLogService.getById(attendantActor, entryId)).rejects.toThrow('not found');
  });
});
