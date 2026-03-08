import type { Request, Response } from 'express';
import { shiftAssignmentService } from '../services/shift-assignment-service';
import { UnauthorizedError } from '../utils/errors';
import {
  BatchCreateShiftAssignmentSchema,
  CreateShiftAssignmentSchema,
  ShiftAssignmentIdParamSchema,
  ShiftAssignmentQuerySchema,
} from '../validators/shift-schemas';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  return req.user;
};

export const shiftAssignmentController = {
  listAssignments: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ShiftAssignmentQuerySchema.parse(req.query);
    const assignments = await shiftAssignmentService.listAssignments(actor, query);

    res.status(200).json({
      success: true,
      data: assignments,
    });
  },

  createAssignment: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreateShiftAssignmentSchema.parse(req.body);
    const assignment = await shiftAssignmentService.createAssignment(actor, data);

    res.status(201).json({
      success: true,
      data: assignment,
      message: 'Shift assigned successfully',
    });
  },

  batchCreateAssignments: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = BatchCreateShiftAssignmentSchema.parse(req.body);
    const result = await shiftAssignmentService.batchCreateAssignments(actor, data);

    res.status(207).json({
      success: true,
      data: result,
      message: `${result.created} assignment${result.created === 1 ? '' : 's'} created, ${result.skipped} skipped`,
    });
  },

  deleteAssignment: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = ShiftAssignmentIdParamSchema.parse(req.params);
    await shiftAssignmentService.deleteAssignment(actor, id);

    res.status(200).json({
      success: true,
      message: 'Shift assignment removed',
    });
  },
};
