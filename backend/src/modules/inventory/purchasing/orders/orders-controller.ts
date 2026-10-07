import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { ordersService } from './orders-service';
import { ApproveSchema, CancelSchema, IdParamSchema, OrderInputSchema, OrdersQuerySchema, ReturnSchema, SendSchema, UpdateOrderSchema } from './orders-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

const idOf = (req: Request): string => IdParamSchema.parse(req.params).id;

export const ordersController = {
  getSummary: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await ordersService.getSummary(requireActor(req)) });
  },

  list: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await ordersService.list(requireActor(req), OrdersQuerySchema.parse(req.query)) });
  },

  getOne: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await ordersService.getOne(requireActor(req), idOf(req)) });
  },

  getLpoPrint: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await ordersService.getLpoPrint(requireActor(req), idOf(req)) });
  },

  getWhatsapp: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await ordersService.getWhatsapp(requireActor(req), idOf(req)) });
  },

  create: async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({ success: true, data: await ordersService.create(requireActor(req), OrderInputSchema.parse(req.body)) });
  },

  update: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await ordersService.update(requireActor(req), idOf(req), UpdateOrderSchema.parse(req.body)) });
  },

  discard: async (req: Request, res: Response): Promise<void> => {
    await ordersService.discard(requireActor(req), idOf(req));
    res.status(204).send();
  },

  submit: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await ordersService.submit(requireActor(req), idOf(req)) });
  },

  approve: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await ordersService.approve(requireActor(req), idOf(req), ApproveSchema.parse(req.body).pin) });
  },

  returnOrder: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await ordersService.returnOrder(requireActor(req), idOf(req), ReturnSchema.parse(req.body).note) });
  },

  send: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await ordersService.send(requireActor(req), idOf(req), SendSchema.parse(req.body).via) });
  },

  cancel: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await ordersService.cancel(requireActor(req), idOf(req), CancelSchema.parse(req.body)) });
  },
};
