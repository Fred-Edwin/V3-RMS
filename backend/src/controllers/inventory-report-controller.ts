import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { inventoryReportService } from '../services/inventory-report-service';
import {
  CountDiscrepancyQuerySchema,
  LocationQuerySchema,
  PrepYieldQuerySchema,
  PriceHistoryQuerySchema,
} from '../validators/inventory-report-schemas';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const inventoryReportController = {
  getStockValuation: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { locationId } = LocationQuerySchema.parse(req.query);
    const report = await inventoryReportService.getStockValuation(actor, locationId);
    res.status(200).json({ success: true, data: report });
  },

  getLowStockAlerts: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { locationId } = LocationQuerySchema.parse(req.query);
    const report = await inventoryReportService.getLowStockAlerts(actor, locationId);
    res.status(200).json({ success: true, data: report });
  },

  getPriceHistory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { inventoryItemId, supplierId } = PriceHistoryQuerySchema.parse(req.query);
    const report = await inventoryReportService.getPriceHistory(actor, inventoryItemId, supplierId);
    res.status(200).json({ success: true, data: report });
  },

  getPrepYield: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { outputItemId } = PrepYieldQuerySchema.parse(req.query);
    const report = await inventoryReportService.getPrepYield(actor, outputItemId);
    res.status(200).json({ success: true, data: report });
  },

  getCountDiscrepancy: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { locationId, stockCountId } = CountDiscrepancyQuerySchema.parse(req.query);
    const report = await inventoryReportService.getCountDiscrepancy(actor, { locationId, stockCountId });
    res.status(200).json({ success: true, data: report });
  },

  getTrueCostPerPreppedItem: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const report = await inventoryReportService.getTrueCostPerPreppedItem(actor);
    res.status(200).json({ success: true, data: report });
  },

  getSupplierApAging: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const report = await inventoryReportService.getSupplierApAging(actor);
    res.status(200).json({ success: true, data: report });
  },
};
