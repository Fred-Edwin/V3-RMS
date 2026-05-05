import type { Request, Response } from 'express';
import { z } from 'zod';
import { customerDiscountAuthService } from '../services/customer-discount-auth-service';
import { DiscountDecisionSchema, authRequestIdParamSchema } from '../validators/discount-schemas';
import { UnauthorizedError } from '../utils/errors';

const orderIdParamSchema = z.object({ orderId: z.string().uuid('orderId param must be a valid UUID') });

export const customerDiscountAuthController = {
  /** GET /customer-discount-auth — list all pending requests for the branch */
  listPending: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const results = await customerDiscountAuthService.listPending(req.user);
    res.status(200).json({ success: true, data: results });
  },

  /** GET /customer-discount-auth/:authRequestId — fetch a specific request */
  getById: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { authRequestId } = authRequestIdParamSchema.parse(req.params);
    const result = await customerDiscountAuthService.getById(authRequestId, req.user);
    res.status(200).json({ success: true, data: result });
  },

  /** GET /orders/:orderId/customer-discount-auth — fetch pending request for an order */
  getPendingByOrderId: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    if (!req.user.organizationId) throw new UnauthorizedError('Branch context required');
    const { orderId } = orderIdParamSchema.parse(req.params);
    const result = await customerDiscountAuthService.getPendingByOrderId(
      orderId,
      req.user.organizationId,
    );
    res.status(200).json({ success: true, data: result });
  },

  /** POST /customer-discount-auth/:authRequestId/override — manager/director approve or reject */
  override: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { authRequestId } = authRequestIdParamSchema.parse(req.params);
    const { decision } = DiscountDecisionSchema.parse(req.body);
    const result = await customerDiscountAuthService.managerApprove(
      authRequestId,
      decision,
      req.user,
    );
    res.status(200).json({
      success: true,
      data: result,
      message: `Customer discount ${decision.toLowerCase()}`,
    });
  },
};
