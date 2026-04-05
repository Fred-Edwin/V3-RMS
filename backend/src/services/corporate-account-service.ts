import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import {
  corporateAccountRepository,
  type CorporateAccountDropdownItem,
  type CorporateAccountWithCreator,
} from '../repositories/corporate-account-repository';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type {
  CreateCorporateAccountInput,
  RecordCorporateSettlementInput,
  UpdateCorporateAccountInput,
} from '../validators/corporate-account-schemas';
import { prisma } from '../config/database';

type Actor = NonNullable<Request['user']>;

const requireDirectorOrAdmin = (actor: Actor): void => {
  if (actor.role !== 'SYSTEM_ADMIN' && actor.role !== 'DIRECTOR' && actor.role !== 'ACCOUNTANT') {
    throw new ForbiddenError('Only Directors and System Admins can manage corporate accounts');
  }
};

export const corporateAccountService = {
  list: async (
    actor: Actor,
  ): Promise<CorporateAccountWithCreator[] | CorporateAccountDropdownItem[]> => {
    // WAITER and MANAGER get only the minimal active list (for payment dropdown)
    if (actor.role === 'WAITER' || actor.role === 'MANAGER') {
      return corporateAccountRepository.findAllActive();
    }
    // Director and Admin get full list
    requireDirectorOrAdmin(actor);
    return corporateAccountRepository.findAll();
  },

  createAccount: async (
    actor: Actor,
    input: CreateCorporateAccountInput,
  ): Promise<CorporateAccountWithCreator> => {
    requireDirectorOrAdmin(actor);
    return corporateAccountRepository.create(input, actor.id);
  },

  updateAccount: async (
    actor: Actor,
    id: string,
    input: UpdateCorporateAccountInput,
  ): Promise<CorporateAccountWithCreator> => {
    requireDirectorOrAdmin(actor);
    const account = await corporateAccountRepository.update(id, input);
    if (!account) {
      throw new NotFoundError('Corporate account not found');
    }
    return account;
  },

  recordSettlement: async (
    actor: Actor,
    id: string,
    input: RecordCorporateSettlementInput,
  ): Promise<void> => {
    requireDirectorOrAdmin(actor);

    const account = await corporateAccountRepository.findById(id);
    if (!account || !account.isActive) {
      throw new NotFoundError('Corporate account not found or inactive');
    }

    const amount = new Prisma.Decimal(input.amount);
    if (amount.greaterThan(account.currentBalance)) {
      throw new ValidationError('Settlement amount exceeds the outstanding balance');
    }

    await prisma.$transaction(async (tx) => {
      await tx.corporateAccountSettlement.create({
        data: {
          corporateAccountId: id,
          amount,
          note: input.note,
          settledById: actor.id,
        },
      });
      await tx.corporateAccount.update({
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
    if (actor.role !== 'SYSTEM_ADMIN' && actor.role !== 'DIRECTOR' && actor.role !== 'ACCOUNTANT') {
      throw new ForbiddenError('Only Directors, Accountants, and System Admins can view corporate account order history');
    }
    const account = await corporateAccountRepository.findById(id);
    if (!account) {
      throw new NotFoundError('Corporate account not found');
    }
    return corporateAccountRepository.findOrdersByAccountId(id, page, perPage);
  },
};
