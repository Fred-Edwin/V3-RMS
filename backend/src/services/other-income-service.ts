import type { Request } from 'express';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { otherIncomeRepository } from '../repositories/other-income-repository';
import type {
  OtherIncomeCategoryWithBranch,
  OtherIncomeCategoryDropdownItem,
  OtherIncomeEntryWithRelations,
  PaginatedOtherIncomeEntries,
} from '../repositories/other-income-repository';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateEntryInput,
  ListEntriesInput,
} from '../validators/other-income-schemas';

type Actor = NonNullable<Request['user']>;

// ── Role sets ─────────────────────────────────────────────────────────────────

const CATEGORY_MANAGERS = new Set(['SYSTEM_ADMIN', 'DIRECTOR'] as const);
const ENTRY_CREATORS = new Set(['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'WAITER'] as const);
const ENTRY_FULL_VIEWERS = new Set(['SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT'] as const);
const ORG_LEVEL_ROLES = new Set(['DIRECTOR', 'SYSTEM_ADMIN'] as const);

// ── Org resolution ────────────────────────────────────────────────────────────

/**
 * Directors/Admins have organizationId=null on their token.
 * They must pass an organizationId (= the target branch's org ID) in the request.
 * Branch-level roles (WAITER, MANAGER, ACCOUNTANT) use actor.organizationId directly.
 */
function resolveOrgId(actor: Actor, requestedOrgId?: string): string {
  if (ORG_LEVEL_ROLES.has(actor.role as 'DIRECTOR' | 'SYSTEM_ADMIN')) {
    if (!requestedOrgId) {
      throw new ValidationError('Please select a branch');
    }
    return requestedOrgId;
  }
  if (!actor.organizationId) {
    throw new ForbiddenError('Branch context missing for your account');
  }
  return actor.organizationId;
}

// ── Category operations ───────────────────────────────────────────────────────

export const otherIncomeService = {
  /**
   * List all categories for management (Directors/Admins).
   * Directors must pass organizationId in the request.
   */
  listCategories: async (
    actor: Actor,
    requestedOrgId?: string,
  ): Promise<OtherIncomeCategoryWithBranch[] | OtherIncomeCategoryDropdownItem[]> => {
    // Directors see all (including inactive) for management; require org
    if (CATEGORY_MANAGERS.has(actor.role as 'SYSTEM_ADMIN' | 'DIRECTOR')) {
      const orgId = resolveOrgId(actor, requestedOrgId);
      return otherIncomeRepository.findAllCategories(orgId);
    }

    // Branch-level roles: active only
    if (!actor.organizationId) {
      throw new ForbiddenError('Branch context missing for your account');
    }
    return otherIncomeRepository.findActiveCategories(actor.organizationId, actor.organizationId);
  },

  /** Active categories for the record-entry form dropdown. */
  listActiveCategories: async (
    actor: Actor,
    requestedOrgId?: string,
  ): Promise<OtherIncomeCategoryDropdownItem[]> => {
    if (ORG_LEVEL_ROLES.has(actor.role as 'DIRECTOR' | 'SYSTEM_ADMIN')) {
      const orgId = resolveOrgId(actor, requestedOrgId);
      return otherIncomeRepository.findAllActiveCategories(orgId);
    }
    if (!actor.organizationId) {
      throw new ForbiddenError('Branch context missing for your account');
    }
    return otherIncomeRepository.findActiveCategories(actor.organizationId, actor.organizationId);
  },

  createCategory: async (
    actor: Actor,
    input: CreateCategoryInput,
    requestedOrgId?: string,
  ): Promise<OtherIncomeCategoryWithBranch> => {
    if (!CATEGORY_MANAGERS.has(actor.role as 'SYSTEM_ADMIN' | 'DIRECTOR')) {
      throw new ForbiddenError('Only Directors and System Admins can manage income categories');
    }
    const orgId = resolveOrgId(actor, requestedOrgId);
    return otherIncomeRepository.createCategory({
      organizationId: orgId,
      branchId: input.branchId ?? null,
      name: input.name,
    });
  },

  updateCategory: async (
    actor: Actor,
    id: string,
    input: UpdateCategoryInput,
    requestedOrgId?: string,
  ): Promise<OtherIncomeCategoryWithBranch> => {
    if (!CATEGORY_MANAGERS.has(actor.role as 'SYSTEM_ADMIN' | 'DIRECTOR')) {
      throw new ForbiddenError('Only Directors and System Admins can manage income categories');
    }
    const orgId = resolveOrgId(actor, requestedOrgId);
    const updated = await otherIncomeRepository.updateCategory(id, orgId, {
      name: input.name,
      isActive: input.isActive,
      branchId: input.branchId,
    });
    if (!updated) throw new NotFoundError('Income category not found');
    return updated;
  },

  // ── Entry operations ────────────────────────────────────────────────────────

  createEntry: async (
    actor: Actor,
    input: CreateEntryInput,
  ): Promise<OtherIncomeEntryWithRelations> => {
    if (!ENTRY_CREATORS.has(actor.role as 'SYSTEM_ADMIN' | 'DIRECTOR' | 'MANAGER' | 'WAITER')) {
      throw new ForbiddenError('You do not have permission to record other income');
    }

    // For branch-level roles, orgId = their branch org. For org-level, branchId must be in input.
    const orgId = ORG_LEVEL_ROLES.has(actor.role as 'DIRECTOR' | 'SYSTEM_ADMIN')
      ? resolveOrgId(actor, input.branchId)
      : (actor.organizationId ?? (() => { throw new ForbiddenError('Branch context missing'); })());

    // Validate category is active and accessible
    const activeCategories = ORG_LEVEL_ROLES.has(actor.role as 'DIRECTOR' | 'SYSTEM_ADMIN')
      ? await otherIncomeRepository.findAllActiveCategories(orgId)
      : await otherIncomeRepository.findActiveCategories(orgId, orgId);
    if (!activeCategories.some((c) => c.id === input.categoryId)) {
      throw new ValidationError('Income category not found or is not available for your branch');
    }

    const entryDate = new Date(`${input.entryDate}T00:00:00`);

    return otherIncomeRepository.createEntry({
      organizationId: orgId,
      branchId: orgId, // in this system each branch = one org, so branchId = orgId
      categoryId: input.categoryId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      mpesaCode: input.mpesaCode,
      mpesaAmount: input.mpesaAmount,
      cashAmount: input.cashAmount,
      cardAmount: input.cardAmount,
      splitType: input.splitType,
      description: input.description ?? null,
      entryDate,
      recordedById: actor.id,
    });
  },

  listEntries: async (
    actor: Actor,
    input: ListEntriesInput,
  ): Promise<PaginatedOtherIncomeEntries> => {
    // For org-level roles: use branchId filter as the orgId scope, or list across all if omitted
    // For branch-level roles: always scoped to their org
    const isOrgLevel = ORG_LEVEL_ROLES.has(actor.role as 'DIRECTOR' | 'SYSTEM_ADMIN');
    const isAccountant = actor.role === 'ACCOUNTANT';

    let orgId: string | undefined;
    if (isOrgLevel || isAccountant) {
      // branchId in the query is used as an org filter for these roles
      orgId = input.branchId; // may be undefined — means all orgs (handled below)
    } else {
      if (!actor.organizationId) {
        throw new ForbiddenError('Branch context missing for your account');
      }
      orgId = actor.organizationId;
    }

    const startDate = input.startDate ? new Date(`${input.startDate}T00:00:00`) : undefined;
    const endDate = input.endDate ? new Date(`${input.endDate}T23:59:59`) : undefined;

    const filters: Parameters<typeof otherIncomeRepository.findEntries>[1] = {
      categoryId: input.categoryId,
      startDate,
      endDate,
      page: input.page,
      perPage: input.perPage,
    };

    if (actor.role === 'WAITER') {
      filters.recordedById = actor.id;
    }

    if (input.branchId && (isOrgLevel || isAccountant)) {
      filters.branchId = input.branchId;
    }

    // For org-level without a branchId filter, scope to all entries under any org
    // (repository will skip organizationId filter when undefined)
    return otherIncomeRepository.findEntries(orgId, filters);
  },

  deleteEntry: async (actor: Actor, id: string): Promise<void> => {
    // Find entry without org scope for org-level roles; with scope for branch-level
    const orgId = ORG_LEVEL_ROLES.has(actor.role as 'DIRECTOR' | 'SYSTEM_ADMIN')
      ? undefined
      : actor.organizationId ?? undefined;
    const entry = await otherIncomeRepository.findEntryById(id, orgId);
    if (!entry) throw new NotFoundError('Income entry not found');

    const today = new Date();
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const entryYmd = entry.entryDate.toISOString().slice(0, 10);
    const isToday = entryYmd === todayYmd;

    if (actor.role === 'WAITER') {
      if (entry.recordedById !== actor.id) throw new ForbiddenError('You can only delete your own entries');
      if (!isToday) throw new ForbiddenError('You can only delete entries recorded today');
    } else if (actor.role === 'MANAGER') {
      if (!isToday) throw new ForbiddenError('Managers can only delete entries recorded today');
    } else if (!ENTRY_FULL_VIEWERS.has(actor.role as 'SYSTEM_ADMIN' | 'DIRECTOR' | 'ACCOUNTANT')) {
      throw new ForbiddenError('You do not have permission to delete income entries');
    }

    await otherIncomeRepository.deleteEntry(id, entry.organizationId);
  },
};
