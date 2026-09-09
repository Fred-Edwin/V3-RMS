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
  UpdateEntryInput,
  ListEntriesInput,
} from '../validators/other-income-schemas';

type Actor = NonNullable<Request['user']>;

// ── Role sets ─────────────────────────────────────────────────────────────────

const CATEGORY_MANAGERS = new Set(['SYSTEM_ADMIN', 'DIRECTOR'] as const);
const ENTRY_CREATORS = new Set(['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'WAITER'] as const);
const ENTRY_FULL_VIEWERS = new Set(['SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT'] as const);
const ENTRY_EDITORS = new Set(['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER'] as const);
const ORG_LEVEL_ROLES = new Set(['DIRECTOR', 'SYSTEM_ADMIN'] as const);

/** Managers can only correct entries recorded within this many days. Director/Admin: no limit. */
const MANAGER_EDIT_WINDOW_DAYS = 30;

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

  /** Active categories for the record-entry form dropdown (and cross-branch filter dropdowns). */
  listActiveCategories: async (
    actor: Actor,
    requestedOrgId?: string,
  ): Promise<OtherIncomeCategoryDropdownItem[]> => {
    if (ORG_LEVEL_ROLES.has(actor.role as 'DIRECTOR' | 'SYSTEM_ADMIN')) {
      const orgId = resolveOrgId(actor, requestedOrgId);
      return otherIncomeRepository.findAllActiveCategories(orgId);
    }
    // ACCOUNTANT has no branch on their token; a branchId is optional (means "all branches").
    if (actor.role === 'ACCOUNTANT') {
      if (requestedOrgId) {
        return otherIncomeRepository.findActiveCategories(requestedOrgId, requestedOrgId);
      }
      return otherIncomeRepository.findAllActiveCategoriesAcrossOrgs();
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

  /**
   * Correct an already-recorded entry. MANAGER may edit entries recorded within
   * the last 30 days (by entryDate); DIRECTOR / SYSTEM_ADMIN have no time limit.
   * WAITER and ACCOUNTANT cannot edit. Every change is written to the entry's
   * edit-audit trail.
   */
  updateEntry: async (
    actor: Actor,
    id: string,
    input: UpdateEntryInput,
  ): Promise<OtherIncomeEntryWithRelations> => {
    if (!ENTRY_EDITORS.has(actor.role as 'SYSTEM_ADMIN' | 'DIRECTOR' | 'MANAGER')) {
      throw new ForbiddenError('You do not have permission to edit income entries');
    }

    // Org-level roles look up without scope; branch roles are pinned to their org.
    const scopeOrgId = ORG_LEVEL_ROLES.has(actor.role as 'DIRECTOR' | 'SYSTEM_ADMIN')
      ? undefined
      : actor.organizationId ?? undefined;
    const existing = await otherIncomeRepository.findEntryById(id, scopeOrgId);
    if (!existing) throw new NotFoundError('Income entry not found');

    // 30-day window for managers (by the entry's business date, not createdAt).
    if (actor.role === 'MANAGER') {
      const ageDays =
        (Date.now() - existing.entryDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > MANAGER_EDIT_WINDOW_DAYS) {
        throw new ForbiddenError(
          `Managers can only edit entries recorded in the last ${MANAGER_EDIT_WINDOW_DAYS} days`,
        );
      }
    }

    // Validate a changed category is active and reachable for this branch.
    if (input.categoryId && input.categoryId !== existing.categoryId) {
      const activeCategories = await otherIncomeRepository.findActiveCategories(
        existing.organizationId,
        existing.organizationId,
      );
      if (!activeCategories.some((c) => c.id === input.categoryId)) {
        throw new ValidationError('Income category not found or is not available for this branch');
      }
    }

    // Merge the incoming fields over the current row to get the resulting shape,
    // then re-validate the payment breakdown the same way create does.
    const method = input.paymentMethod ?? existing.paymentMethod;
    const next: {
      categoryId?: string;
      amount?: string;
      paymentMethod?: 'CASH' | 'MPESA' | 'CARD' | 'SPLIT';
      mpesaCode?: string | null;
      mpesaAmount?: string | null;
      cashAmount?: string | null;
      cardAmount?: string | null;
      splitType?: string | null;
      description?: string | null;
      entryDate?: Date;
    } = {
      categoryId: input.categoryId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      mpesaCode: input.mpesaCode,
      mpesaAmount: input.mpesaAmount,
      cashAmount: input.cashAmount,
      cardAmount: input.cardAmount,
      splitType: input.splitType,
      description: input.description,
      entryDate: input.entryDate ? new Date(`${input.entryDate}T00:00:00`) : undefined,
    };

    if (method === 'SPLIT') {
      const splitType = input.splitType ?? existing.splitType;
      if (!splitType) {
        throw new ValidationError('A split entry must specify a split type');
      }
      const mpesa = Number(input.mpesaAmount ?? existing.mpesaAmount ?? 0);
      const cash = Number(input.cashAmount ?? existing.cashAmount ?? 0);
      const card = Number(input.cardAmount ?? existing.cardAmount ?? 0);
      const legs =
        splitType === 'MPESA_CASH'
          ? mpesa + cash
          : splitType === 'MPESA_CARD'
            ? mpesa + card
            : cash + card;
      if (legs <= 0) {
        throw new ValidationError('Split amounts must be greater than zero');
      }
      const total = Number(input.amount ?? existing.amount);
      if (Math.abs(legs - total) > 0.01) {
        throw new ValidationError('Split amounts must add up to the total amount');
      }
    } else if (input.amount !== undefined && Number(input.amount) <= 0) {
      throw new ValidationError('Amount must be greater than zero');
    }

    // Switching away from SPLIT — clear the split-only columns.
    if (input.paymentMethod && input.paymentMethod !== 'SPLIT' && existing.paymentMethod === 'SPLIT') {
      next.splitType = null;
      if (input.mpesaAmount === undefined) next.mpesaAmount = null;
      if (input.cashAmount === undefined) next.cashAmount = null;
      if (input.cardAmount === undefined) next.cardAmount = null;
    }

    // Build the human-readable change list for the audit row.
    const fmt = (v: unknown): string | null =>
      v === null || v === undefined ? null : String(v);
    const currentSnapshot: Record<string, unknown> = {
      categoryId: existing.categoryId,
      amount: existing.amount.toString(),
      paymentMethod: existing.paymentMethod,
      mpesaCode: existing.mpesaCode,
      mpesaAmount: existing.mpesaAmount?.toString() ?? null,
      cashAmount: existing.cashAmount?.toString() ?? null,
      cardAmount: existing.cardAmount?.toString() ?? null,
      splitType: existing.splitType,
      description: existing.description,
      entryDate: existing.entryDate.toISOString().slice(0, 10),
    };
    const nextSnapshot: Record<string, unknown> = {
      categoryId: next.categoryId,
      amount: next.amount,
      paymentMethod: next.paymentMethod,
      mpesaCode: next.mpesaCode,
      mpesaAmount: next.mpesaAmount,
      cashAmount: next.cashAmount,
      cardAmount: next.cardAmount,
      splitType: next.splitType,
      description: next.description,
      entryDate: input.entryDate,
    };
    const MONEY_FIELDS = new Set(['amount', 'mpesaAmount', 'cashAmount', 'cardAmount']);
    const sameValue = (field: string, a: string | null, b: string | null): boolean => {
      if (MONEY_FIELDS.has(field)) {
        return Number(a ?? 0) === Number(b ?? 0);
      }
      return a === b;
    };
    const changes = Object.keys(nextSnapshot)
      .filter((k) => nextSnapshot[k] !== undefined)
      .map((k) => ({ field: k, from: fmt(currentSnapshot[k]), to: fmt(nextSnapshot[k]) }))
      .filter((c) => !sameValue(c.field, c.from, c.to));

    if (changes.length === 0) {
      // Nothing actually changed — return the entry untouched, no audit noise.
      return existing;
    }

    const updated = await otherIncomeRepository.updateEntry(
      id,
      existing.organizationId,
      {
        categoryId: next.categoryId,
        amount: next.amount,
        paymentMethod: next.paymentMethod,
        mpesaCode: next.mpesaCode,
        mpesaAmount: next.mpesaAmount,
        cashAmount: next.cashAmount,
        cardAmount: next.cardAmount,
        splitType: next.splitType,
        description: next.description,
        entryDate: next.entryDate,
      },
      { editedById: actor.id, changes },
    );
    if (!updated) throw new NotFoundError('Income entry not found');
    return updated;
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
      startDate,
      endDate,
      page: input.page,
      perPage: input.perPage,
    };

    // Cross-branch view (accountant, no branch selected): the categoryId came from a
    // name-deduped list, so it only matches one branch's row — filter by name instead
    // so entries from every branch's "same" category are included.
    if (input.categoryId && isAccountant && !orgId) {
      const category = await otherIncomeRepository.findEntryCategoryName(input.categoryId);
      if (category) filters.categoryName = category;
    } else if (input.categoryId) {
      filters.categoryId = input.categoryId;
    }

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
