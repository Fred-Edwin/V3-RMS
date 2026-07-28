import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { purchaseOrderService } from '../services/purchase-order-service';
import {
  CreatePurchaseOrderSchema,
  PurchaseOrderIdParamSchema,
  PurchaseOrderLineIdParamSchema,
  PurchaseOrderStatusQuerySchema,
  ReceivePurchaseOrderLineSchema,
  SuggestOrderQuerySchema,
} from '../validators/purchase-order-schemas';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const purchaseOrderController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { status } = PurchaseOrderStatusQuerySchema.parse(req.query);
    const purchaseOrders = await purchaseOrderService.list(actor, status);
    res.status(200).json({ success: true, data: purchaseOrders });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = PurchaseOrderIdParamSchema.parse(req.params);
    const purchaseOrder = await purchaseOrderService.getById(actor, id);
    res.status(200).json({ success: true, data: purchaseOrder });
  },

  create: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreatePurchaseOrderSchema.parse(req.body);
    const purchaseOrder = await purchaseOrderService.create(actor, data);
    res.status(201).json({
      success: true,
      data: purchaseOrder,
      message: 'Purchase order created successfully',
    });
  },

  send: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = PurchaseOrderIdParamSchema.parse(req.params);
    const purchaseOrder = await purchaseOrderService.send(actor, id);
    res.status(200).json({ success: true, data: purchaseOrder, message: 'Purchase order sent successfully' });
  },

  cancel: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = PurchaseOrderIdParamSchema.parse(req.params);
    const purchaseOrder = await purchaseOrderService.cancel(actor, id);
    res
      .status(200)
      .json({ success: true, data: purchaseOrder, message: 'Purchase order cancelled successfully' });
  },

  suggestOrder: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { locationId } = SuggestOrderQuerySchema.parse(req.query);
    const suggestions = await purchaseOrderService.suggestOrderLines(actor, locationId);
    res.status(200).json({ success: true, data: suggestions });
  },

  receiveLine: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, lineId } = PurchaseOrderLineIdParamSchema.parse(req.params);
    const data = ReceivePurchaseOrderLineSchema.parse(req.body);
    const purchaseOrder = await purchaseOrderService.receiveLine(actor, id, lineId, data);
    res.status(200).json({
      success: true,
      data: purchaseOrder,
      message: 'Purchase order line received successfully',
    });
  },
};
