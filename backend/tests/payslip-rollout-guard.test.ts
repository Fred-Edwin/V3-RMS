import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/modules/workforce', () => ({ isSitePeriodOnNewPayroll: vi.fn() }));
vi.mock('../src/repositories/payslip-repository', () => ({
  payslipRepository: {
    bulkUpsert: vi.fn(async () => ({ saved: [], skipped: [] })),
    publishPeriod: vi.fn(async () => 3),
    revertPeriod: vi.fn(async () => 3),
    list: vi.fn(async () => ({ rows: [], total: 0 })),
    findById: vi.fn(async () => null),
  },
}));
vi.mock('../src/repositories/branch-repository', () => ({ branchRepository: {} }));

import { isSitePeriodOnNewPayroll } from '../src/modules/workforce';
import { payslipRepository } from '../src/repositories/payslip-repository';
import { payslipService, type PayslipActor } from '../src/services/payslip-service';

const hr = { id: 'hr1', role: 'HR_MANAGER', siteId: null } as unknown as PayslipActor;
const SITE = 'a0000000-0000-4000-8000-000000000001';
const row = { userId: 'b0000000-0000-4000-8000-000000000002', payDate: '2026-09-30', grossPay: '50000', paye: '8000', sha: '500', nssfTier1: '420', nssfTier2: '0', housingLevy: '750' };
const upsert = { payPeriod: '2026-09', siteId: SITE, rows: [row] } as Parameters<typeof payslipService.bulkUpsert>[1];
const period = { payPeriod: '2026-09', siteId: SITE };
const covered = vi.mocked(isSitePeriodOnNewPayroll);

beforeEach(() => vi.clearAllMocks());

describe('the old payslip run and the new Payroll (E10: a person is paid by one system a month)', () => {
  describe('a site and month the new Payroll covers', () => {
    beforeEach(() => covered.mockResolvedValue(true));

    it('refuses to save, and writes nothing', async () => {
      await expect(payslipService.bulkUpsert(hr, upsert)).rejects.toMatchObject({ statusCode: 409, code: 'PAID_IN_NEW_PAYROLL', message: 'This site and month are paid in the new Payroll.' });
      expect(payslipRepository.bulkUpsert).not.toHaveBeenCalled();
    });

    it('refuses to publish, and publishes nothing', async () => {
      await expect(payslipService.publish(hr, period)).rejects.toMatchObject({ statusCode: 409, code: 'PAID_IN_NEW_PAYROLL' });
      expect(payslipRepository.publishPeriod).not.toHaveBeenCalled();
    });

    it('refuses to revert, and reverts nothing', async () => {
      await expect(payslipService.revert(hr, period)).rejects.toMatchObject({ statusCode: 409, code: 'PAID_IN_NEW_PAYROLL' });
      expect(payslipRepository.revertPeriod).not.toHaveBeenCalled();
    });

    it('asks about the exact site and month it was given', async () => {
      await payslipService.publish(hr, period).catch(() => undefined);
      expect(covered).toHaveBeenCalledWith(SITE, '2026-09');
    });

    it('keeps history readable: listing is not guarded', async () => {
      await expect(payslipService.list(hr, { page: 1, limit: 20, siteId: SITE, payPeriod: '2026-09' } as Parameters<typeof payslipService.list>[1])).resolves.toBeDefined();
      expect(covered).not.toHaveBeenCalled();
    });
  });

  describe('a site the new Payroll does not cover', () => {
    beforeEach(() => covered.mockResolvedValue(false));

    it('saves, publishes and reverts exactly as before', async () => {
      await expect(payslipService.bulkUpsert(hr, upsert)).resolves.toEqual({ saved: [], skipped: [] });
      await expect(payslipService.publish(hr, period)).resolves.toEqual({ count: 3 });
      await expect(payslipService.revert(hr, period)).resolves.toEqual({ count: 3 });
      expect(payslipRepository.bulkUpsert).toHaveBeenCalledTimes(1);
    });
  });

  it('checks the role first, so a person who may not save learns nothing about the new system', async () => {
    covered.mockResolvedValue(true);
    const waiter = { id: 'w1', role: 'WAITER', siteId: SITE } as unknown as PayslipActor;
    await expect(payslipService.bulkUpsert(waiter, upsert)).rejects.toMatchObject({ statusCode: 403 });
    expect(covered).not.toHaveBeenCalled();
  });
});
