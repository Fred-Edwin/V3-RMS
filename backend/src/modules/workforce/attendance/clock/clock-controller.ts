import type { Request, Response } from 'express';
import { ok, subjectOf } from '../../rota/rota-http';
import { myDay } from '../me/my-day-service';
import { stayOn } from '../prompt/shift-end-service';
import { clockIn } from './clock-in-service';
import { clockOut } from './clock-out-service';
import { clockInSchema, clockOutSchema, shiftEndSchema, undoSchema } from './clock-validators';
import { undoLastTap } from './undo-service';

/** Thin HTTP layer for the phone: my day, clock in, clock out, undo and the shift-end answer. A retry answers 200, a new event 201. */
export const clockController = {
  me: async (req: Request, res: Response): Promise<void> => {
    ok(res, await myDay(subjectOf(req)));
  },
  clockIn: async (req: Request, res: Response): Promise<void> => {
    const result = await clockIn(subjectOf(req), clockInSchema.parse(req.body));
    ok(res, result, result.replayed ? 200 : 201);
  },
  clockOut: async (req: Request, res: Response): Promise<void> => {
    const result = await clockOut(subjectOf(req), clockOutSchema.parse(req.body));
    ok(res, result, result.replayed ? 200 : 201);
  },
  undo: async (req: Request, res: Response): Promise<void> => {
    ok(res, await undoLastTap(subjectOf(req), undoSchema.parse(req.body)));
  },
  shiftEnd: async (req: Request, res: Response): Promise<void> => {
    const result = await stayOn(subjectOf(req), shiftEndSchema.parse(req.body));
    ok(res, result, result.replayed ? 200 : 201);
  },
};
