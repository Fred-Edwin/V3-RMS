import type { Request, Response } from 'express';
import { printService } from '../services/print-service';
import {
  CreatePrintJobSchema,
  CreatePrintStationSchema,
  PrintJobQuerySchema,
  StationJobQuerySchema,
  UpdatePrintJobStatusSchema,
  routeIdParamSchema,
} from '../validators/print-schemas';
import { UnauthorizedError } from '../utils/errors';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  return req.user;
};

const requireStation = (req: Request) => {
  if (!req.printStation) {
    throw new UnauthorizedError('Print station authentication required');
  }
  return req.printStation;
};

export const printController = {
  // ── Print Jobs (JWT-authenticated) ──────────────────────────────────────

  createPrintJob: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { orderId } = CreatePrintJobSchema.parse(req.body);

    const organizationId = actor.organizationId;
    if (!organizationId) {
      throw new UnauthorizedError('User is not assigned to a branch');
    }

    const job = await printService.createPrintJob(orderId, actor.id, organizationId);

    res.status(201).json({
      success: true,
      data: job,
      message: 'Print job created',
    });
  },

  getPrintJobs: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = PrintJobQuerySchema.parse(req.query);

    const organizationId = actor.organizationId;
    if (!organizationId) {
      throw new UnauthorizedError('User is not assigned to a branch');
    }

    const result = await printService.getPrintJobs(organizationId, query);

    res.status(200).json({
      success: true,
      data: result.jobs,
      pagination: result.pagination,
    });
  },

  getPrintJobById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);

    const organizationId = actor.organizationId;
    if (!organizationId) {
      throw new UnauthorizedError('User is not assigned to a branch');
    }

    const job = await printService.getPrintJobById(id, organizationId);

    res.status(200).json({
      success: true,
      data: job,
    });
  },

  // ── Print Station Endpoints (print station token auth) ──────────────────

  getStationJobs: async (req: Request, res: Response): Promise<void> => {
    const station = requireStation(req);
    const query = StationJobQuerySchema.parse(req.query);

    const jobs = await printService.getPendingJobsForStation(
      station.organizationId,
      query.status,
    );

    res.status(200).json({
      success: true,
      data: jobs,
    });
  },

  updateStationJobStatus: async (req: Request, res: Response): Promise<void> => {
    const station = requireStation(req);
    const { id } = routeIdParamSchema.parse(req.params);
    const body = UpdatePrintJobStatusSchema.parse(req.body);

    const updated = await printService.updateJobStatus(id, station.organizationId, {
      status: body.status,
      printedAt: 'printedAt' in body ? body.printedAt : undefined,
      failureReason: 'failureReason' in body ? body.failureReason : undefined,
    });

    res.status(200).json({
      success: true,
      data: updated,
    });
  },

  heartbeat: async (req: Request, res: Response): Promise<void> => {
    const station = requireStation(req);

    const result = await printService.heartbeat(station.id);

    res.status(200).json({
      success: true,
      data: result,
    });
  },

  // ── Print Station Management (JWT-authenticated) ─────────────────────────

  createPrintStation: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { name } = CreatePrintStationSchema.parse(req.body);

    const organizationId = actor.organizationId;
    if (!organizationId) {
      throw new UnauthorizedError('User is not assigned to a branch');
    }

    const station = await printService.createPrintStation(name, organizationId);

    res.status(201).json({
      success: true,
      data: station,
      message: 'Print station created. Save the token — it will not be shown again.',
    });
  },

  listPrintStations: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);

    const organizationId = actor.organizationId;
    if (!organizationId) {
      throw new UnauthorizedError('User is not assigned to a branch');
    }

    const stations = await printService.listPrintStations(organizationId);

    res.status(200).json({
      success: true,
      data: stations,
    });
  },

  deactivatePrintStation: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);

    const organizationId = actor.organizationId;
    if (!organizationId) {
      throw new UnauthorizedError('User is not assigned to a branch');
    }

    await printService.deactivatePrintStation(id, organizationId);

    res.status(200).json({
      success: true,
      data: null,
      message: 'Print station deactivated',
    });
  },
};
