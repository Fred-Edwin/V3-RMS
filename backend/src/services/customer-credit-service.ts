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

const requireOrganizationId = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ForbiddenError('Branch context missing for this user');
  }
  return actor.organizationId;
};

const requireManager = (actor: Actor): void => {
  if (actor.role !== 'MANAGER' && actor.role !== 'SYSTEM_ADMIN') {
    throw new ForbiddenError('Only Managers can perform this action');
  }
};

export const customerCreditService = {
  list: async (
    actor: Actor,
  ): Promise<CustomerCreditAccountWithCreator[] | CustomerCreditDropdownItem[]> => {
    const organizationId = requireOrganizationId(actor);
    if (actor.role === 'WAITER') {
      return customerCreditRepository.findActiveByOrganization(organizationId);
    }
    return customerCreditRepository.findAllByOrganization(organizationId);
  },

  createAccount: async (
    actor: Actor,
    input: CreateCustomerCreditInput,
  ): Promise<CustomerCreditAccountWithCreator> => {
    const organizationId = requireOrganizationId(actor);
    // WAITER can create inline during payment; MANAGER can always create
    if (
      actor.role !== 'WAITER' &&
      actor.role !== 'MANAGER' &&
      actor.role !== 'SYSTEM_ADMIN'
    ) {
      throw new ForbiddenError('Only Waiters and Managers can create customer credit accounts');
    }
    return customerCreditRepository.create(organizationId, input, actor.id);
  },

  updateAccount: async (
    actor: Actor,
    id: string,
    input: UpdateCustomerCreditInput,
  ): Promise<CustomerCreditAccountWithCreator> => {
    requireManager(actor);
    const organizationId = requireOrganizationId(actor);
    const account = await customerCreditRepository.update(id, organizationId, input);
    if (!account) {
      throw new NotFoundError('Customer credit account not found');
    }
    return account;
  },

  recordSettlement: async (
    actor: Actor,
    id: string,
    input: RecordCustomerCreditSettlementInput,
  ): Promise<void> => {
    requireManager(actor);
    const organizationId = requireOrganizationId(actor);

    const account = await customerCreditRepository.findById(id, organizationId);
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
  ) => {
    const organizationId = requireOrganizationId(actor);
    const account = await customerCreditRepository.findById(id, organizationId);
    if (!account) {
      throw new NotFoundError('Customer credit account not found');
    }
    return customerCreditRepository.findOrdersByAccountId(id, organizationId, page, perPage);
  },
};
