import type { Request } from 'express';
import { Prisma, UserRole } from '@prisma/client';
import { branchRepository } from '../repositories/branch-repository';
import {
  payslipRepository,
  type CreatePayslipRepositoryInput,
  type PayslipLineItemStored,
  type PayslipWithRelations,
} from '../repositories/payslip-repository';
import type {
  CreatePayslipInput,
  PayslipBranchQuery,
  PayslipLineItemInput,
  PayslipListQuery,
  PayslipMineQuery,
  UpdatePayslipInput,
} from '../validators/payslip-schemas';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { mapPrismaError } from '../utils/prisma-errors';

export type PayslipActor = NonNullable<Request['user']>;

const CROSS_BRANCH_READ_ROLES = new Set<UserRole>(['SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER', 'ACCOUNTANT']);
const MUTATION_ROLES = new Set<UserRole>(['SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER']);
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
const PAYSLIP_ELIGIBLE_ROLES = new Set<UserRole>([
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

const parseStoredLineItems = (value: unknown): PayslipLineItemStored[] | null => {
  if (!Array.isArray(value)) return null;
  const parsed = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as { label?: unknown; amount?: unknown };
      if (typeof candidate.label !== 'string' || typeof candidate.amount !== 'string') return null;
      return {
        label: candidate.label,
        amount: candidate.amount,
      };
    })
    .filter((item): item is PayslipLineItemStored => item !== null);
  return parsed.length > 0 ? parsed : null;
};

const sumLineItems = (items: PayslipLineItemStored[] | null): Prisma.Decimal => {
  if (!items) return ZERO;
  return items.reduce(
    (acc, item) => acc.add(new Prisma.Decimal(item.amount)),
    ZERO,
  );
};

const toOptionalDecimal = (value?: string | null): Prisma.Decimal | null => {
  if (value === undefined || value === null) return null;
  return new Prisma.Decimal(value);
};

const calculateTotals = (input: {
  basicSalary: Prisma.Decimal;
  houseAllowance: Prisma.Decimal | null;
  transportAllowance: Prisma.Decimal | null;
  otherAllowances: PayslipLineItemStored[] | null;
  paye: Prisma.Decimal;
  nssf: Prisma.Decimal;
  housingLevy: Prisma.Decimal;
  helb: Prisma.Decimal | null;
  otherDeductions: PayslipLineItemStored[] | null;
}): Pick<CreatePayslipRepositoryInput, 'grossPay' | 'totalDeductions' | 'netPay'> => {
  const grossPay = input.basicSalary
    .add(input.houseAllowance ?? ZERO)
    .add(input.transportAllowance ?? ZERO)
    .add(sumLineItems(input.otherAllowances));

  const totalDeductions = input.paye
    .add(input.nssf)
    .add(input.housingLevy)
    .add(input.helb ?? ZERO)
    .add(sumLineItems(input.otherDeductions));

  return {
    grossPay,
    totalDeductions,
    netPay: grossPay.sub(totalDeductions),
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
    const activeIds = await branchRepository.findActiveIds();
    return activeIds;
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

const resolveTargetUser = async (userId: string) => {
  const targetUser = await payslipRepository.findTargetUserById(userId);
  if (!targetUser || !targetUser.isActive) {
    throw new NotFoundError('Target staff member not found or inactive');
  }
  if (!targetUser.organizationId) {
    throw new ValidationError('Target staff member must belong to a branch');
  }
  if (!PAYSLIP_ELIGIBLE_ROLES.has(targetUser.role)) {
    throw new ValidationError('Payslips can only be created for branch staff and management users');
  }
  return targetUser;
};

const buildCreatePayload = async (
  actor: PayslipActor,
  input: CreatePayslipInput,
): Promise<CreatePayslipRepositoryInput> => {
  const targetUser = await resolveTargetUser(input.userId);
  const organizationId = targetUser.organizationId;
  if (!organizationId) {
    throw new ValidationError('Target staff member must belong to a branch');
  }

  const payloadBase = {
    organizationId,
    userId: targetUser.id,
    payPeriod: input.payPeriod,
    payDate: new Date(`${input.payDate}T00:00:00.000Z`),
    basicSalary: new Prisma.Decimal(input.basicSalary),
    houseAllowance: toOptionalDecimal(input.houseAllowance),
    transportAllowance: toOptionalDecimal(input.transportAllowance),
    otherAllowances: normalizeLineItems(input.otherAllowances),
    paye: new Prisma.Decimal(input.paye),
    nssf: new Prisma.Decimal(input.nssf),
    housingLevy: new Prisma.Decimal(input.housingLevy),
    helb: toOptionalDecimal(input.helb),
    otherDeductions: normalizeLineItems(input.otherDeductions),
  };

  return {
    ...payloadBase,
    ...calculateTotals(payloadBase),
    createdById: actor.id,
  };
};

export const payslipService = {
  create: async (actor: PayslipActor, input: CreatePayslipInput): Promise<PayslipWithRelations> => {
    ensureHumanActor(actor);
    assertCanMutate(actor);
    const payload = await buildCreatePayload(actor, input);

    try {
      return await payslipRepository.create(payload);
    } catch (error) {
      return mapPrismaError(error, {
        conflict: 'A payslip already exists for this staff member and pay period',
      });
    }
  },

  list: async (actor: PayslipActor, query: PayslipListQuery) => {
    ensureHumanActor(actor);
    if (!CROSS_BRANCH_READ_ROLES.has(actor.role)) {
      throw new ForbiddenError('Only Directors, HR Managers, Accountants, and System Admins can list all payslips');
    }

    const organizationIds = await getAccessibleOrganizationIds(actor, query.organizationId);
    const result = await payslipRepository.list({
      organizationIds,
      payPeriod: query.payPeriod,
      userId: query.userId,
      isLocked: query.status === 'LOCKED' ? true : query.status === 'DRAFT' ? false : undefined,
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
      isLocked: query.status === 'LOCKED' ? true : query.status === 'DRAFT' ? false : undefined,
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

  update: async (actor: PayslipActor, id: string, input: UpdatePayslipInput): Promise<PayslipWithRelations> => {
    ensureHumanActor(actor);
    assertCanMutate(actor);

    const organizationIds = await getAccessibleOrganizationIds(actor);
    const existing = await payslipRepository.findById(id, organizationIds);

    if (!existing) {
      throw new NotFoundError('Payslip not found');
    }
    if (existing.isLocked) {
      throw new ConflictError('Locked payslips cannot be edited');
    }

    let targetUser = null;
    if (input.userId) {
      targetUser = await resolveTargetUser(input.userId);
    }

    const nextPayloadBase = {
      organizationId: targetUser?.organizationId ?? existing.organizationId,
      userId: targetUser?.id ?? existing.userId,
      payPeriod: input.payPeriod ?? existing.payPeriod,
      payDate: input.payDate ? new Date(`${input.payDate}T00:00:00.000Z`) : existing.payDate,
      basicSalary: input.basicSalary ? new Prisma.Decimal(input.basicSalary) : existing.basicSalary,
      houseAllowance: input.houseAllowance !== undefined ? toOptionalDecimal(input.houseAllowance) : existing.houseAllowance,
      transportAllowance: input.transportAllowance !== undefined
        ? toOptionalDecimal(input.transportAllowance)
        : existing.transportAllowance,
      otherAllowances: input.otherAllowances !== undefined
        ? normalizeLineItems(input.otherAllowances)
        : parseStoredLineItems(existing.otherAllowances),
      paye: input.paye ? new Prisma.Decimal(input.paye) : existing.paye,
      nssf: input.nssf ? new Prisma.Decimal(input.nssf) : existing.nssf,
      housingLevy: input.housingLevy ? new Prisma.Decimal(input.housingLevy) : existing.housingLevy,
      helb: input.helb !== undefined ? toOptionalDecimal(input.helb) : existing.helb,
      otherDeductions: input.otherDeductions !== undefined
        ? normalizeLineItems(input.otherDeductions)
        : parseStoredLineItems(existing.otherDeductions),
    };

    const payload = {
      ...nextPayloadBase,
      ...calculateTotals(nextPayloadBase),
    };

    try {
      const updated = await payslipRepository.update(id, existing.organizationId, payload);
      if (!updated) {
        throw new NotFoundError('Payslip not found');
      }
      return updated;
    } catch (error) {
      return mapPrismaError(error, {
        conflict: 'A payslip already exists for this staff member and pay period',
      });
    }
  },

  lock: async (actor: PayslipActor, id: string): Promise<PayslipWithRelations> => {
    ensureHumanActor(actor);
    assertCanMutate(actor);

    const organizationIds = await getAccessibleOrganizationIds(actor);
    const existing = await payslipRepository.findById(id, organizationIds);

    if (!existing) {
      throw new NotFoundError('Payslip not found');
    }
    if (existing.isLocked) {
      throw new ConflictError('Payslip is already locked');
    }

    const locked = await payslipRepository.lock(id, existing.organizationId);
    if (!locked) {
      throw new ConflictError('Payslip could not be locked. Please refresh and try again.');
    }
    return locked;
  },
};
