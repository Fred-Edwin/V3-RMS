import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { houseAccountRepository, type HouseAccountDropdownItem, type HouseAccountWithUser } from '../repositories/house-account-repository';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type { CreateHouseAccountInput, RecordHouseSettlementInput, UpdateHouseAccountInput } from '../validators/house-account-schemas';
import { prisma } from '../config/database';

type Actor = NonNullable<Request['user']>;

const requireDirectorOrAdmin = (actor: Actor): void => {
  if (actor.role !== 'SYSTEM_ADMIN' && actor.role !== 'DIRECTOR' && actor.role !== 'ACCOUNTANT') {
    throw new ForbiddenError('Only Directors and System Admins can manage house accounts');
  }
};

export const houseAccountService = {
  list: async (actor: Actor): Promise<HouseAccountWithUser[]> => {
    requireDirectorOrAdmin(actor);
    return houseAccountRepository.findAll();
  },

  listActive: async (): Promise<HouseAccountDropdownItem[]> => {
    return houseAccountRepository.findAllActive();
  },

  getOwn: async (actor: Actor): Promise<HouseAccountWithUser> => {
    if (
      actor.role !== 'MANAGER' &&
      actor.role !== 'DIRECTOR' &&
      actor.role !== 'SYSTEM_ADMIN'
    ) {
      throw new ForbiddenError('Only Managers, Directors, and System Admins can view a house account tab');
    }
    const account = await houseAccountRepository.findByUserId(actor.id);
    if (!account || !account.isActive) {
      throw new NotFoundError('No active house account found for your account');
    }
    return account;
  },

  grantAccount: async (
    actor: Actor,
    input: CreateHouseAccountInput,
  ): Promise<HouseAccountWithUser> => {
    requireDirectorOrAdmin(actor);

    // Verify target user exists and is MANAGER or DIRECTOR
    const targetUser = await prisma.user.findFirst({
      where: { id: input.userId, isActive: true },
      select: { id: true, role: true },
    });
    if (!targetUser) {
      throw new NotFoundError('Target user not found or is inactive');
    }
    if (targetUser.role !== 'MANAGER' && targetUser.role !== 'DIRECTOR') {
      throw new ValidationError('House accounts can only be granted to Managers and Directors');
    }

    // Check no active account already exists
    const existing = await houseAccountRepository.findByUserId(input.userId);
    if (existing && existing.isActive) {
      throw new ConflictError('An active house account already exists for this user');
    }

    return houseAccountRepository.create({
      userId: input.userId,
      creditLimit: input.creditLimit,
      grantedById: actor.id,
    });
  },

  updateAccount: async (
    actor: Actor,
    id: string,
    input: UpdateHouseAccountInput,
  ): Promise<HouseAccountWithUser> => {
    requireDirectorOrAdmin(actor);
    const account = await houseAccountRepository.update(id, input);
    if (!account) {
      throw new NotFoundError('House account not found');
    }
    return account;
  },

  recordSettlement: async (
    actor: Actor,
    id: string,
    input: RecordHouseSettlementInput,
  ): Promise<void> => {
    if (
      actor.role !== 'SYSTEM_ADMIN' &&
      actor.role !== 'DIRECTOR' &&
      actor.role !== 'MANAGER' &&
      actor.role !== 'ACCOUNTANT'
    ) {
      throw new ForbiddenError('Only Managers, Directors, Accountants, and System Admins can record settlements');
    }

    const account = await houseAccountRepository.findById(id);
    if (!account || !account.isActive) {
      throw new NotFoundError('House account not found or inactive');
    }

    // Managers can only settle their own account; Accountant can settle any
    if (actor.role === 'MANAGER' && account.userId !== actor.id) {
      throw new ForbiddenError('Managers can only record settlements on their own house account');
    }

    const amount = new Prisma.Decimal(input.amount);
    if (amount.greaterThan(account.currentBalance)) {
      throw new ValidationError('Settlement amount exceeds the outstanding balance');
    }

    // Create settlement + decrement balance in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.houseAccountSettlement.create({
        data: {
          houseAccountId: id,
          amount,
          note: input.note,
          settledById: actor.id,
        },
      });
      await tx.houseAccount.update({
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
    requireDirectorOrAdmin(actor);
    const account = await houseAccountRepository.findById(id);
    if (!account) {
      throw new NotFoundError('House account not found');
    }
    return houseAccountRepository.findOrdersByAccountId(id, page, perPage);
  },
};
