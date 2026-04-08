import type { Request, Response } from 'express';
import { houseAccountAuthService } from '../services/house-account-auth-service';
import { ResolveAuthSchema } from '../validators/house-account-auth-schemas';
import { UnauthorizedError } from '../utils/errors';

export const houseAccountAuthController = {
  /** GET /house-auth — list all pending auth requests for the branch (or the director's own account) */
  listPending: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const results = await houseAccountAuthService.listPending(req.user);
    res.status(200).json({ success: true, data: results });
  },

  /** GET /house-auth/:authRequestId — fetch a specific auth request */
  getById: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const { authRequestId } = req.params as { authRequestId: string };
    const result = await houseAccountAuthService.getById(authRequestId, req.user);

    res.status(200).json({ success: true, data: result });
  },

  /** GET /orders/:orderId/house-auth — fetch pending auth request for an order */
  getPendingByOrderId: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    if (!req.user.organizationId) throw new UnauthorizedError('Branch context required');

    const { orderId } = req.params as { orderId: string };
    const result = await houseAccountAuthService.getPendingByOrderId(orderId, req.user.organizationId);

    res.status(200).json({ success: true, data: result });
  },

  /** POST /house-auth/:authRequestId/resolve — account holder approves or rejects */
  resolve: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const { authRequestId } = req.params as { authRequestId: string };
    const { decision } = ResolveAuthSchema.parse(req.body);
    const result = await houseAccountAuthService.resolve(authRequestId, decision, req.user);

    res.status(200).json({ success: true, data: result, message: `Authorization ${decision.toLowerCase()}` });
  },

  /** POST /house-auth/:authRequestId/force-expire — manager reverts a stuck expired request */
  forceExpire: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const { authRequestId } = req.params as { authRequestId: string };
    await houseAccountAuthService.forceExpire(authRequestId, req.user);

    res.status(200).json({ success: true, message: 'Authorization request expired. Order returned to Ready.' });
  },

  /** POST /house-auth/:authRequestId/override — manager/director override */
  override: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const { authRequestId } = req.params as { authRequestId: string };
    const { decision } = ResolveAuthSchema.parse(req.body);
    const result = await houseAccountAuthService.managerOverride(authRequestId, decision, req.user);

    res.status(200).json({ success: true, data: result, message: `Authorization overridden: ${decision.toLowerCase()}` });
  },
};
