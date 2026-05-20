import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { orderCorrectionService } from '../services/order-correction-service';
import {
  AdjustOrderTotalSchema,
  CorrectMpesaCodeSchema,
  CorrectPaymentMethodSchema,
  ForceOrderReadySchema,
  ListOrderCorrectionsQuerySchema,
  RemoveOrderItemSchema,
  RevertAwaitingAuthSchema,
  RevertRejectedTicketSchema,
  correctionIdParamSchema,
  correctionItemParamSchema,
  correctionTicketParamSchema,
} from '../validators/order-correction-schemas';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const orderCorrectionController = {
  listOrders: async (req: Request, res: Response): Promise<void> => {
    requireActor(req);
    const query = ListOrderCorrectionsQuerySchema.parse(req.query);
    const result = await orderCorrectionService.listOrders(query);
    res.status(200).json({ success: true, data: result });
  },

  getOrderDetail: async (req: Request, res: Response): Promise<void> => {
    requireActor(req);
    const { id } = correctionIdParamSchema.parse(req.params);
    const data = await orderCorrectionService.getOrderDetail(id);
    res.status(200).json({ success: true, data });
  },

  getAuditLog: async (req: Request, res: Response): Promise<void> => {
    requireActor(req);
    const { id } = correctionIdParamSchema.parse(req.params);
    const data = await orderCorrectionService.getAuditLog(id);
    res.status(200).json({ success: true, data });
  },

  correctMpesaCode: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = correctionIdParamSchema.parse(req.params);
    const input = CorrectMpesaCodeSchema.parse(req.body);
    await orderCorrectionService.correctMpesaCode(id, actor.id, input);
    res.status(200).json({ success: true, message: 'M-Pesa code corrected' });
  },

  correctPaymentMethod: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = correctionIdParamSchema.parse(req.params);
    const input = CorrectPaymentMethodSchema.parse(req.body);
    await orderCorrectionService.correctPaymentMethod(id, actor.id, input);
    res.status(200).json({ success: true, message: 'Payment method corrected' });
  },

  forceOrderReady: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = correctionIdParamSchema.parse(req.params);
    const input = ForceOrderReadySchema.parse(req.body);
    await orderCorrectionService.forceOrderReady(id, actor.id, input);
    res.status(200).json({ success: true, message: 'Order forced to READY' });
  },

  revertAwaitingAuth: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = correctionIdParamSchema.parse(req.params);
    const input = RevertAwaitingAuthSchema.parse(req.body);
    await orderCorrectionService.revertAwaitingAuth(id, actor.id, input);
    res.status(200).json({ success: true, message: 'Authorization reverted — order returned to READY' });
  },

  removeOrderItem: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, itemId } = correctionItemParamSchema.parse(req.params);
    const input = RemoveOrderItemSchema.parse(req.body);
    await orderCorrectionService.removeOrderItem(id, itemId, actor.id, input);
    res.status(200).json({ success: true, message: 'Item removed and total recalculated' });
  },

  revertRejectedTicket: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, ticketId } = correctionTicketParamSchema.parse(req.params);
    const input = RevertRejectedTicketSchema.parse(req.body);
    await orderCorrectionService.revertRejectedTicket(id, ticketId, actor.id, input);
    res.status(200).json({ success: true, message: 'Ticket reverted to PENDING — station notified' });
  },

  adjustOrderTotal: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = correctionIdParamSchema.parse(req.params);
    const input = AdjustOrderTotalSchema.parse(req.body);
    await orderCorrectionService.adjustOrderTotal(id, actor.id, input);
    res.status(200).json({ success: true, message: 'Order total adjusted' });
  },
};
