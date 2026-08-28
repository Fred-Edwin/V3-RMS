import type { Request, Response } from 'express';
import { marketPurchaseOrderService } from '../services/market-purchase-order-service';
import {
  marketPurchaseOrderIdParamSchema,
  listMarketPurchaseOrdersQuerySchema,
  requestMarketItemsSchema,
  editDraftLinesSchema,
  removeDraftLineParamSchema,
  reconcileLinesSchema,
  rejectMarketPurchaseOrderSchema,
} from '../validators/market-purchase-order-schemas';
import { UnauthorizedError } from '../utils/errors';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const marketPurchaseOrderController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { status } = listMarketPurchaseOrdersQuerySchema.parse(req.query);
    const orders = await marketPurchaseOrderService.list(actor, status);
    res.status(200).json({ success: true, data: { orders } });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = marketPurchaseOrderIdParamSchema.parse(req.params);
    const order = await marketPurchaseOrderService.getById(actor, id);
    res.status(200).json({ success: true, data: { order } });
  },

  getForDepartment: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = marketPurchaseOrderIdParamSchema.parse(req.params);
    const order = await marketPurchaseOrderService.getForDepartment(actor, id);
    res.status(200).json({ success: true, data: { order } });
  },

  requestItems: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = requestMarketItemsSchema.parse(req.body);
    const order = await marketPurchaseOrderService.requestItems(actor, input);
    res.status(201).json({ success: true, data: { order }, message: 'Items requested' });
  },

  editDraftLines: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = marketPurchaseOrderIdParamSchema.parse(req.params);
    const { lines } = editDraftLinesSchema.parse(req.body);
    const order = await marketPurchaseOrderService.editDraftLines(actor, id, lines);
    res.status(200).json({ success: true, data: { order }, message: 'Draft updated' });
  },

  removeDraftLine: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, lineId } = removeDraftLineParamSchema.parse(req.params);
    const order = await marketPurchaseOrderService.removeDraftLine(actor, id, lineId);
    res.status(200).json({ success: true, data: { order }, message: 'Line removed' });
  },

  discardDraft: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = marketPurchaseOrderIdParamSchema.parse(req.params);
    await marketPurchaseOrderService.discardDraft(actor, id);
    res.status(200).json({ success: true, message: 'Draft discarded' });
  },

  approve: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = marketPurchaseOrderIdParamSchema.parse(req.params);
    const order = await marketPurchaseOrderService.approve(actor, id);
    res.status(200).json({ success: true, data: { order }, message: 'Order approved' });
  },

  sendToMarket: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = marketPurchaseOrderIdParamSchema.parse(req.params);
    const order = await marketPurchaseOrderService.sendToMarket(actor, id);
    res.status(200).json({ success: true, data: { order }, message: 'Order sent to market' });
  },

  reconcileLines: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = marketPurchaseOrderIdParamSchema.parse(req.params);
    const { lines } = reconcileLinesSchema.parse(req.body);
    const order = await marketPurchaseOrderService.reconcileLines(actor, id, lines);
    res.status(200).json({ success: true, data: { order }, message: 'Order reconciled' });
  },

  complete: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = marketPurchaseOrderIdParamSchema.parse(req.params);
    const order = await marketPurchaseOrderService.complete(actor, id);
    res.status(200).json({ success: true, data: { order }, message: 'Order completed' });
  },

  confirmReceived: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = marketPurchaseOrderIdParamSchema.parse(req.params);
    const order = await marketPurchaseOrderService.confirmReceived(actor, id);
    res.status(200).json({ success: true, data: { order }, message: 'Receipt confirmed' });
  },

  reject: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = marketPurchaseOrderIdParamSchema.parse(req.params);
    const { reason } = rejectMarketPurchaseOrderSchema.parse(req.body);
    await marketPurchaseOrderService.reject(actor, id, reason);
    res.status(200).json({ success: true, message: 'Order rejected' });
  },
};
