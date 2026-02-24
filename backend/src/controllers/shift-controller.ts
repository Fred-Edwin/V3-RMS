import type { Request, Response } from 'express';
import { shiftService } from '../services/shift-service';
import { UnauthorizedError } from '../utils/errors';
import {
  CreateShiftSchema,
  ShiftIdParamSchema,
  ShiftListQuerySchema,
  UpdateShiftSchema,
} from '../validators/shift-schemas';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  return req.user;
};

export const shiftController = {
  listShifts: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ShiftListQuerySchema.parse(req.query);
    const shifts = await shiftService.listShifts(actor, query);

    res.status(200).json({
      success: true,
      data: shifts,
    });
  },

  createShift: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreateShiftSchema.parse(req.body);
    const shift = await shiftService.createShift(actor, data);

    res.status(201).json({
      success: true,
      data: shift,
      message: 'Shift created successfully',
    });
  },

  updateShift: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = ShiftIdParamSchema.parse(req.params);
    const data = UpdateShiftSchema.parse(req.body);
    const shift = await shiftService.updateShift(actor, id, data);

    res.status(200).json({
      success: true,
      data: shift,
      message: 'Shift updated successfully',
    });
  },

  deleteShift: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = ShiftIdParamSchema.parse(req.params);
    await shiftService.deleteShift(actor, id);

    res.status(200).json({
      success: true,
      message: 'Shift deleted successfully',
    });
  },
};
