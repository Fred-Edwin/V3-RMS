import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError, ForbiddenError, NotFoundError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';
import { actorCan } from '../_shared/central-store-access';
import type { BranchRef } from './_shared/requisitions-contract';
import { requisitionsRepository as repo } from './requisitions-repository';

type Actor = NonNullable<Request['user']>;

/**
 * The branch-code correction (Amendment 2): `PATCH /inventory/requisitions/branches/:branchId/code`, System Admin only
 * (`branches.set_code`), no screen in Block 1. A code is three capital letters and unique among branches. References already
 * issued keep the code they were issued with (a reference never changes); only new requisitions use the new code.
 */
export const branchCodeInputSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'A branch code is three letters') }).strict();
export const branchParamsSchema = z.object({ branchId: z.string().uuid() });
export type BranchCodeInput = z.infer<typeof branchCodeInputSchema>;

export const branchCodeService = {
  set: async (actor: Actor, branchId: string, input: BranchCodeInput): Promise<BranchRef> => {
    if (!actorCan(actor, 'branches.set_code')) throw new ForbiddenError('You do not have permission to change a branch code');
    const site = await repo.findSite(branchId);
    if (!site || site.type !== 'BRANCH') throw new NotFoundError('Branch not found');
    if (site.code === input.code) return { id: site.id, name: site.name, code: site.code };
    const holder = await repo.findSiteByCode(input.code);
    if (holder && holder.id !== site.id) throw new AppError(409, 'BRANCH_CODE_TAKEN', 'Another branch already uses that code.');
    const updated = await repo.setSiteCode(site.id, input.code).catch((error: unknown) => {
      // Two corrections racing for the same code: the unique index decides.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'BRANCH_CODE_TAKEN', 'Another branch already uses that code.');
      throw error;
    });
    logger.info({ siteId: site.id, from: site.code, to: input.code, actorId: actor.id }, 'Branch code changed');
    return { id: updated.id, name: updated.name, code: updated.code };
  },
};
