import type { Request, Response } from 'express';
import { staffService } from '../services/staff-service';
import { listStaffQuerySchema, createStaffSchema, updateStaffSchema, resetPasswordSchema, staffIdParamSchema } from '../validators/staff-schemas';
import { UnauthorizedError } from '../utils/errors';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  return req.user;
};

export const staffController = {
  messagingContacts: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const contacts = await staffService.getMessagingContacts(actor);
    res.status(200).json({ success: true, data: contacts });
  },

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
    const { id: staffId } = staffIdParamSchema.parse(req.params);
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
    const { id: staffId } = staffIdParamSchema.parse(req.params);
    const staff = await staffService.updateStaff(staffId, data, actor);

    res.status(200).json({
      success: true,
      data: staff,
      message: 'Staff updated successfully',
    });
  },

  deactivate: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id: staffId } = staffIdParamSchema.parse(req.params);
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
    const { id: staffId } = staffIdParamSchema.parse(req.params);
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
    const { id: staffId } = staffIdParamSchema.parse(req.params);
    const { temporaryPassword } = resetPasswordSchema.parse(req.body);
    await staffService.resetPassword(staffId, temporaryPassword, actor);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. Staff member will need to sign in again.',
    });
  },

  resetPin: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id: staffId } = staffIdParamSchema.parse(req.params);
    await staffService.resetPin(staffId, actor);

    res.status(200).json({
      success: true,
      message: 'PIN cleared. The staff member will set a new one at their next signing.',
    });
  },

  hardDelete: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id: staffId } = staffIdParamSchema.parse(req.params);
    await staffService.hardDeleteStaff(staffId, actor);

    res.status(200).json({
      success: true,
      message: 'Staff account permanently deleted.',
    });
  },
};
