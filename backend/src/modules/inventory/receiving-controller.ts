import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { receivingService } from './receiving-service';
import { IdParamSchema } from './inventory-validators';
import { CreateExpectedDeliverySchema, ListExpectedDeliveriesQuerySchema } from './receiving-validators';
import { z } from 'zod';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

const PurchasingHistoryQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  supplierId: z.string().uuid().optional(),
  status: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const receivingController = {
  // ── Purchasing hub ───────────────────────────────────────────────────────

  getPurchasingSummary: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = await receivingService.getPurchasingSummary(actor);
    res.status(200).json({ success: true, data });
  },

  getPurchasingHistory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = PurchasingHistoryQuerySchema.parse(req.query);
    const data = await receivingService.getPurchasingHistory(actor, query);
    res.status(200).json({ success: true, data });
  },

  // ── Expected deliveries ──────────────────────────────────────────────────

  listExpectedDeliveries: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListExpectedDeliveriesQuerySchema.parse(req.query);
    const data = await receivingService.listExpectedDeliveries(actor, query);
    res.status(200).json({ success: true, data });
  },

  createExpectedDelivery: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = CreateExpectedDeliverySchema.parse(req.body);
    const data = await receivingService.createExpectedDelivery(actor, input);
    res.status(201).json({ success: true, data, message: 'Expected delivery created successfully' });
  },

  cancelExpectedDelivery: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await receivingService.cancelExpectedDelivery(actor, id);
    res.status(200).json({ success: true, data, message: 'Expected delivery cancelled successfully' });
  },

  // ── Items ────────────────────────────────────────────────────────────────

  getLastPrice: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await receivingService.getLastPrice(actor, id);
    res.status(200).json({ success: true, data });
  },
};
