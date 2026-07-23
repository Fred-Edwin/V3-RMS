import { staffTransferRepository } from '../repositories/staff-transfer-repository';
import { staffRepository } from '../repositories/staff-repository';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';

interface Actor {
  id: string;
  role: string;
  organizationId: string | null;
}

interface CreateTransferInput {
  userId: string;
  toOrganizationId: string;
  notes?: string;
}

export const staffTransferService = {
  async createTransfer(actor: Actor, input: CreateTransferInput) {
    const allowedRoles = ['DIRECTOR', 'HR_MANAGER', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(actor.role)) {
      throw new ForbiddenError('Only Directors, HR Managers, and System Admins can transfer staff');
    }

    const staff = await staffRepository.findById(input.userId);
    if (!staff) {
      throw new NotFoundError('Staff member not found');
    }

    if (!staff.isActive) {
      throw new ValidationError('Cannot transfer an inactive staff member');
    }

    if (staff.organizationId === input.toOrganizationId) {
      throw new ValidationError('Staff member is already assigned to this branch');
    }

    return staffTransferRepository.create({
      userId: input.userId,
      fromOrganizationId: staff.organizationId,
      toOrganizationId: input.toOrganizationId,
      authorizedById: actor.id,
      notes: input.notes,
    });
  },

  async listTransfers(actor: Actor, userId: string) {
    const allowedRoles = ['DIRECTOR', 'HR_MANAGER', 'SYSTEM_ADMIN'];
    if (!allowedRoles.includes(actor.role)) {
      throw new ForbiddenError('Access denied');
    }

    const staff = await staffRepository.findById(userId);
    if (!staff) {
      throw new NotFoundError('Staff member not found');
    }

    return staffTransferRepository.listByUser(userId);
  },
};
