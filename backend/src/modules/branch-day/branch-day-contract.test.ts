/**
 * Contract drift guard for the branch-day responses (plan §4.5): every service
 * response is parsed through its frozen Zod schema, and the request schemas
 * reject what they must (unknown keys, negative counts, OTHER without a note,
 * empty reopen reason).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { branchDayService } from './branch-day-service';
import { branchDayRepository } from './branch-day-repository';
import { referenceCounterRepository } from '../inventory/receiving-repository';
import { thresholdsRepository } from '../inventory/thresholds-repository';
import { authRepository } from '../../repositories/auth-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { comparePin } from '../../utils/password';
import {
  BranchDayTodaySchema,
  CloseDaySchema,
  CloseResultSchema,
  DayDocumentSchema,
  DepartmentDayDetailSchema,
  ReopenDaySchema,
  SaveDepartmentLinesSchema,
  SaveLinesResultSchema,
} from './branch-day-validators';

const D = (n: number) => new Prisma.Decimal(n);
const tx = { branchDayLine: { count: vi.fn() } };

vi.mock('./branch-day-repository', () => ({
  branchDayRepository: {
    findByDate: vi.fn(),
    findById: vi.fn(),
    departmentItems: vi.fn(),
    itemsByIds: vi.fn(),
    onHandExcludingDay: vi.fn(),
    latestInboundCosts: vi.fn(),
    inTransitDispatches: vi.fn(),
    upsertLines: vi.fn(),
    setDepartmentStatus: vi.fn(),
    activeAdjustments: vi.fn(),
    writeAdjustment: vi.fn(),
    closeDay: vi.fn(),
  },
}));
vi.mock('../inventory/receiving-repository', () => ({ referenceCounterRepository: { nextReference: vi.fn() } }));
vi.mock('../inventory/thresholds-repository', () => ({ thresholdsRepository: { findByOrganization: vi.fn() } }));
vi.mock('../../repositories/auth-repository', () => ({ authRepository: { findUserByIdWithPassword: vi.fn() } }));
vi.mock('../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../utils/password', () => ({ comparePin: vi.fn() }));
vi.mock('../../services/fcm-service', () => ({ fcmService: { sendBranchDayDirectorAlertPush: vi.fn() } }));
vi.mock('../../config/database', () => ({ prisma: { $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) } }));

const orgId = '22222222-2222-4222-8222-222222222222';
const dayId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';
const manager = { id: 'bm1', role: 'MANAGER' as const, organizationId: orgId, isDepartmentHead: false };
const TAGS = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];

const dayRow = (status: 'OPEN' | 'CLOSED') => ({
  id: dayId,
  organizationId: orgId,
  businessDate: new Date('2026-09-30T00:00:00Z'),
  status,
  reference: 'DAY-0001',
  closedById: status === 'CLOSED' ? '55555555-5555-4555-8555-555555555555' : null,
  closedAt: status === 'CLOSED' ? new Date('2026-09-30T18:40:00Z') : null,
  closedBy: status === 'CLOSED' ? { id: '55555555-5555-4555-8555-555555555555', name: 'Peter Njoroge' } : null,
  reopenCount: 0,
  createdAt: new Date('2026-09-30T03:00:00Z'),
  organization: { id: orgId, name: 'Nyeri Town', address: 'Kimathi Way', city: 'Nyeri', phone: null },
  reopens: [],
  departments: TAGS.map((tag) => ({
    id: `dept-${tag}`,
    branchDayId: dayId,
    departmentTag: tag,
    locationId: `loc-${tag}`,
    status: 'NOT_STARTED',
    countedById: null,
    countedAt: null,
    countedBy: null,
    lines:
      tag === 'KITCHEN'
        ? [
            {
              id: '66666666-6666-4666-8666-666666666666',
              branchDayDepartmentId: 'dept-KITCHEN',
              inventoryItemId: itemId,
              countedQty: D(9),
              expectedQty: D(14),
              unitCost: D(200),
              reason: 'UNLOGGED_WASTE',
              reasonNote: null,
              reasonRequired: true,
            },
          ]
        : [],
  })),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' } as never);
  vi.mocked(thresholdsRepository.findByOrganization).mockResolvedValue(null);
  vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ name: 'Peter Njoroge', pinHash: 'h' } as never);
  vi.mocked(comparePin).mockResolvedValue(true);
  vi.mocked(branchDayRepository.inTransitDispatches).mockResolvedValue([]);
  vi.mocked(branchDayRepository.findByDate).mockResolvedValue(null);
  vi.mocked(branchDayRepository.departmentItems).mockImplementation(async (_h, _o, loc) =>
    loc === 'loc-KITCHEN' ? ([{ id: itemId, name: 'Chicken', usageUnit: 'pcs', currentCost: D(200) }] as never) : [],
  );
  vi.mocked(branchDayRepository.itemsByIds).mockResolvedValue([]);
  vi.mocked(branchDayRepository.onHandExcludingDay).mockResolvedValue(new Map([[itemId, D(14)]]));
  vi.mocked(branchDayRepository.latestInboundCosts).mockResolvedValue(new Map());
  vi.mocked(branchDayRepository.activeAdjustments).mockResolvedValue([]);
  tx.branchDayLine.count.mockResolvedValue(1);
  vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('ADJ-0001');
});

describe('response contracts', () => {
  it('today, department detail, save result', async () => {
    vi.mocked(branchDayRepository.findByDate).mockResolvedValue(dayRow('OPEN') as never);
    vi.mocked(branchDayRepository.findById).mockResolvedValue(dayRow('OPEN') as never);
    const today = await branchDayService.getToday(manager as never);
    expect(() => BranchDayTodaySchema.parse(JSON.parse(JSON.stringify(today)))).not.toThrow();
    const detail = await branchDayService.getDepartment(manager as never, dayId, 'KITCHEN');
    expect(() => DepartmentDayDetailSchema.parse(JSON.parse(JSON.stringify(detail)))).not.toThrow();
    const saved = await branchDayService.saveLines(manager as never, dayId, 'KITCHEN', { lines: [{ inventoryItemId: itemId, countedQty: '9', reason: 'UNLOGGED_WASTE' }] });
    expect(() => SaveLinesResultSchema.parse(JSON.parse(JSON.stringify(saved)))).not.toThrow();
  });

  it('close result and signed document', async () => {
    vi.mocked(branchDayRepository.findById).mockResolvedValue(dayRow('OPEN') as never);
    const closed = await branchDayService.close(manager as never, dayId, { pin: '1234' });
    expect(() => CloseResultSchema.parse(JSON.parse(JSON.stringify(closed)))).not.toThrow();

    vi.mocked(branchDayRepository.findById).mockResolvedValue(dayRow('CLOSED') as never);
    const doc = await branchDayService.getDocument(manager as never, dayId);
    expect(() => DayDocumentSchema.parse(JSON.parse(JSON.stringify(doc)))).not.toThrow();
  });
});

describe('request contracts', () => {
  it('rejects unknown keys, negative counts, OTHER without a note, blank reopen reasons and blank PINs', () => {
    expect(SaveDepartmentLinesSchema.safeParse({ lines: [{ inventoryItemId: itemId, countedQty: '-1' }] }).success).toBe(false);
    expect(SaveDepartmentLinesSchema.safeParse({ lines: [{ inventoryItemId: itemId, countedQty: '1', expectedQty: '5' }] }).success).toBe(false);
    expect(SaveDepartmentLinesSchema.safeParse({ lines: [{ inventoryItemId: itemId, countedQty: '1', reason: 'OTHER' }] }).success).toBe(false);
    expect(SaveDepartmentLinesSchema.safeParse({ lines: [{ inventoryItemId: itemId, countedQty: '1', reason: 'OTHER', reasonNote: 'Spilled' }] }).success).toBe(true);
    expect(SaveDepartmentLinesSchema.safeParse({ lines: [{ inventoryItemId: itemId, countedQty: null }] }).success).toBe(true);
    expect(SaveDepartmentLinesSchema.safeParse({ lines: [] }).success).toBe(false);
    expect(ReopenDaySchema.safeParse({ reason: '   ' }).success).toBe(false);
    expect(ReopenDaySchema.safeParse({ reason: 'Wrong department' }).success).toBe(true);
    expect(CloseDaySchema.safeParse({ pin: '' }).success).toBe(false);
    expect(CloseDaySchema.safeParse({ pin: '1234', extra: 1 }).success).toBe(false);
  });
});
