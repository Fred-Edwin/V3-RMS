import type { Request, Response } from 'express';
import { orderService } from '../services/order-service';
import {
  ActiveOrderQuerySchema,
  CancelOrderSchema,
  CreateOrderSchema,
  OrderQuerySchema,
  RecordPaymentSchema,
  UpdateOrderItemsSchema,
  routeIdParamSchema,
} from '../validators/order-schemas';
import { UnauthorizedError } from '../utils/errors';
import { z } from 'zod';

const orderByIdQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
});

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  return req.user;
};

export const orderController = {
  createOrder: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreateOrderSchema.parse(req.body);
    const order = await orderService.create(data, actor);

    res.status(201).json({
      success: true,
      data: order,
      message: `Order #${order.dailyNumber} created successfully`,
    });
  },

  getOrders: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = OrderQuerySchema.parse(req.query);
    const result = await orderService.getMany(actor, query);

    res.status(200).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  },

  getActiveOrders: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ActiveOrderQuerySchema.parse(req.query);
    const orders = await orderService.getActive(actor, query);

    res.status(200).json({
      success: true,
      data: orders,
    });
  },

  getOrderById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);
    const query = orderByIdQuerySchema.parse(req.query);
    const order = await orderService.getById(id, actor, query.branchId);

    res.status(200).json({
      success: true,
      data: order,
    });
  },

  updateOrderItems: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);
    const data = UpdateOrderItemsSchema.parse(req.body);
    const order = await orderService.updateItems(id, data, actor);

    res.status(200).json({
      success: true,
      data: order,
      message: 'Order updated successfully',
    });
  },

  recordPayment: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);
    const data = RecordPaymentSchema.parse(req.body);
    const order = await orderService.recordPayment(id, data, actor);

    res.status(200).json({
      success: true,
      data: order,
      message: 'Payment recorded. Order closed.',
    });
  },

  cancelOrder: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = routeIdParamSchema.parse(req.params);
    CancelOrderSchema.parse(req.body);
    const order = await orderService.cancel(id, actor);

    res.status(200).json({
      success: true,
      data: {
        id: order.id,
        status: order.status,
      },
      message: 'Order cancelled',
    });
  },
};
