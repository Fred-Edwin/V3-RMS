import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../repositories/branch-repository';
import { payslipRepository } from '../repositories/payslip-repository';
import { payslipService } from './payslip-service';

vi.mock('../repositories/payslip-repository', () => ({
  payslipRepository: {
    findTargetUserById: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    listMine: vi.fn(),
    listByBranch: vi.fn(),
    update: vi.fn(),
    lock: vi.fn(),
  },
}));

vi.mock('../repositories/branch-repository', () => ({
  branchRepository: {
    findActiveIds: vi.fn(),
  },
}));

type Actor = NonNullable<Request['user']>;

const branchId = '11111111-1111-4111-8111-111111111111';
const otherBranchId = '22222222-2222-4222-8222-222222222222';
const payslipId = 'pay_123';
const waiterId = '33333333-3333-4333-8333-333333333333';
const directorId = '44444444-4444-4444-8444-444444444444';

const directorActor = {
  id: directorId,
  role: 'DIRECTOR',
  organizationId: null,
} as Actor;

const accountantActor = {
  id: '55555555-5555-4555-8555-555555555555',
  role: 'ACCOUNTANT',
  organizationId: null,
} as Actor;

const waiterActor = {
  id: waiterId,
  role: 'WAITER',
  organizationId: branchId,
} as Actor;

const managerActor = {
  id: '66666666-6666-4666-8666-666666666666',
  role: 'MANAGER',
  organizationId: branchId,
} as Actor;

const buildPayslip = (overrides: Record<string, unknown> = {}) => ({
  id: payslipId,
  organizationId: branchId,
  userId: waiterId,
  payPeriod: '2026-04',
  payDate: new Date('2026-04-30T00:00:00.000Z'),
  basicSalary: new Prisma.Decimal('40000.00'),
  houseAllowance: new Prisma.Decimal('5000.00'),
  transportAllowance: new Prisma.Decimal('3000.00'),
  otherAllowances: [{ label: 'Overtime', amount: '2000.00' }],
  paye: new Prisma.Decimal('4500.00'),
  nssf: new Prisma.Decimal('1080.00'),
  housingLevy: new Prisma.Decimal('720.00'),
  helb: new Prisma.Decimal('620.00'),
  otherDeductions: [{ label: 'Advance', amount: '1000.00' }],
  grossPay: new Prisma.Decimal('50000.00'),
  totalDeductions: new Prisma.Decimal('7920.00'),
  netPay: new Prisma.Decimal('42080.00'),
  isLocked: false,
  createdById: directorId,
  createdAt: new Date(),
  updatedAt: new Date(),
  organization: { id: branchId, name: 'Town Branch' },
  user: {
    id: waiterId,
    name: 'Mercy Wanjiru',
    email: 'mercy@example.com',
    role: 'WAITER',
    organizationId: branchId,
    employeeProfile: { jobTitle: 'Barista' },
  },
  createdBy: {
    id: directorId,
    name: 'Grace Maina',
    role: 'DIRECTOR',
  },
  ...overrides,
});

describe('payslipService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes and stores totals on create', async () => {
    vi.mocked(payslipRepository.findTargetUserById).mockResolvedValue({
      id: waiterId,
      name: 'Mercy Wanjiru',
      role: 'WAITER',
      organizationId: branchId,
      isActive: true,
    });
    vi.mocked(payslipRepository.create).mockResolvedValue(buildPayslip() as never);

    await payslipService.create(directorActor, {
      userId: waiterId,
      payPeriod: '2026-04',
      payDate: '2026-04-30',
      basicSalary: '40000.00',
      houseAllowance: '5000.00',
      transportAllowance: '3000.00',
      otherAllowances: [{ label: 'Overtime', amount: '2000.00' }],
      paye: '4500.00',
      nssf: '1080.00',
      housingLevy: '720.00',
      helb: '620.00',
      otherDeductions: [{ label: 'Advance', amount: '1000.00' }],
    });

    expect(payslipRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: branchId,
        grossPay: expect.objectContaining({ toFixed: expect.any(Function) }),
        totalDeductions: expect.objectContaining({ toFixed: expect.any(Function) }),
        netPay: expect.objectContaining({ toFixed: expect.any(Function) }),
      }),
    );

    const payload = vi.mocked(payslipRepository.create).mock.calls[0]?.[0];
    expect(payload?.grossPay.toFixed(2)).toBe('50000.00');
    expect(payload?.totalDeductions.toFixed(2)).toBe('7920.00');
    expect(payload?.netPay.toFixed(2)).toBe('42080.00');
  });

  it('rejects unauthorized actors', async () => {
    await expect(
      payslipService.create(waiterActor, {
        userId: waiterId,
        payPeriod: '2026-04',
        payDate: '2026-04-30',
        basicSalary: '40000.00',
        paye: '4500.00',
        nssf: '1080.00',
        housingLevy: '720.00',
      }),
    ).rejects.toThrow('Only HR Managers, Directors, and System Admins can modify payslips');
  });

  it('maps duplicate payslip creation to ConflictError', async () => {
    vi.mocked(payslipRepository.findTargetUserById).mockResolvedValue({
      id: waiterId,
      name: 'Mercy Wanjiru',
      role: 'WAITER',
      organizationId: branchId,
      isActive: true,
    });
    vi.mocked(payslipRepository.create).mockRejectedValue(
      new PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      payslipService.create(directorActor, {
        userId: waiterId,
        payPeriod: '2026-04',
        payDate: '2026-04-30',
        basicSalary: '40000.00',
        paye: '4500.00',
        nssf: '1080.00',
        housingLevy: '720.00',
      }),
    ).rejects.toThrow('A payslip already exists for this staff member and pay period');
  });
});

describe('payslipService permissions and locking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows accountant to list but not mutate', async () => {
    vi.mocked(branchRepository.findActiveIds).mockResolvedValue([branchId, otherBranchId]);
    vi.mocked(payslipRepository.list).mockResolvedValue({
      items: [buildPayslip(), buildPayslip({ id: 'pay_456', organizationId: otherBranchId })] as never,
      total: 2,
    });

    const result = await payslipService.list(accountantActor, {
      page: 1,
      perPage: 20,
    });

    expect(result.total).toBe(2);

    await expect(
      payslipService.lock(accountantActor, payslipId),
    ).rejects.toThrow('Only HR Managers, Directors, and System Admins can modify payslips');
  });

  it('blocks manager branch access to another branch', async () => {
    await expect(
      payslipService.listByBranch(managerActor, otherBranchId, {
        page: 1,
        perPage: 20,
      }),
    ).rejects.toThrow('Managers can only access payslips for their own branch');
  });

  it('blocks non-owner staff from viewing another staff payslip', async () => {
    vi.mocked(payslipRepository.findById).mockResolvedValue(
      buildPayslip({ userId: '77777777-7777-4777-8777-777777777777' }) as never,
    );

    await expect(
      payslipService.getById(waiterActor, payslipId),
    ).rejects.toThrow('You can only view your own payslips');
  });

  it('prevents updates to locked payslips', async () => {
    vi.mocked(branchRepository.findActiveIds).mockResolvedValue([branchId]);
    vi.mocked(payslipRepository.findById).mockResolvedValue(
      buildPayslip({ isLocked: true }) as never,
    );

    await expect(
      payslipService.update(directorActor, payslipId, { basicSalary: '45000.00' }),
    ).rejects.toThrow('Locked payslips cannot be edited');
  });

  it('locks an unlocked payslip', async () => {
    vi.mocked(branchRepository.findActiveIds).mockResolvedValue([branchId]);
    vi.mocked(payslipRepository.findById).mockResolvedValue(buildPayslip() as never);
    vi.mocked(payslipRepository.lock).mockResolvedValue(
      buildPayslip({ isLocked: true }) as never,
    );

    const result = await payslipService.lock(directorActor, payslipId);
    expect(result.isLocked).toBe(true);
    expect(payslipRepository.lock).toHaveBeenCalledWith(payslipId, branchId);
  });
});
