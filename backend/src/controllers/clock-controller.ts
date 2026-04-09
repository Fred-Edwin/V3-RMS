import type { Request, Response } from 'express';
import { clockService } from '../services/clock-service';
import { UnauthorizedError } from '../utils/errors';
import { ClockInOutSchema, ClockOverrideSchema, UndoClockOutSchema } from '../validators/shift-schemas';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  return req.user;
};

export const clockController = {
  clockIn: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = ClockInOutSchema.parse(req.body);
    const record = await clockService.clockIn(actor, data);

    res.status(201).json({
      success: true,
      data: record,
      message: 'Clocked in successfully',
    });
  },

  clockOut: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = ClockInOutSchema.parse(req.body);
    const record = await clockService.clockOut(actor, data);

    res.status(200).json({
      success: true,
      data: record,
      message: 'Clocked out successfully',
    });
  },

  undoClockOut: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = UndoClockOutSchema.parse(req.body);
    const record = await clockService.undoClockOut(actor, data);

    res.status(200).json({
      success: true,
      data: record,
      message: 'Clock-out undone successfully',
    });
  },

  clockOverride: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = ClockOverrideSchema.parse(req.body);
    const result = await clockService.clockOverride(actor, data);

    res.status(201).json({
      success: true,
      data: result.record,
      message: result.message,
    });
  },
};
