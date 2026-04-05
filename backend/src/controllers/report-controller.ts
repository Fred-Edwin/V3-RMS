import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { reportService } from '../services/report-service';
import {
  BranchTrendsQuerySchema,
  BranchOverviewQuerySchema,
  DailySummaryQuerySchema,
  DirectorPulseQuerySchema,
  DirectorTrendsQuerySchema,
  ExportQuerySchema,
  HourlyHeatmapQuerySchema,
  ItemsPerformanceQuerySchema,
  MyPerformanceQuerySchema,
  StaffPerformanceQuerySchema,
} from '../validators/report-schemas';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  return req.user;
};

export const reportController = {
  getDailySummary: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = DailySummaryQuerySchema.parse(req.query);
    const summary = await reportService.getDailySummary(actor, query);

    res.status(200).json({
      success: true,
      data: summary,
    });
  },

  getStaffPerformance: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = StaffPerformanceQuerySchema.parse(req.query);
    const report = await reportService.getStaffPerformance(actor, query);

    res.status(200).json({
      success: true,
      data: report,
    });
  },

  getBranchOverview: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = BranchOverviewQuerySchema.parse(req.query);
    const report = await reportService.getBranchOverview(actor, query);

    res.status(200).json({
      success: true,
      data: report,
    });
  },

  getBranchTrends: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = BranchTrendsQuerySchema.parse(req.query);
    const report = await reportService.getBranchTrends(actor, query);

    res.status(200).json({
      success: true,
      data: report,
    });
  },

  getDirectorTrends: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = DirectorTrendsQuerySchema.parse(req.query);
    const report = await reportService.getDirectorTrends(actor, query);

    res.status(200).json({
      success: true,
      data: report,
    });
  },

  getMyPerformance: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = MyPerformanceQuerySchema.parse(req.query);
    const report = await reportService.getMyPerformance(actor, query);

    res.status(200).json({
      success: true,
      data: report,
    });
  },

  getDirectorPulse: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    DirectorPulseQuerySchema.parse(req.query);
    const report = await reportService.getDirectorPulse(actor);

    res.status(200).json({
      success: true,
      data: report,
    });
  },

  exportReport: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ExportQuerySchema.parse(req.query);
    const result = await reportService.exportReport(actor, query);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(200).send(result.buffer);
  },

  getOutstandingBalances: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const report = await reportService.getOutstandingBalances(actor);
    res.status(200).json({ success: true, data: report });
  },

  getHourlyHeatmap: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = HourlyHeatmapQuerySchema.parse(req.query);
    const report = await reportService.getHourlyHeatmap(actor, query);

    res.status(200).json({
      success: true,
      data: report,
    });
  },

  getItemsPerformance: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ItemsPerformanceQuerySchema.parse(req.query);
    const report = await reportService.getItemsPerformance(actor, query);

    res.status(200).json({
      success: true,
      data: report,
    });
  },
};

