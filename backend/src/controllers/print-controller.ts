import type { Request, Response } from 'express';
import { printService } from '../services/print-service';
import {
  BranchIdQuerySchema,
  CreateOtherIncomePrintJobSchema,
  CreatePrintJobSchema,
  CreatePrintStationSchema,
  PrintJobQuerySchema,
  StationJobQuerySchema,
  UpdatePrintJobStatusSchema,
  routeIdParamSchema,
} from '../validators/print-schemas';
import { UnauthorizedError } from '../utils/errors';

const ELEVATED_ROLES = new Set(['DIRECTOR', 'SYSTEM_ADMIN']);

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
    const { orderId, receiptType, targetStationId } = CreatePrintJobSchema.parse(req.body);

    const organizationId = actor.organizationId;
    if (!organizationId) {
      throw new UnauthorizedError('User is not assigned to a branch');
    }

    const job = await printService.createPrintJob(
      orderId,
      actor.id,
      organizationId,
      receiptType,
      targetStationId ?? null,
    );

    res.status(201).json({
      success: true,
      data: job,
      message: 'Print job created',
    });
  },

  createOtherIncomePrintJob: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { entryId } = CreateOtherIncomePrintJobSchema.parse(req.body);

    const organizationId = actor.organizationId;
    if (!organizationId) {
      throw new UnauthorizedError('User is not assigned to a branch');
    }

    const job = await printService.createOtherIncomePrintJob(entryId, organizationId, actor.id);

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

    const jobs = await printService.claimJobsForStation(
      station.organizationId,
      station.id,
      query.limit,
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
    }, station.id);

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
    const { branchId } = BranchIdQuerySchema.parse(req.query);

    const organizationId =
      branchId && actor.role && ELEVATED_ROLES.has(actor.role) ? branchId : actor.organizationId;
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
    const { branchId } = BranchIdQuerySchema.parse(req.query);

    const organizationId =
      branchId && actor.role && ELEVATED_ROLES.has(actor.role) ? branchId : actor.organizationId;
    if (!organizationId) {
      throw new UnauthorizedError('User is not assigned to a branch');
    }

    const stations = await printService.listPrintStations(organizationId);

    res.status(200).json({
      success: true,
      data: stations,
    });
  },

  // Lightweight station list for the web-app print-target picker.
  // Available to waiters (unlike the manager-only management list).
  listSelectablePrintStations: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);

    const organizationId = actor.organizationId;
    if (!organizationId) {
      throw new UnauthorizedError('User is not assigned to a branch');
    }

    const stations = await printService.listPrintStations(organizationId);

    res.status(200).json({
      success: true,
      data: stations.map((station) => ({
        id: station.id,
        name: station.name,
        isOnline: station.isOnline,
      })),
    });
  },

  testPrintStation: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);
    const { branchId } = BranchIdQuerySchema.parse(req.query);

    const organizationId =
      branchId && actor.role && ELEVATED_ROLES.has(actor.role) ? branchId : actor.organizationId;
    if (!organizationId) {
      throw new UnauthorizedError('User is not assigned to a branch');
    }

    const job = await printService.createTestPrintJob(id, organizationId, actor.id);

    res.status(201).json({
      success: true,
      data: job,
      message: 'Test print sent to station',
    });
  },

  deactivatePrintStation: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);
    const { branchId } = BranchIdQuerySchema.parse(req.query);

    const organizationId =
      branchId && actor.role && ELEVATED_ROLES.has(actor.role) ? branchId : actor.organizationId;
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
