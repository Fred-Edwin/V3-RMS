import type { Request } from 'express';
import { Prisma, UserRole } from '@prisma/client';
import { branchRepository } from '../repositories/branch-repository';
import {
  payslipRepository,
  type PayslipLineItemStored,
  type PayslipWithRelations,
} from '../repositories/payslip-repository';
import type {
  BulkUpsertInput,
  BulkUpsertRowInput,
  PayslipBranchQuery,
  PayslipLineItemInput,
  PayslipListQuery,
  PayslipMineQuery,
  PublishInput,
  RevertInput,
} from '../validators/payslip-schemas';
import { ForbiddenError, NotFoundError } from '../utils/errors';

export type PayslipActor = NonNullable<Request['user']>;

const CROSS_BRANCH_READ_ROLES = new Set<UserRole>(['SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER']);
const MUTATION_ROLES = new Set<UserRole>(['SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER']);
const PUBLISH_ROLES = new Set<UserRole>(['DIRECTOR', 'HR_MANAGER']);
const HUMAN_ROLES = new Set<UserRole>([
  'SYSTEM_ADMIN',
  'DIRECTOR',
  'HR_MANAGER',
  'MANAGER',
  'ACCOUNTANT',
  'WAITER',
  'CHEF',
  'BARISTA',
]);

const ZERO = new Prisma.Decimal('0.00');

const normalizeLineItems = (items?: PayslipLineItemInput[]): PayslipLineItemStored[] | null => {
  if (!items || items.length === 0) return null;
  return items.map((item) => ({
    label: item.label.trim(),
    amount: new Prisma.Decimal(item.amount).toFixed(2),
  }));
};

const sumLineItems = (items: PayslipLineItemStored[] | null): Prisma.Decimal => {
  if (!items) return ZERO;
  return items.reduce(
    (acc, item) => acc.add(new Prisma.Decimal(item.amount)),
    ZERO,
  );
};

export const computePayslipTotals = (
  row: BulkUpsertRowInput,
): { totalDeductions: Prisma.Decimal; netPay: Prisma.Decimal } => {
  const grossPay = new Prisma.Decimal(row.grossPay);

  const otherDeductionItems = row.otherDeductions
    ? normalizeLineItems(row.otherDeductions)
    : null;

  const totalDeductions = new Prisma.Decimal(row.paye)
    .add(new Prisma.Decimal(row.sha))
    .add(new Prisma.Decimal(row.nssfTier1))
    .add(new Prisma.Decimal(row.nssfTier2))
    .add(new Prisma.Decimal(row.housingLevy))
    .add(row.helb ? new Prisma.Decimal(row.helb) : ZERO)
    .add(row.advance ? new Prisma.Decimal(row.advance) : ZERO)
    .add(sumLineItems(otherDeductionItems));
  const totalEarnings = grossPay
    .add(row.incentives ? new Prisma.Decimal(row.incentives) : ZERO)
    .add(row.overtime ? new Prisma.Decimal(row.overtime) : ZERO)
    .add(row.allowances ? new Prisma.Decimal(row.allowances) : ZERO);

  // overtime, incentives, and allowances are earnings additions — NOT included in totalDeductions

  return {
    totalDeductions,
    netPay: totalEarnings.sub(totalDeductions),
  };
};

const ensureHumanActor = (actor: PayslipActor): void => {
  if (!HUMAN_ROLES.has(actor.role)) {
    throw new ForbiddenError('You do not have permission to access payslips');
  }
};

const getAccessibleOrganizationIds = async (
  actor: PayslipActor,
  requestedOrganizationId?: string,
): Promise<string[]> => {
  if (CROSS_BRANCH_READ_ROLES.has(actor.role)) {
    if (requestedOrganizationId) return [requestedOrganizationId];
    return branchRepository.findActiveIds();
  }

  if (!actor.organizationId) {
    throw new ForbiddenError('Branch context missing for this user');
  }

  if (requestedOrganizationId && requestedOrganizationId !== actor.organizationId) {
    throw new ForbiddenError('Cannot access payslips for another branch');
  }

  return [actor.organizationId];
};

const getBranchScopedOrganizationIds = async (
  actor: PayslipActor,
  branchId: string,
): Promise<string[]> => {
  if (actor.role === 'MANAGER') {
    if (!actor.organizationId) {
      throw new ForbiddenError('Branch context missing for this user');
    }
    if (actor.organizationId !== branchId) {
      throw new ForbiddenError('Managers can only access payslips for their own branch');
    }
    return [actor.organizationId];
  }

  if (actor.role === 'DIRECTOR' || actor.role === 'HR_MANAGER' || actor.role === 'SYSTEM_ADMIN') {
    return [branchId];
  }

  throw new ForbiddenError('You do not have permission to access branch payslips');
};

const assertCanMutate = (actor: PayslipActor): void => {
  if (!MUTATION_ROLES.has(actor.role)) {
    throw new ForbiddenError('Only HR Managers, Directors, and System Admins can modify payslips');
  }
};

const assertCanPublish = (actor: PayslipActor): void => {
  if (!PUBLISH_ROLES.has(actor.role)) {
    throw new ForbiddenError('Only HR Managers and Directors can publish or revert payroll periods');
  }
};

export const payslipService = {
  bulkUpsert: async (
    actor: PayslipActor,
    input: BulkUpsertInput,
  ): Promise<{ saved: PayslipWithRelations[]; skipped: string[] }> => {
    ensureHumanActor(actor);
    assertCanMutate(actor);

    const computedRows = input.rows.map(computePayslipTotals);

    return payslipRepository.bulkUpsert(
      input.rows,
      input.organizationId,
      input.payPeriod,
      actor.id,
      computedRows,
    );
  },

  publish: async (actor: PayslipActor, input: PublishInput): Promise<{ count: number }> => {
    ensureHumanActor(actor);
    assertCanPublish(actor);
    const count = await payslipRepository.publishPeriod(input.organizationId, input.payPeriod);
    return { count };
  },

  revert: async (actor: PayslipActor, input: RevertInput): Promise<{ count: number }> => {
    ensureHumanActor(actor);
    assertCanPublish(actor);
    const count = await payslipRepository.revertPeriod(input.organizationId, input.payPeriod);
    return { count };
  },

  list: async (actor: PayslipActor, query: PayslipListQuery) => {
    ensureHumanActor(actor);
    if (!CROSS_BRANCH_READ_ROLES.has(actor.role)) {
      throw new ForbiddenError('Only Directors, HR Managers, and System Admins can list all payslips');
    }

    const organizationIds = await getAccessibleOrganizationIds(actor, query.organizationId);
    const result = await payslipRepository.list({
      organizationIds,
      payPeriod: query.payPeriod,
      userId: query.userId,
      isLocked: query.status === 'PUBLISHED' ? true : query.status === 'DRAFT' ? false : undefined,
      page: query.page,
      perPage: query.perPage,
    });

    return {
      ...result,
      page: query.page,
      perPage: query.perPage,
    };
  },

  listMine: async (actor: PayslipActor, query: PayslipMineQuery) => {
    ensureHumanActor(actor);
    const organizationIds = await getAccessibleOrganizationIds(actor);
    const result = await payslipRepository.listMine(actor.id, organizationIds, query.page, query.perPage);

    return {
      ...result,
      page: query.page,
      perPage: query.perPage,
    };
  },

  listByBranch: async (actor: PayslipActor, branchId: string, query: PayslipBranchQuery) => {
    ensureHumanActor(actor);
    const organizationIds = await getBranchScopedOrganizationIds(actor, branchId);
    const result = await payslipRepository.listByBranch(branchId, organizationIds, {
      payPeriod: query.payPeriod,
      userId: query.userId,
      isLocked: query.status === 'PUBLISHED' ? true : query.status === 'DRAFT' ? false : undefined,
      page: query.page,
      perPage: query.perPage,
    });

    return {
      ...result,
      page: query.page,
      perPage: query.perPage,
    };
  },

  getById: async (actor: PayslipActor, id: string): Promise<PayslipWithRelations> => {
    ensureHumanActor(actor);
    const organizationIds = await getAccessibleOrganizationIds(actor);
    const payslip = await payslipRepository.findById(id, organizationIds);

    if (!payslip) {
      throw new NotFoundError('Payslip not found');
    }

    if (
      !CROSS_BRANCH_READ_ROLES.has(actor.role) &&
      actor.role !== 'MANAGER' &&
      payslip.userId !== actor.id
    ) {
      throw new ForbiddenError('You can only view your own payslips');
    }

    return payslip;
  },
};
