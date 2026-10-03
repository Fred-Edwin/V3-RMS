import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shiftAssignmentRepository } from '../repositories/shift-assignment-repository';
import { shiftRepository } from '../repositories/shift-repository';
import { staffRepository } from '../repositories/staff-repository';
import { formatDateOnly, getTodayDateOnly, parseDateOnly } from '../utils/date-only';
import { shiftAssignmentService } from './shift-assignment-service';

vi.mock('../repositories/shift-assignment-repository', () => ({
  shiftAssignmentRepository: {
    findBySiteAndDateRange: vi.fn(),
    findByUserAndDateRange: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    reconcileWeek: vi.fn(),
  },
}));

vi.mock('../repositories/shift-repository', () => ({
  shiftRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('../repositories/staff-repository', () => ({
  staffRepository: {
    findById: vi.fn(),
  },
}));

const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'MANAGER',
  siteId: '22222222-2222-4222-8222-222222222222',
} as NonNullable<Request['user']>;

const siteId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const shiftId = '44444444-4444-4444-8444-444444444444';
const shiftId2 = '66666666-6666-4666-8666-666666666666';

const makeAssignment = (overrides: Partial<Awaited<ReturnType<typeof shiftAssignmentRepository.findByUserAndDateRange>>[number]> = {}) => ({
  id: '55555555-5555-4555-8555-555555555555',
  siteId,
  userId,
  shiftId,
  date: parseDateOnly(formatDateOnly(getTodayDateOnly())),
  createdAt: new Date('2026-02-24T10:00:00.000Z'),
  updatedAt: new Date('2026-02-24T10:00:00.000Z'),
  shift: {
    id: shiftId,
    name: 'Morning',
    startTime: '06:00',
    endTime: '14:00',
    isActive: true,
  },
  user: {
    id: userId,
    name: 'Staff Member',
    role: UserRole.WAITER,
    departmentTag: null,
    isActive: true,
  },
  clockRecord: null,
  ...overrides,
});

describe('shiftAssignmentService.createAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(staffRepository.findById).mockResolvedValue({
      id: userId,
      name: 'Staff Member',
      email: 'staff@wendo.co.ke',
      phone: null,
      role: 'WAITER',
      isActive: true,
      siteId,
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      site: {
        name: 'Wendo Kingz',
      },
    });

    vi.mocked(shiftRepository.findById).mockResolvedValue({
      id: shiftId,
      siteId,
      name: 'Morning',
      startTime: '06:00',
      endTime: '14:00',
      isActive: true,
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      updatedAt: new Date('2026-02-24T10:00:00.000Z'),
    });
  });

  it('rejects creating assignments for past dates', async () => {
    const yesterday = new Date(getTodayDateOnly());
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    await expect(
      shiftAssignmentService.createAssignment(actor, {
        userId,
        shiftId,
        date: formatDateOnly(yesterday),
      }),
    ).rejects.toThrow('Cannot create shift assignments for past dates');

    expect(shiftAssignmentRepository.create).not.toHaveBeenCalled();
  });

  it('creates assignment for today and returns stable YYYY-MM-DD', async () => {
    const today = formatDateOnly(getTodayDateOnly());
    vi.mocked(shiftAssignmentRepository.findByUserAndDateRange).mockResolvedValue([]);
    vi.mocked(shiftAssignmentRepository.create).mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      siteId,
      userId,
      shiftId,
      date: parseDateOnly(today),
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      updatedAt: new Date('2026-02-24T10:00:00.000Z'),
    });

    const result = await shiftAssignmentService.createAssignment(actor, {
      userId,
      shiftId,
      date: today,
    });

    expect(result!.date).toBe(today);
    expect(shiftAssignmentRepository.create).toHaveBeenCalledWith(
      siteId,
      expect.objectContaining({
        userId,
        shiftId,
      }),
    );
  });
});

describe('shiftAssignmentService.reconcileWeek', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(staffRepository.findById).mockResolvedValue({
      id: userId,
      name: 'Staff Member',
      email: 'staff@wendo.co.ke',
      phone: null,
      role: 'WAITER',
      isActive: true,
      siteId,
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      site: {
        name: 'Wendo Kingz',
      },
    });

    vi.mocked(shiftRepository.findById).mockResolvedValue({
      id: shiftId,
      siteId,
      name: 'Morning',
      startTime: '06:00',
      endTime: '14:00',
      isActive: true,
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      updatedAt: new Date('2026-02-24T10:00:00.000Z'),
    });

    vi.mocked(shiftAssignmentRepository.findBySiteAndDateRange).mockResolvedValue([]);
  });

  it('creates a new assignment from an empty roster cell', async () => {
    const today = formatDateOnly(getTodayDateOnly());
    vi.mocked(shiftAssignmentRepository.findByUserAndDateRange).mockResolvedValue([]);

    const result = await shiftAssignmentService.reconcileWeek(actor, {
      weekStart: today,
      changes: [{ userId, date: today, shiftId }],
    });

    expect(result.saved).toBe(1);
    expect(shiftAssignmentRepository.reconcileWeek).toHaveBeenCalledWith(
      siteId,
      [expect.objectContaining({ userId, shiftId, deleteIds: [] })],
    );
  });

  it('changes an existing assignment to another shift', async () => {
    const today = formatDateOnly(getTodayDateOnly());
    vi.mocked(shiftAssignmentRepository.findByUserAndDateRange).mockResolvedValue([makeAssignment()]);
    vi.mocked(shiftRepository.findById).mockResolvedValue({
      id: shiftId2,
      siteId,
      name: 'Evening',
      startTime: '14:00',
      endTime: '22:00',
      isActive: true,
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      updatedAt: new Date('2026-02-24T10:00:00.000Z'),
    });

    const result = await shiftAssignmentService.reconcileWeek(actor, {
      weekStart: today,
      changes: [{ userId, date: today, shiftId: shiftId2 }],
    });

    expect(result.saved).toBe(1);
    expect(shiftAssignmentRepository.reconcileWeek).toHaveBeenCalledWith(
      siteId,
      [expect.objectContaining({ userId, shiftId: shiftId2, deleteIds: ['55555555-5555-4555-8555-555555555555'] })],
    );
  });

  it('clears an assignment when shiftId is null', async () => {
    const today = formatDateOnly(getTodayDateOnly());
    vi.mocked(shiftAssignmentRepository.findByUserAndDateRange).mockResolvedValue([makeAssignment()]);

    const result = await shiftAssignmentService.reconcileWeek(actor, {
      weekStart: today,
      changes: [{ userId, date: today, shiftId: null }],
    });

    expect(result.saved).toBe(1);
    expect(shiftAssignmentRepository.reconcileWeek).toHaveBeenCalledWith(
      siteId,
      [expect.objectContaining({ userId, shiftId: null, deleteIds: ['55555555-5555-4555-8555-555555555555'] })],
    );
  });

  it('rejects changing an assignment with a clock record', async () => {
    const today = formatDateOnly(getTodayDateOnly());
    vi.mocked(shiftAssignmentRepository.findByUserAndDateRange).mockResolvedValue([
      makeAssignment({
        clockRecord: {
          id: '77777777-7777-4777-8777-777777777777',
          clockInAt: new Date('2026-02-24T06:00:00.000Z'),
          clockOutAt: null,
          clockInMethod: 'GPS',
          clockOutMethod: null,
          overrideById: null,
          overrideNote: null,
        },
      }),
    ]);

    const result = await shiftAssignmentService.reconcileWeek(actor, {
      weekStart: today,
      changes: [{ userId, date: today, shiftId: null }],
    });

    expect(result.saved).toBe(0);
    expect(result.errors[0]?.reason).toContain('attendance records');
    expect(shiftAssignmentRepository.reconcileWeek).not.toHaveBeenCalled();
  });
});

describe('shiftAssignmentService — department-head scoping (isDepartmentHead marker)', () => {
  const branchOrgId = '22222222-2222-4222-8222-222222222222';
  const otherOrgId = '99999999-9999-4999-8999-999999999999';
  // A Kitchen head is a real CHEF who also carries the isDepartmentHead marker.
  const kitchenHead = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    role: 'CHEF',
    isDepartmentHead: true,
    departmentTag: 'KITCHEN',
    siteId: branchOrgId,
  } as NonNullable<Request['user']>;

  const chef = {
    id: userId,
    name: 'Chef Ann',
    email: 'chef@wendo.co.ke',
    phone: null,
    role: 'CHEF' as UserRole,
    isActive: true,
    siteId: branchOrgId,
    createdAt: new Date('2026-02-24T10:00:00.000Z'),
    site: { name: 'Wendo Kingz' },
  };
  const waiter = { ...chef, role: 'WAITER' as UserRole, name: 'Waiter Ben' };

  const today = () => formatDateOnly(getTodayDateOnly());
  const createdRow = {
    id: '55555555-5555-4555-8555-555555555555',
    siteId: branchOrgId,
    userId,
    shiftId,
    date: parseDateOnly(formatDateOnly(getTodayDateOnly())),
    createdAt: new Date('2026-02-24T10:00:00.000Z'),
    updatedAt: new Date('2026-02-24T10:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shiftRepository.findById).mockResolvedValue({
      id: shiftId,
      siteId: branchOrgId,
      name: 'Morning',
      startTime: '06:00',
      endTime: '14:00',
      isActive: true,
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      updatedAt: new Date('2026-02-24T10:00:00.000Z'),
    });
    vi.mocked(shiftAssignmentRepository.findByUserAndDateRange).mockResolvedValue([]);
  });

  it('lets a Kitchen head assign a CHEF at their own branch', async () => {
    vi.mocked(staffRepository.findById).mockResolvedValue(chef);
    vi.mocked(shiftAssignmentRepository.create).mockResolvedValue(createdRow);

    await shiftAssignmentService.createAssignment(kitchenHead, { userId, shiftId, date: today() });

    expect(shiftAssignmentRepository.create).toHaveBeenCalled();
  });

  it('forbids a Kitchen head from assigning a WAITER (another department)', async () => {
    vi.mocked(staffRepository.findById).mockResolvedValue(waiter);

    await expect(
      shiftAssignmentService.createAssignment(kitchenHead, { userId, shiftId, date: today() }),
    ).rejects.toThrow('your own department');

    expect(shiftAssignmentRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a foreign organizationId in the payload — the head is branch-pinned', async () => {
    vi.mocked(staffRepository.findById).mockResolvedValue(chef);

    await expect(
      shiftAssignmentService.createAssignment(kitchenHead, {
        userId,
        shiftId,
        date: today(),
        siteId: otherOrgId,
      }),
    ).rejects.toThrow('outside your branch');
  });

  it('scopes the head’s roster read to its department’s worked roles', async () => {
    vi.mocked(shiftAssignmentRepository.findBySiteAndDateRange).mockResolvedValue([]);

    await shiftAssignmentService.listAssignments(kitchenHead, {
      startDate: '2026-03-01',
      endDate: '2026-03-07',
    });

    const call = vi.mocked(shiftAssignmentRepository.findBySiteAndDateRange).mock.calls[0];
    expect(call?.[0]).toBe(branchOrgId);
    expect(call?.[3]?.userWhere).toEqual({ role: { in: ['CHEF'] } });
  });
});
