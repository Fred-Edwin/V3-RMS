import type { Request, Response } from 'express';
import { shiftAssignmentService } from '../services/shift-assignment-service';
import { UnauthorizedError } from '../utils/errors';
import {
  BatchCreateShiftAssignmentSchema,
  BatchDeleteShiftAssignmentSchema,
  CopyWeekSchema,
  CreateShiftAssignmentSchema,
  ReconcileWeekShiftAssignmentsSchema,
  ShiftAssignmentIdParamSchema,
  ShiftAssignmentQuerySchema,
  ShiftListQuerySchema,
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

  copyWeek: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CopyWeekSchema.parse(req.body);
    const result = await shiftAssignmentService.copyWeek(actor, data);

    res.status(200).json({
      success: true,
      data: result,
      message: `${result.created} assignment${result.created === 1 ? '' : 's'} copied, ${result.skipped} skipped`,
    });
  },

  batchDeleteAssignments: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = BatchDeleteShiftAssignmentSchema.parse(req.body);
    const result = await shiftAssignmentService.batchDeleteAssignments(actor, data);

    res.status(200).json({
      success: true,
      data: result,
      message: `${result.deleted} assignment${result.deleted === 1 ? '' : 's'} deleted`,
    });
  },

  reconcileWeek: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = ReconcileWeekShiftAssignmentsSchema.parse(req.body);
    const result = await shiftAssignmentService.reconcileWeek(actor, data);

    res.status(result.skipped > 0 ? 207 : 200).json({
      success: true,
      data: result,
      message: `${result.saved} change${result.saved === 1 ? '' : 's'} saved, ${result.skipped} skipped`,
    });
  },

  deleteAssignment: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = ShiftAssignmentIdParamSchema.parse(req.params);
    const query = ShiftListQuerySchema.parse(req.query);
    await shiftAssignmentService.deleteAssignment(actor, id, query);

    res.status(200).json({
      success: true,
      message: 'Shift assignment removed',
    });
  },
};
