import type { Request, Response } from 'express';
import { discountService } from '../services/discount-service';
import { CreateDiscountSchema, UpdateDiscountSchema, discountIdParamSchema } from '../validators/discount-schemas';
import { UnauthorizedError } from '../utils/errors';

export const discountController = {
  /** GET /discounts — list discounts visible to the actor's branch */
  list: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const results = await discountService.list(req.user);
    res.status(200).json({ success: true, data: results });
  },

  /** POST /discounts — Director creates a new discount definition */
  create: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const data = CreateDiscountSchema.parse(req.body);
    const result = await discountService.create(
      {
        organizationId: data.organizationId ?? null,
        name: data.name,
        type: data.type,
        value: data.value,
        requiresApproval: data.requiresApproval,
      },
      req.user,
    );
    res.status(201).json({ success: true, data: result });
  },

  /** PATCH /discounts/:discountId — Director updates a discount */
  update: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { discountId } = discountIdParamSchema.parse(req.params);
    const data = UpdateDiscountSchema.parse(req.body);
    const result = await discountService.update(discountId, data, req.user);
    res.status(200).json({ success: true, data: result });
  },

  /** DELETE /discounts/:discountId — Director soft-deletes (deactivates) a discount */
  deactivate: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { discountId } = discountIdParamSchema.parse(req.params);
    const result = await discountService.deactivate(discountId, req.user);
    res.status(200).json({ success: true, data: result });
  },
};
