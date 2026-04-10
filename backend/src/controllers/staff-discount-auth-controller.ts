import type { Request, Response } from 'express';
import { staffDiscountAuthService } from '../services/staff-discount-auth-service';
import { StaffDiscountDecisionSchema } from '../validators/staff-discount-auth-schemas';
import { UnauthorizedError } from '../utils/errors';

export const staffDiscountAuthController = {
  /** GET /staff-discount-auth — list all pending discount requests for the branch */
  listPending: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const results = await staffDiscountAuthService.listPending(req.user);
    res.status(200).json({ success: true, data: results });
  },

  /** GET /staff-discount-auth/:authRequestId — fetch a specific discount auth request */
  getById: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const { authRequestId } = req.params as { authRequestId: string };
    const result = await staffDiscountAuthService.getById(authRequestId, req.user);

    res.status(200).json({ success: true, data: result });
  },

  /** GET /orders/:orderId/staff-discount-auth — fetch pending discount request for an order */
  getPendingByOrderId: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    if (!req.user.organizationId) throw new UnauthorizedError('Branch context required');

    const { orderId } = req.params as { orderId: string };
    const result = await staffDiscountAuthService.getPendingByOrderId(orderId, req.user.organizationId);

    res.status(200).json({ success: true, data: result });
  },

  /** POST /staff-discount-auth/:authRequestId/override — manager/director approve or reject */
  override: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const { authRequestId } = req.params as { authRequestId: string };
    const { decision } = StaffDiscountDecisionSchema.parse(req.body);
    const result = await staffDiscountAuthService.managerApprove(authRequestId, decision, req.user);

    res.status(200).json({
      success: true,
      data: result,
      message: `Staff discount ${decision.toLowerCase()}`,
    });
  },
};
