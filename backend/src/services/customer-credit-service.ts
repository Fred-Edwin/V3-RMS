import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import {
  customerCreditRepository,
  type CustomerCreditAccountWithCreator,
  type CustomerCreditDropdownItem,
} from '../repositories/customer-credit-repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type {
  CreateCustomerCreditInput,
  RecordCustomerCreditSettlementInput,
  UpdateCustomerCreditInput,
} from '../validators/customer-credit-schemas';
import { prisma } from '../config/database';

type Actor = NonNullable<Request['user']>;

const resolveSiteId = (actor: Actor, requestedOrgId?: string): string => {
  if (actor.role === 'ACCOUNTANT') {
    if (!requestedOrgId) {
      throw new ForbiddenError('branchId query param is required for accountants');
    }
    return requestedOrgId;
  }
  if (!actor.siteId) {
    throw new ForbiddenError('Branch context missing for this user');
  }
  return actor.siteId;
};

const requireManager = (actor: Actor): void => {
  if (actor.role !== 'MANAGER' && actor.role !== 'SYSTEM_ADMIN' && actor.role !== 'ACCOUNTANT') {
    throw new ForbiddenError('Only Managers and Accountants can perform this action');
  }
};

export const customerCreditService = {
  list: async (
    actor: Actor,
    requestedOrgId?: string,
  ): Promise<CustomerCreditAccountWithCreator[] | CustomerCreditDropdownItem[]> => {
    const siteId = resolveSiteId(actor, requestedOrgId);
    if (actor.role === 'WAITER') {
      return customerCreditRepository.findActiveBySite(siteId);
    }
    return customerCreditRepository.findAllBySite(siteId);
  },

  createAccount: async (
    actor: Actor,
    input: CreateCustomerCreditInput,
  ): Promise<CustomerCreditAccountWithCreator> => {
    const siteId = resolveSiteId(actor);
    // WAITER can create inline during payment; MANAGER can always create
    if (
      actor.role !== 'WAITER' &&
      actor.role !== 'MANAGER' &&
      actor.role !== 'SYSTEM_ADMIN'
    ) {
      throw new ForbiddenError('Only Waiters and Managers can create customer credit accounts');
    }
    return customerCreditRepository.create(siteId, input, actor.id);
  },

  updateAccount: async (
    actor: Actor,
    id: string,
    input: UpdateCustomerCreditInput,
  ): Promise<CustomerCreditAccountWithCreator> => {
    requireManager(actor);
    const siteId = resolveSiteId(actor);
    const account = await customerCreditRepository.update(id, siteId, input);
    if (!account) {
      throw new NotFoundError('Customer credit account not found');
    }
    return account;
  },

  recordSettlement: async (
    actor: Actor,
    id: string,
    input: RecordCustomerCreditSettlementInput,
    requestedOrgId?: string,
  ): Promise<void> => {
    requireManager(actor);
    const siteId = resolveSiteId(actor, requestedOrgId);

    const account = await customerCreditRepository.findById(id, siteId);
    if (!account || !account.isActive) {
      throw new NotFoundError('Customer credit account not found or inactive');
    }

    const amount = new Prisma.Decimal(input.amount);
    if (amount.greaterThan(account.currentBalance)) {
      throw new ValidationError('Settlement amount exceeds the outstanding balance');
    }

    await prisma.$transaction(async (tx) => {
      await tx.customerCreditSettlement.create({
        data: {
          customerCreditAccountId: id,
          amount,
          note: input.note,
          settledById: actor.id,
        },
      });
      await tx.customerCreditAccount.update({
        where: { id },
        data: { currentBalance: { decrement: amount } },
      });
    });
  },

  getOrderHistory: async (
    actor: Actor,
    id: string,
    page: number,
    perPage: number,
    requestedOrgId?: string,
  ) => {
    const siteId = resolveSiteId(actor, requestedOrgId);
    const account = await customerCreditRepository.findById(id, siteId);
    if (!account) {
      throw new NotFoundError('Customer credit account not found');
    }
    return customerCreditRepository.findOrdersByAccountId(id, siteId, page, perPage);
  },
};
