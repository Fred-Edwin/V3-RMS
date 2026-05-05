import type { Request } from 'express';
import { discountRepository } from '../repositories/discount-repository';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { DiscountRecord } from '../types/discount.types';

type Actor = NonNullable<Request['user']>;

const serialize = (
  raw: Awaited<ReturnType<typeof discountRepository.findById>>,
): DiscountRecord => {
  if (!raw) throw new NotFoundError('Discount not found');
  return {
    id: raw.id,
    organizationId: raw.organizationId,
    name: raw.name,
    type: raw.type,
    value: raw.value.toString(),
    requiresApproval: raw.requiresApproval,
    isActive: raw.isActive,
    createdById: raw.createdById,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdBy: raw.createdBy,
  };
};

export const discountService = {
  /**
   * Lists all discounts visible to the actor's branch (branch-scoped + all-branch).
   * Waiters only see active discounts; managers/directors see all.
   */
  list: async (actor: Actor): Promise<DiscountRecord[]> => {
    // Directors have no organizationId (multi-branch) — return all discounts
    if (actor.role === 'DIRECTOR') {
      const records = await discountRepository.findAll(false);
      return records.map(serialize);
    }
    if (!actor.organizationId) return [];
    const activeOnly = actor.role !== 'MANAGER';
    const records = await discountRepository.findByBranch(actor.organizationId, activeOnly);
    return records.map(serialize);
  },

  /**
   * Creates a new discount definition. Director only.
   * organizationId = null means all branches.
   */
  create: async (
    data: {
      organizationId: string | null | undefined;
      name: string;
      type: 'PERCENTAGE' | 'FIXED_AMOUNT';
      value: number;
      requiresApproval: boolean;
    },
    actor: Actor,
  ): Promise<DiscountRecord> => {
    if (actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Only directors can create discounts');
    }

    // When organizationId is provided, verify it's the actor's hub or a branch under their org
    // For now we trust the Director to pass a valid branch UUID or null for all-branches
    const discount = await discountRepository.create({
      organizationId: data.organizationId ?? null,
      name: data.name,
      type: data.type,
      value: data.value.toString(),
      requiresApproval: data.requiresApproval,
      createdById: actor.id,
    });

    logger.info({ discountId: discount.id, actorId: actor.id }, 'Discount created');
    return serialize(discount);
  },

  /**
   * Updates a discount. Director only.
   */
  update: async (
    discountId: string,
    data: {
      organizationId?: string | null;
      name?: string;
      type?: 'PERCENTAGE' | 'FIXED_AMOUNT';
      value?: number;
      requiresApproval?: boolean;
      isActive?: boolean;
    },
    actor: Actor,
  ): Promise<DiscountRecord> => {
    if (actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Only directors can update discounts');
    }

    const existing = await discountRepository.findById(discountId);
    if (!existing) throw new NotFoundError('Discount not found');

    const { value: rawValue, ...rest } = data;
    const updated = await discountRepository.update(discountId, {
      ...rest,
      ...(rawValue !== undefined ? { value: rawValue.toString() } : {}),
    }, actor.organizationId);

    logger.info({ discountId, actorId: actor.id }, 'Discount updated');
    return serialize(updated);
  },

  /**
   * Soft-deletes (deactivates) a discount. Director only.
   */
  deactivate: async (discountId: string, actor: Actor): Promise<DiscountRecord> => {
    if (actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Only directors can delete discounts');
    }

    const existing = await discountRepository.findById(discountId);
    if (!existing) throw new NotFoundError('Discount not found');

    const updated = await discountRepository.deactivate(discountId, actor.organizationId);
    logger.info({ discountId, actorId: actor.id }, 'Discount deactivated');
    return serialize(updated);
  },
};
