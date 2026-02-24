import type { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { staffRepository } from '../repositories/staff-repository';
import { hashPassword } from '../utils/password';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

type Actor = NonNullable<Request['user']>;

const branchStaffRoles: UserRole[] = [
  'MANAGER',
  'WAITER',
  'CHEF',
  'BARISTA',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
];

const managerCreatableRoles: UserRole[] = [
  'WAITER',
  'CHEF',
  'BARISTA',
  'KITCHEN_DISPLAY',
  'BARISTA_DISPLAY',
];

interface StaffFiltersInput {
  organizationId?: string;
  role?: UserRole;
  isActive?: boolean;
  onShift?: boolean;
}

export const staffService = {
  listStaff: async (actor: Actor, filters: StaffFiltersInput = {}) => {
    const shouldUseActorOrganization =
      actor.role === 'MANAGER' || branchStaffRoles.includes(actor.role);
    const organizationId = shouldUseActorOrganization
      ? actor.organizationId ?? undefined
      : filters.organizationId;

    const allowedRoles = shouldUseActorOrganization ? branchStaffRoles : undefined;

    const results = await staffRepository.findMany({
      organizationId,
      role: filters.role,
      isActive: filters.isActive,
      onShift: filters.onShift,
      allowedRoles,
    });

    return results.map((item) => ({
      ...item,
      organizationName: item.organization?.name ?? null,
    }));
  },

  getStaff: async (id: string, actor: Actor) => {
    const staff = await staffRepository.findById(
      id,
      actor.role === 'MANAGER' ? actor.organizationId ?? undefined : undefined,
      actor.role === 'MANAGER' ? branchStaffRoles : undefined,
    );
    if (!staff) {
      throw new NotFoundError('Staff account not found');
    }

    return {
      ...staff,
      organizationName: staff.organization?.name ?? null,
    };
  },

  createStaff: async (
    data: {
      name: string;
      email: string;
      phone?: string;
      role: UserRole;
      temporaryPassword: string;
      organizationId?: string;
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

      if (!actor.organizationId) {
        throw new ForbiddenError('Manager organization is required');
      }

      if (data.organizationId && data.organizationId !== actor.organizationId) {
        throw new ForbiddenError('Managers can only create staff in their own branch');
      }
    } else if (actor.role === 'DIRECTOR') {
      if (data.role !== 'MANAGER') {
        throw new ForbiddenError('Directors can only create managers');
      }
      if (!data.organizationId) {
        throw new ValidationError('organizationId is required for manager accounts');
      }
    } else if (actor.role === 'SYSTEM_ADMIN') {
      if (data.role === 'MANAGER' && !data.organizationId) {
        throw new ValidationError('organizationId is required for manager accounts');
      }
    } else {
      throw new ForbiddenError('You do not have permission to create staff accounts');
    }

    const passwordHash = await hashPassword(data.temporaryPassword);
    const created = await staffRepository.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      organizationId:
        actor.role === 'MANAGER' ? actor.organizationId : data.role === 'DIRECTOR' ? null : data.organizationId ?? null,
      passwordHash,
    });

    return {
      ...created,
      organizationName: created.organization?.name ?? null,
    };
  },

  updateStaff: async (
    id: string,
    data: {
      name?: string;
      phone?: string;
    },
    actor: Actor,
  ) => {
    const staff = await staffRepository.findById(
      id,
      actor.role === 'MANAGER' ? actor.organizationId ?? undefined : undefined,
      actor.role === 'MANAGER' ? branchStaffRoles : undefined,
    );
    if (!staff) {
      throw new NotFoundError('Staff account not found');
    }

    await staffRepository.update(id, data, actor.role === 'MANAGER' ? actor.organizationId ?? undefined : undefined);
    return staffService.getStaff(id, actor);
  },

  deactivateStaff: async (id: string, actor: Actor) => {
    const result = await staffRepository.setActive(
      id,
      false,
      actor.role === 'MANAGER' ? actor.organizationId ?? undefined : undefined,
    );
    if (result.count === 0) {
      throw new NotFoundError('Staff account not found');
    }

    return staffService.getStaff(id, actor);
  },

  reactivateStaff: async (id: string, actor: Actor) => {
    const result = await staffRepository.setActive(
      id,
      true,
      actor.role === 'MANAGER' ? actor.organizationId ?? undefined : undefined,
    );
    if (result.count === 0) {
      throw new NotFoundError('Staff account not found');
    }

    return staffService.getStaff(id, actor);
  },
};
