import type { Request, Response } from 'express';
import { z } from 'zod';
import { orderCancellationAuthService } from '../services/order-cancellation-auth-service';
import {
  OrderCancellationAuthRequestIdParamSchema,
  OrderCancellationDecisionSchema,
} from '../validators/order-cancellation-auth-schemas';
import { UnauthorizedError } from '../utils/errors';

const orderIdParamSchema = z.object({ orderId: z.string().uuid('orderId param must be a valid UUID') });

export const orderCancellationAuthController = {
  listPending: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const results = await orderCancellationAuthService.listPending(req.user);
    res.status(200).json({ success: true, data: results });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const { authRequestId } = OrderCancellationAuthRequestIdParamSchema.parse(req.params);
    const result = await orderCancellationAuthService.getById(authRequestId, req.user);

    res.status(200).json({ success: true, data: result });
  },

  getPendingByOrderId: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const { orderId } = orderIdParamSchema.parse(req.params);
    const result = await orderCancellationAuthService.getPendingByOrderId(orderId, req.user);

    res.status(200).json({ success: true, data: result });
  },

  override: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const { authRequestId } = OrderCancellationAuthRequestIdParamSchema.parse(req.params);
    const { decision, resolutionNote } = OrderCancellationDecisionSchema.parse(req.body);
    const result = await orderCancellationAuthService.override(
      authRequestId,
      decision,
      req.user,
      resolutionNote ?? null,
    );

    res.status(200).json({
      success: true,
      data: result,
      message: decision === 'APPROVED' ? 'Cancellation approved' : 'Cancellation rejected',
    });
  },
};
