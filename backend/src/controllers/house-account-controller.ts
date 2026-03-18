import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { houseAccountService } from '../services/house-account-service';
import {
  CreateHouseAccountSchema,
  HouseAccountIdParamSchema,
  RecordHouseSettlementSchema,
  UpdateHouseAccountSchema,
} from '../validators/house-account-schemas';
import { z } from 'zod';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const houseAccountController = {
  listActive: async (_req: Request, res: Response): Promise<void> => {
    const accounts = await houseAccountService.listActive();
    res.status(200).json({ success: true, data: accounts });
  },

  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const accounts = await houseAccountService.list(actor);
    res.status(200).json({ success: true, data: accounts });
  },

  getOwn: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const account = await houseAccountService.getOwn(actor);
    res.status(200).json({ success: true, data: account });
  },

  grantAccount: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreateHouseAccountSchema.parse(req.body);
    const account = await houseAccountService.grantAccount(actor, data);
    res.status(201).json({
      success: true,
      data: account,
      message: 'House account granted successfully',
    });
  },

  updateAccount: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = HouseAccountIdParamSchema.parse(req.params);
    const data = UpdateHouseAccountSchema.parse(req.body);
    const account = await houseAccountService.updateAccount(actor, id, data);
    res.status(200).json({
      success: true,
      data: account,
      message: 'House account updated successfully',
    });
  },

  recordSettlement: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = HouseAccountIdParamSchema.parse(req.params);
    const data = RecordHouseSettlementSchema.parse(req.body);
    await houseAccountService.recordSettlement(actor, id, data);
    res.status(200).json({
      success: true,
      message: 'Settlement recorded successfully',
    });
  },

  getOrderHistory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = HouseAccountIdParamSchema.parse(req.params);
    const { page, perPage } = paginationSchema.parse(req.query);
    const result = await houseAccountService.getOrderHistory(actor, id, page, perPage);
    res.status(200).json({
      success: true,
      data: result.orders,
      pagination: {
        total: result.total,
        page,
        perPage,
        totalPages: Math.ceil(result.total / perPage),
      },
    });
  },
};
