import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../utils/errors';
import { branchDayService } from './branch-day-service';
import {
  acceptOpeningInputSchema,
  activityQuerySchema,
  closeDayInputSchema,
  correctCountInputSchema,
  countQuerySchema,
  dayDepartmentParamsSchema,
  dayParamsSchema,
  entriesQuerySchema,
  historyQuerySchema,
  myHistoryQuerySchema,
  openingQuerySchema,
  recountOpeningInputSchema,
  recountPreviewInputSchema,
  saveCountInputSchema,
  sheetQuerySchema,
  signCountInputSchema,
  todayQuerySchema,
} from './branch-day-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

const ok = (res: Response, data: unknown, status = 200): void => {
  res.status(status).json({ success: true, data });
};

/** A signing write answers 201 the first time and 200 for a replay of the same idempotency key. */
const created = (res: Response, data: { replayed: boolean }): void => ok(res, data, data.replayed ? 200 : 201);

export const branchDayController = {
  // The head (BD1 to BD10)
  home: async (req: Request, res: Response): Promise<void> => ok(res, await branchDayService.home(requireActor(req))),
  opening: async (req: Request, res: Response): Promise<void> => ok(res, await branchDayService.opening(requireActor(req), openingQuerySchema.parse(req.query))),
  acceptOpening: async (req: Request, res: Response): Promise<void> => created(res, await branchDayService.acceptOpening(requireActor(req), acceptOpeningInputSchema.parse(req.body))),
  previewRecount: async (req: Request, res: Response): Promise<void> => ok(res, await branchDayService.previewRecount(requireActor(req), recountPreviewInputSchema.parse(req.body))),
  recountOpening: async (req: Request, res: Response): Promise<void> => created(res, await branchDayService.recountOpening(requireActor(req), recountOpeningInputSchema.parse(req.body))),
  getCount: async (req: Request, res: Response): Promise<void> => ok(res, await branchDayService.getCount(requireActor(req), countQuerySchema.parse(req.query))),
  saveCount: async (req: Request, res: Response): Promise<void> => ok(res, await branchDayService.saveCount(requireActor(req), saveCountInputSchema.parse(req.body))),
  signCount: async (req: Request, res: Response): Promise<void> => created(res, await branchDayService.signCount(requireActor(req), signCountInputSchema.parse(req.body))),
  myHistory: async (req: Request, res: Response): Promise<void> => ok(res, await branchDayService.myHistory(requireActor(req), myHistoryQuerySchema.parse(req.query))),
  myDay: async (req: Request, res: Response): Promise<void> => ok(res, await branchDayService.myDay(requireActor(req), dayParamsSchema.parse(req.params).id)),

  // The Branch Manager and the readers (BD11 to BD21)
  today: async (req: Request, res: Response): Promise<void> => ok(res, await branchDayService.today(requireActor(req), todayQuerySchema.parse(req.query))),
  departmentFigures: async (req: Request, res: Response): Promise<void> => {
    const { id, departmentId } = dayDepartmentParamsSchema.parse(req.params);
    ok(res, await branchDayService.departmentFigures(requireActor(req), id, departmentId));
  },
  closeSummary: async (req: Request, res: Response): Promise<void> => ok(res, await branchDayService.closeSummary(requireActor(req), dayParamsSchema.parse(req.params).id)),
  closeDay: async (req: Request, res: Response): Promise<void> =>
    created(res, await branchDayService.closeDay(requireActor(req), dayParamsSchema.parse(req.params).id, closeDayInputSchema.parse(req.body))),
  history: async (req: Request, res: Response): Promise<void> => ok(res, await branchDayService.history(requireActor(req), historyQuerySchema.parse(req.query))),
  dayFile: async (req: Request, res: Response): Promise<void> => ok(res, await branchDayService.dayFile(requireActor(req), dayParamsSchema.parse(req.params).id)),
  activity: async (req: Request, res: Response): Promise<void> =>
    ok(res, await branchDayService.activity(requireActor(req), dayParamsSchema.parse(req.params).id, activityQuerySchema.parse(req.query))),
  documents: async (req: Request, res: Response): Promise<void> => ok(res, await branchDayService.documents(requireActor(req), dayParamsSchema.parse(req.params).id)),
  entries: async (req: Request, res: Response): Promise<void> =>
    ok(res, await branchDayService.entries(requireActor(req), dayParamsSchema.parse(req.params).id, entriesQuerySchema.parse(req.query))),
  correctCount: async (req: Request, res: Response): Promise<void> =>
    created(res, await branchDayService.correctCount(requireActor(req), dayParamsSchema.parse(req.params).id, correctCountInputSchema.parse(req.body))),
  sheet: async (req: Request, res: Response): Promise<void> =>
    ok(res, await branchDayService.sheet(requireActor(req), dayParamsSchema.parse(req.params).id, sheetQuerySchema.parse(req.query))),
};
