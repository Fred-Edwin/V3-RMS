import type { Request, Response } from 'express';
import { staffService } from '../services/staff-service';
import { listStaffQuerySchema, createStaffSchema, updateStaffSchema, resetPasswordSchema } from '../validators/staff-schemas';
import { UnauthorizedError, ValidationError } from '../utils/errors';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  return req.user;
};

const requireRouteId = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError('id param is required');
  }
  return value;
};

export const staffController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const filters = listStaffQuerySchema.parse(req.query);
    const staff = await staffService.listStaff(actor, filters);

    res.status(200).json({
      success: true,
      data: staff,
      pagination: {
        total: staff.length,
        page: 1,
        perPage: staff.length,
        totalPages: 1,
      },
    });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const staffId = requireRouteId(req.params.id);
    const staff = await staffService.getStaff(staffId, actor);

    res.status(200).json({
      success: true,
      data: staff,
    });
  },

  create: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = createStaffSchema.parse(req.body);
    const staff = await staffService.createStaff(data, actor);

    res.status(201).json({
      success: true,
      data: staff,
      message: 'Staff account created successfully',
    });
  },

  update: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = updateStaffSchema.parse(req.body);
    const staffId = requireRouteId(req.params.id);
    const staff = await staffService.updateStaff(staffId, data, actor);

    res.status(200).json({
      success: true,
      data: staff,
      message: 'Staff updated successfully',
    });
  },

  deactivate: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const staffId = requireRouteId(req.params.id);
    const staff = await staffService.deactivateStaff(staffId, actor);

    res.status(200).json({
      success: true,
      data: {
        id: staff.id,
        isActive: staff.isActive,
      },
      message: 'Staff account deactivated',
    });
  },

  reactivate: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const staffId = requireRouteId(req.params.id);
    const staff = await staffService.reactivateStaff(staffId, actor);

    res.status(200).json({
      success: true,
      data: {
        id: staff.id,
        isActive: staff.isActive,
      },
      message: 'Staff account reactivated',
    });
  },

  resetPassword: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const staffId = requireRouteId(req.params.id);
    const { temporaryPassword } = resetPasswordSchema.parse(req.body);
    await staffService.resetPassword(staffId, temporaryPassword, actor);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. Staff member will need to sign in again.',
    });
  },

  hardDelete: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const staffId = requireRouteId(req.params.id);
    await staffService.hardDeleteStaff(staffId, actor);

    res.status(200).json({
      success: true,
      message: 'Staff account permanently deleted.',
    });
  },
};
