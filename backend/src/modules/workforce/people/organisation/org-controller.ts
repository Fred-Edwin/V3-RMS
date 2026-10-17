import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import type { AccessSubject } from '../../_shared/workforce-access';
import { departmentsReadService } from './departments/departments-read-service';
import { departmentsService } from './departments/departments-service';
import { headsService } from './heads/heads-service';
import {
  AssignHeadSchema,
  DepartmentCreateSchema,
  DepartmentQuerySchema,
  DepartmentUpdateSchema,
  EndHeadSchema,
  OrgIdParamsSchema,
  OverviewQuerySchema,
  PositionCreateSchema,
  PositionImpactQuerySchema,
  PositionsQuerySchema,
  PositionUpdateSchema,
} from './org-validators';
import { positionsService } from './positions/positions-service';

const subjectOf = (req: Request): AccessSubject => {
  const subject = req.workforceSubject ?? req.user;
  if (!subject) throw new UnauthorizedError('Authentication required');
  return subject;
};
const ok = (res: Response, data: unknown, status = 200): void => {
  res.status(status).json({ success: true, data });
};
const idOf = (req: Request): string => OrgIdParamsSchema.parse(req.params).id;

/** Thin HTTP layer for the Organisation endpoints: parse, call the service, wrap the answer. No logic here. */
export const orgController = {
  // ---- departments (O1 to O5) -------------------------------------------------------------------
  overview: async (req: Request, res: Response): Promise<void> => {
    ok(res, await departmentsReadService.overview(subjectOf(req), OverviewQuerySchema.parse(req.query).includeRetired));
  },
  department: async (req: Request, res: Response): Promise<void> => {
    ok(res, await departmentsReadService.getDepartment(subjectOf(req), idOf(req), DepartmentQuerySchema.parse(req.query)));
  },
  createDepartment: async (req: Request, res: Response): Promise<void> => {
    ok(res, await departmentsService.create(subjectOf(req), DepartmentCreateSchema.parse(req.body)), 201);
  },
  updateDepartment: async (req: Request, res: Response): Promise<void> => {
    ok(res, await departmentsService.update(subjectOf(req), idOf(req), DepartmentUpdateSchema.parse(req.body)));
  },
  retireDepartment: async (req: Request, res: Response): Promise<void> => {
    ok(res, await departmentsService.retire(subjectOf(req), idOf(req)));
  },
  restoreDepartment: async (req: Request, res: Response): Promise<void> => {
    ok(res, await departmentsService.restore(subjectOf(req), idOf(req)));
  },

  // ---- heads (O6 to O9) -------------------------------------------------------------------------
  headCandidates: async (req: Request, res: Response): Promise<void> => {
    ok(res, await headsService.candidates(subjectOf(req), idOf(req)));
  },
  previewHead: async (req: Request, res: Response): Promise<void> => {
    ok(res, await headsService.preview(subjectOf(req), idOf(req), AssignHeadSchema.parse(req.body)));
  },
  assignHead: async (req: Request, res: Response): Promise<void> => {
    ok(res, await headsService.assign(subjectOf(req), idOf(req), AssignHeadSchema.parse(req.body)));
  },
  endHead: async (req: Request, res: Response): Promise<void> => {
    ok(res, await headsService.end(subjectOf(req), idOf(req), EndHeadSchema.parse(req.body)));
  },

  // ---- positions (O10 to O15) -------------------------------------------------------------------
  positions: async (req: Request, res: Response): Promise<void> => {
    ok(res, await positionsService.list(subjectOf(req), PositionsQuerySchema.parse(req.query)));
  },
  position: async (req: Request, res: Response): Promise<void> => {
    ok(res, await positionsService.get(subjectOf(req), idOf(req)));
  },
  createPosition: async (req: Request, res: Response): Promise<void> => {
    ok(res, await positionsService.create(subjectOf(req), PositionCreateSchema.parse(req.body)), 201);
  },
  positionImpact: async (req: Request, res: Response): Promise<void> => {
    ok(res, await positionsService.impact(subjectOf(req), idOf(req), PositionImpactQuerySchema.parse(req.query).defaultTracksTime));
  },
  updatePosition: async (req: Request, res: Response): Promise<void> => {
    ok(res, await positionsService.update(subjectOf(req), idOf(req), PositionUpdateSchema.parse(req.body)));
  },
  retirePosition: async (req: Request, res: Response): Promise<void> => {
    ok(res, await positionsService.retire(subjectOf(req), idOf(req)));
  },
  restorePosition: async (req: Request, res: Response): Promise<void> => {
    ok(res, await positionsService.restore(subjectOf(req), idOf(req)));
  },
};
