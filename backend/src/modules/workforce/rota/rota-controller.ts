import type { Request, Response } from 'express';
import { parseNairobiDate } from '../_shared/time/nairobi-time';
import { cellsService } from './cells/cells-service';
import { FillSchema, PatternSchema, SetCellsSchema } from './cells/cells-validators';
import { copyService } from './copy/copy-service';
import { CopySchema } from './copy/copy-validators';
import { ok, subjectOf } from './rota-http';
import { myShiftsService } from './weeks/my-shifts-service';
import { printService } from './weeks/print-service';
import { weeksReadService, type WeekRequest } from './weeks/weeks-read-service';
import { MyShiftsQuerySchema, WeekQuerySchema } from './weeks/weeks-validators';

const weekRequest = (req: Request): WeekRequest => {
  const query = WeekQuerySchema.parse(req.query);
  return { ...query, weekStart: parseNairobiDate(query.weekStart) };
};

/** Thin HTTP layer for the week grid, the cell writers, the copy and "my shifts". No logic here. */
export const rotaController = {
  week: async (req: Request, res: Response): Promise<void> => {
    ok(res, await weeksReadService.getWeek(subjectOf(req), weekRequest(req)));
  },
  print: async (req: Request, res: Response): Promise<void> => {
    ok(res, await printService.get(subjectOf(req), weekRequest(req)));
  },
  mine: async (req: Request, res: Response): Promise<void> => {
    ok(res, await myShiftsService.list(subjectOf(req), MyShiftsQuerySchema.parse(req.query)));
  },
  setCells: async (req: Request, res: Response): Promise<void> => {
    ok(res, await cellsService.setCells(subjectOf(req), SetCellsSchema.parse(req.body)));
  },
  fill: async (req: Request, res: Response): Promise<void> => {
    ok(res, await cellsService.fill(subjectOf(req), FillSchema.parse(req.body)));
  },
  pattern: async (req: Request, res: Response): Promise<void> => {
    ok(res, await cellsService.pattern(subjectOf(req), PatternSchema.parse(req.body)));
  },
  copyPreview: async (req: Request, res: Response): Promise<void> => {
    ok(res, await copyService.preview(subjectOf(req), CopySchema.parse(req.body)));
  },
  copy: async (req: Request, res: Response): Promise<void> => {
    ok(res, await copyService.copy(subjectOf(req), CopySchema.parse(req.body)));
  },
};
