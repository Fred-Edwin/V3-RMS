import type { Request, Response } from 'express';
import { modificationRequestService } from '../services/modification-request-service';
import { CreateModRequestSchema, ReviewModRequestSchema } from '../validators/modification-request-schemas';
import { routeIdParamSchema } from '../validators/order-schemas';
import { UnauthorizedError } from '../utils/errors';
import { z } from 'zod';

const orderIdParamSchema = z.object({
  orderId: z.string().uuid(),
});

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  return req.user;
};

export const modificationRequestController = {
  create: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { orderId } = orderIdParamSchema.parse(req.params);
    const { description } = CreateModRequestSchema.parse(req.body);
    const result = await modificationRequestService.create(orderId, description, actor);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Modification request submitted',
    });
  },

  getByOrder: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { orderId } = orderIdParamSchema.parse(req.params);
    const requests = await modificationRequestService.getByOrder(orderId, actor);

    res.status(200).json({
      success: true,
      data: requests,
    });
  },

  review: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);
    const data = ReviewModRequestSchema.parse(req.body);
    const result = await modificationRequestService.review(id, data.status, data.reviewNote, actor);

    res.status(200).json({
      success: true,
      data: result,
      message: `Modification request ${data.status.toLowerCase()}`,
    });
  },
};
