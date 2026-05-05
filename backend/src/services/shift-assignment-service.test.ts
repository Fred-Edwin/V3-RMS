import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shiftAssignmentRepository } from '../repositories/shift-assignment-repository';
import { shiftRepository } from '../repositories/shift-repository';
import { staffRepository } from '../repositories/staff-repository';
import { formatDateOnly, getTodayDateOnly, parseDateOnly } from '../utils/date-only';
import { shiftAssignmentService } from './shift-assignment-service';

vi.mock('../repositories/shift-assignment-repository', () => ({
  shiftAssignmentRepository: {
    findByOrganizationAndDateRange: vi.fn(),
    findByUserAndDateRange: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
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
  organizationId: '22222222-2222-4222-8222-222222222222',
} as NonNullable<Request['user']>;

const organizationId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const shiftId = '44444444-4444-4444-8444-444444444444';

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
      organizationId,
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      organization: {
        name: 'Wendo Kingz',
      },
    });

    vi.mocked(shiftRepository.findById).mockResolvedValue({
      id: shiftId,
      organizationId,
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
      organizationId,
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
      organizationId,
      expect.objectContaining({
        userId,
        shiftId,
      }),
    );
  });
});
