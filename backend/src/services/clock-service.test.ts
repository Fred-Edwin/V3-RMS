import { Prisma, UserRole } from '@prisma/client';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../repositories/branch-repository';
import { clockRecordRepository } from '../repositories/clock-record-repository';
import { shiftAssignmentRepository } from '../repositories/shift-assignment-repository';
import { clockService } from './clock-service';

vi.mock('../repositories/branch-repository', () => ({
  branchRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('../repositories/clock-record-repository', () => ({
  clockRecordRepository: {
    findByAssignmentId: vi.fn(),
    findOpenByUserId: vi.fn(),
    createClockIn: vi.fn(),
    updateClockOut: vi.fn(),
    closeStaleOpenRecords: vi.fn(),
  },
}));

vi.mock('../repositories/shift-assignment-repository', () => ({
  shiftAssignmentRepository: {
    findById: vi.fn(),
  },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'WAITER',
  organizationId: '22222222-2222-4222-8222-222222222222',
} as NonNullable<Request['user']>;

const organizationId = '22222222-2222-4222-8222-222222222222';

const managerActor = {
  id: '99999999-9999-4999-8999-999999999999',
  role: 'MANAGER',
  organizationId,
} as NonNullable<Request['user']>;

const todayAssignment = {
  id: '33333333-3333-4333-8333-333333333333',
  organizationId,
  userId: actor.id,
  shiftId: '44444444-4444-4444-8444-444444444444',
  date: new Date('2026-03-06T00:00:00.000Z'),
  createdAt: new Date('2026-03-06T00:00:00.000Z'),
  updatedAt: new Date('2026-03-06T00:00:00.000Z'),
  shift: {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Morning',
    startTime: '06:00',
    endTime: '14:00',
    isActive: true,
  },
  user: {
    id: actor.id,
    name: 'Jane Staff',
    role: UserRole.WAITER,
    isActive: true,
  },
  clockRecord: null,
};

describe('clockService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T08:00:00.000Z'));
    vi.mocked(shiftAssignmentRepository.findById).mockResolvedValue(todayAssignment);
    vi.mocked(branchRepository.findById).mockResolvedValue({
      id: organizationId,
      name: 'Wendo Branch',
      address: 'Nyeri',
      city: 'Nyeri',
      latitude: new Prisma.Decimal('-0.4167'),
      longitude: new Prisma.Decimal('36.9500'),
      phone: null,
      mpesaPaybill: null,
      accountNumber: null,
      isActive: true,
      isHub: false,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });
  });

  it('returns structured geofence details when outside the branch radius', async () => {
    vi.mocked(clockRecordRepository.findByAssignmentId).mockResolvedValue(null);
    vi.mocked(clockRecordRepository.findOpenByUserId).mockResolvedValue(null);

    await expect(
      clockService.clockIn(actor, {
        shiftAssignmentId: todayAssignment.id,
        latitude: -0.4067,
        longitude: 36.9600,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'CLOCK_OUTSIDE_GEOFENCE',
      details: expect.objectContaining({
        allowedRadiusMetres: 50,
      }),
    });
  });

  it('blocks manager override clock-in when staff already has another open shift', async () => {
    vi.mocked(clockRecordRepository.findByAssignmentId).mockResolvedValue(null);
    vi.mocked(clockRecordRepository.findOpenByUserId).mockResolvedValue({
      id: 'open-record',
      organizationId,
      shiftAssignmentId: 'another-assignment',
      userId: actor.id,
      clockInAt: new Date('2026-03-06T05:00:00.000Z'),
      clockOutAt: null,
      clockInMethod: 'GPS',
      clockOutMethod: null,
      overrideById: null,
      overrideNote: null,
      createdAt: new Date('2026-03-06T05:00:00.000Z'),
      updatedAt: new Date('2026-03-06T05:00:00.000Z'),
    });

    await expect(
      clockService.clockOverride(managerActor, {
        userId: actor.id,
        shiftAssignmentId: todayAssignment.id,
        action: 'CLOCK_IN',
        reason: 'Device GPS unavailable',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CLOCK_ALREADY_IN',
      details: expect.objectContaining({
        openShiftAssignmentId: 'another-assignment',
      }),
    });
  });

  it('returns a stale-state conflict when clock-out was already completed by another request', async () => {
    vi.mocked(clockRecordRepository.findByAssignmentId).mockResolvedValue({
      id: 'clock-record',
      organizationId,
      shiftAssignmentId: todayAssignment.id,
      userId: actor.id,
      clockInAt: new Date('2026-03-06T05:58:00.000Z'),
      clockOutAt: null,
      clockInMethod: 'GPS',
      clockOutMethod: null,
      overrideById: null,
      overrideNote: null,
      createdAt: new Date('2026-03-06T05:58:00.000Z'),
      updatedAt: new Date('2026-03-06T05:58:00.000Z'),
    });
    vi.mocked(clockRecordRepository.updateClockOut).mockResolvedValue(null);

    await expect(
      clockService.clockOut(actor, {
        shiftAssignmentId: todayAssignment.id,
        latitude: -0.4167,
        longitude: 36.95,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CLOCK_STALE_STATE',
    });
  });
});
