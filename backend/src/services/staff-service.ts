import type { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { authRepository } from '../repositories/auth-repository';
import { branchRepository } from '../repositories/branch-repository';
import { staffRepository } from '../repositories/staff-repository';
import { hashPassword } from '../utils/password';
import { PROFILE_EXCLUDED_ROLES } from '../utils/hr-constants';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

type Actor = NonNullable<Request['user']>;

const branchStaffRoles: UserRole[] = [
  'MANAGER',
  'WAITER',
  'CHEF',
  'BARISTA',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
  'STEWARD',
  'HOUSEKEEPING',
  'STORE_MANAGER',
  'STORE_ATTENDANT',
];

const managerCreatableRoles: UserRole[] = [
  'WAITER',
  'CHEF',
  'BARISTA',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
  'STEWARD',
  'HOUSEKEEPING',
];

// Store roles always live on the hub org (design doc D-15) — they are never
// branch staff, so branch Managers cannot create them (removed from
// managerCreatableRoles above) and any creation path routes through the
// hub-org enforcement in createStaff.
const storeRoles: UserRole[] = ['STORE_MANAGER', 'STORE_ATTENDANT'];

// A Store Manager manages only Store Attendants, and only on their own (hub)
// org — never branch staff or other store managers. Every staff read/write
// resolves its scope through this so no path can forget the restriction.
const storeManagerManageableRoles: UserRole[] = ['STORE_ATTENDANT'];

interface ActorScope {
  siteId?: string;
  allowedRoles?: UserRole[];
}

const resolveScope = (actor: Actor): ActorScope => {
  if (actor.role === 'STORE_MANAGER') {
    if (!actor.siteId) {
      throw new ForbiddenError('Store Manager organization is required');
    }
    return { siteId: actor.siteId, allowedRoles: storeManagerManageableRoles };
  }
  if (actor.role === 'MANAGER') {
    return { siteId: actor.siteId ?? undefined, allowedRoles: branchStaffRoles };
  }
  return {};
};

interface StaffFiltersInput {
  siteId?: string;
  role?: UserRole;
  isActive?: boolean;
  onShift?: boolean;
}

export const staffService = {
  listStaff: async (actor: Actor, filters: StaffFiltersInput = {}) => {
    if (actor.role === 'STORE_MANAGER') {
      // Team view: this Store Manager's attendants (active and inactive) with
      // PIN status. Other filters are ignored — the scope is fixed.
      const scope = resolveScope(actor);
      const team = await staffRepository.findTeamWithPinStatus(
        scope.siteId as string,
        scope.allowedRoles as UserRole[],
        filters.isActive,
      );
      return team.map((item) => ({ ...item, siteName: item.site?.name ?? null }));
    }

    const shouldUseActorSite =
      actor.role === 'MANAGER' || branchStaffRoles.includes(actor.role);
    const siteId = shouldUseActorSite
      ? actor.siteId ?? undefined
      : filters.siteId;

    const allowedRoles = shouldUseActorSite ? branchStaffRoles : undefined;

    // SYSTEM_ADMIN can see deactivated staff (via explicit isActive filter).
    // All other roles default to active-only unless they explicitly pass isActive=false.
    const isActive =
      actor.role === 'SYSTEM_ADMIN' ? filters.isActive : (filters.isActive ?? true);

    const results = await staffRepository.findMany({
      siteId,
      role: filters.role,
      isActive,
      onShift: filters.onShift,
      allowedRoles,
    });

    return results.map((item) => ({
      ...item,
      siteName: item.site?.name ?? null,
    }));
  },

  getMessagingContacts: async (actor: Actor) => {
    const crossBranchRoles = ['DIRECTOR', 'HR_MANAGER', 'ACCOUNTANT', 'SYSTEM_ADMIN'];
    if (!actor.siteId || crossBranchRoles.includes(actor.role)) {
      // Cross-branch roles see all active human staff across all branches
      const results = await staffRepository.findMany({
        isActive: true,
        allowedRoles: ['DIRECTOR', 'HR_MANAGER', 'MANAGER', 'ACCOUNTANT', 'SYSTEM_ADMIN', 'WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'STORE_MANAGER', 'STORE_ATTENDANT'],
      });
      return results
        .filter((s) => s.id !== actor.id)
        .map((s) => ({ ...s, siteName: s.site?.name ?? null }));
    }
    const results = await staffRepository.findMessagingContacts(actor.siteId, actor.id);
    return results.map((s) => ({ ...s, siteName: s.site?.name ?? null }));
  },

  getStaff: async (id: string, actor: Actor) => {
    const scope = resolveScope(actor);
    const staff = await staffRepository.findById(id, scope.siteId, scope.allowedRoles);
    if (!staff) {
      throw new NotFoundError('Staff account not found');
    }

    return {
      ...staff,
      siteName: staff.site?.name ?? null,
    };
  },

  createStaff: async (
    data: {
      name: string;
      email: string;
      phone?: string;
      role: UserRole;
      temporaryPassword: string;
      siteId?: string;
    },
    actor: Actor,
  ) => {
    const existing = await staffRepository.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('Email is already in use');
    }

    if (actor.role === 'MANAGER') {
      if (!managerCreatableRoles.includes(data.role)) {
        throw new ForbiddenError('Managers can only create branch staff accounts');
      }

      if (!actor.siteId) {
        throw new ForbiddenError('Manager organization is required');
      }

      if (data.siteId && data.siteId !== actor.siteId) {
        throw new ForbiddenError('Managers can only create staff in their own branch');
      }
    } else if (actor.role === 'DIRECTOR') {
      if (data.role !== 'MANAGER') {
        throw new ForbiddenError('Directors can only create managers');
      }
      if (!data.siteId) {
        throw new ValidationError('organizationId is required for manager accounts');
      }
    } else if (actor.role === 'STORE_MANAGER') {
      // Mirrors the branch-Manager pattern: the Store Manager staffs their own
      // floor, limited to attendants in their own (hub) organization.
      if (data.role !== 'STORE_ATTENDANT') {
        throw new ForbiddenError('Store Managers can only create Store Attendant accounts');
      }
      if (!actor.siteId) {
        throw new ForbiddenError('Store Manager organization is required');
      }
      if (data.siteId && data.siteId !== actor.siteId) {
        throw new ForbiddenError('Store Managers can only create staff in the Central Store organization');
      }
    } else if (actor.role === 'SYSTEM_ADMIN') {
      if (data.role === 'MANAGER' && !data.siteId) {
        throw new ValidationError('organizationId is required for manager accounts');
      }
    } else {
      throw new ForbiddenError('You do not have permission to create staff accounts');
    }

    // Store roles are always assigned to the hub org, regardless of what the
    // caller sent — Central Store data follows the store user's session org,
    // so a store user on a branch org would silently branch-scope the entire
    // inventory (design doc D-15).
    let storeSiteId: string | undefined;
    if (storeRoles.includes(data.role)) {
      const hubOrg = await branchRepository.findHub();
      if (!hubOrg) {
        throw new ValidationError(
          'No hub organization is set. Create the Central Store organization and flag it as hub before adding store staff.',
        );
      }
      if (data.siteId && data.siteId !== hubOrg.id) {
        throw new ValidationError('Store staff must belong to the Central Store (hub) organization');
      }
      storeSiteId = hubOrg.id;
    }

    const passwordHash = await hashPassword(data.temporaryPassword);
    // Org-level roles (DIRECTOR, ACCOUNTANT) have no branch assignment
    const isOrgLevelRole = data.role === 'DIRECTOR' || data.role === 'ACCOUNTANT';
    // EmployeeProfile is auto-created atomically with the user. Contract type
    // (and therefore leave balances) is assigned later by HR on the staff
    // detail page — no employmentType is guessed here.
    const created = await staffRepository.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      siteId:
        storeSiteId ??
        (actor.role === 'MANAGER' ? actor.siteId : isOrgLevelRole ? null : data.siteId ?? null),
      passwordHash,
      withEmployeeProfile: !PROFILE_EXCLUDED_ROLES.includes(data.role),
    });

    return {
      ...created,
      siteName: created.site?.name ?? null,
    };
  },

  updateStaff: async (
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
    },
    actor: Actor,
  ) => {
    const orgScope = actor.role === 'MANAGER' ? actor.siteId ?? undefined : undefined;
    const staff = await staffRepository.findById(
      id,
      orgScope,
      actor.role === 'MANAGER' ? branchStaffRoles : undefined,
    );
    if (!staff) {
      throw new NotFoundError('Staff account not found');
    }

    if (data.email && data.email !== staff.email) {
      const existing = await staffRepository.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new ConflictError('Email is already in use');
      }
    }

    await staffRepository.update(id, data, orgScope);
    return staffService.getStaff(id, actor);
  },

  resetPassword: async (id: string, temporaryPassword: string, actor: Actor) => {
    const scope = resolveScope(actor);
    const staff = await staffRepository.findById(id, scope.siteId, scope.allowedRoles);
    if (!staff) {
      throw new NotFoundError('Staff account not found');
    }

    const passwordHash = await hashPassword(temporaryPassword);
    await staffRepository.updatePassword(id, passwordHash, scope.siteId, scope.allowedRoles);
    await authRepository.deleteAllRefreshTokensByUserId(id);
  },

  // Clears the target's signing PIN; they set a new one at next signing. The
  // caller never sees or chooses a PIN. Hub-org Store Attendants only for a
  // Store Manager; System Admin is unscoped.
  resetPin: async (id: string, actor: Actor) => {
    const scope = resolveScope(actor);
    const staff = await staffRepository.findById(id, scope.siteId, scope.allowedRoles);
    if (!staff) {
      throw new NotFoundError('Staff account not found');
    }

    const siteId = scope.siteId ?? staff.siteId;
    if (!siteId) {
      throw new ValidationError('Staff account has no organization to reset a PIN in');
    }
    await staffRepository.clearPin(id, siteId, scope.allowedRoles ?? [staff.role]);
  },

  hardDeleteStaff: async (id: string, actor: Actor) => {
    const orgScope = actor.role === 'MANAGER' ? actor.siteId ?? undefined : undefined;
    const staff = await staffRepository.findById(
      id,
      orgScope,
      actor.role === 'MANAGER' ? branchStaffRoles : undefined,
    );
    if (!staff) {
      throw new NotFoundError('Staff account not found');
    }

    const deps = await staffRepository.countDependencies(id, orgScope);
    const reasons: string[] = [];
    if (deps.orders > 0) reasons.push(`${deps.orders} order(s)`);
    if (deps.shiftAssignments > 0) reasons.push(`${deps.shiftAssignments} shift assignment(s)`);
    if (deps.clockRecords > 0) reasons.push(`${deps.clockRecords} clock record(s)`);

    if (reasons.length > 0) {
      throw new ConflictError(
        `Cannot delete staff account — linked to ${reasons.join(', ')}. Deactivate instead.`,
      );
    }

    await staffRepository.hardDelete(id, orgScope);
  },

  deactivateStaff: async (id: string, actor: Actor) => {
    const scope = resolveScope(actor);
    const result = await staffRepository.setActive(
      id,
      false,
      scope.siteId,
      scope.allowedRoles,
    );
    if (result.count === 0) {
      throw new NotFoundError('Staff account not found');
    }

    return staffService.getStaff(id, actor);
  },

  reactivateStaff: async (id: string, actor: Actor) => {
    const scope = resolveScope(actor);
    const result = await staffRepository.setActive(
      id,
      true,
      scope.siteId,
      scope.allowedRoles,
    );
    if (result.count === 0) {
      throw new NotFoundError('Staff account not found');
    }

    return staffService.getStaff(id, actor);
  },
};
