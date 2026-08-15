import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { corporateAccountService } from '../services/corporate-account-service';
import {
  CorporateAccountIdParamSchema,
  CreateCorporateAccountSchema,
  RecordCorporateSettlementSchema,
  UpdateCorporateAccountSchema,
} from '../validators/corporate-account-schemas';
import { isoDateSchema } from '../validators/order-schemas';
import { parseDateOnly } from '../utils/date-only';
import { z } from 'zod';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
});

export const corporateAccountController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const accounts = await corporateAccountService.list(actor);
    res.status(200).json({ success: true, data: accounts });
  },

  createAccount: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreateCorporateAccountSchema.parse(req.body);
    const account = await corporateAccountService.createAccount(actor, data);
    res.status(201).json({
      success: true,
      data: account,
      message: 'Corporate account created successfully',
    });
  },

  updateAccount: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = CorporateAccountIdParamSchema.parse(req.params);
    const data = UpdateCorporateAccountSchema.parse(req.body);
    const account = await corporateAccountService.updateAccount(actor, id, data);
    res.status(200).json({
      success: true,
      data: account,
      message: 'Corporate account updated successfully',
    });
  },

  recordSettlement: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = CorporateAccountIdParamSchema.parse(req.params);
    const data = RecordCorporateSettlementSchema.parse(req.body);
    const result = await corporateAccountService.recordSettlement(actor, id, data);
    res.status(200).json({
      success: true,
      data: {
        settlementId: result.settlement.id,
        currentBalance: result.currentBalance,
      },
      message: 'Settlement recorded successfully',
    });
  },

  getOrderHistory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = CorporateAccountIdParamSchema.parse(req.params);
    const { page, perPage, startDate, endDate } = paginationSchema.parse(req.query);
    const dateRange = {
      startDate: startDate ? parseDateOnly(startDate) : undefined,
      endDate: endDate ? parseDateOnly(endDate) : undefined,
    };
    const result = await corporateAccountService.getOrderHistory(actor, id, page, perPage, dateRange);
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

  getSettlementHistory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = CorporateAccountIdParamSchema.parse(req.params);
    const { page, perPage, startDate, endDate } = paginationSchema.parse(req.query);
    const dateRange = {
      startDate: startDate ? parseDateOnly(startDate) : undefined,
      endDate: endDate ? parseDateOnly(endDate) : undefined,
    };
    const result = await corporateAccountService.getSettlementHistory(actor, id, page, perPage, dateRange);
    res.status(200).json({
      success: true,
      data: result.settlements,
      pagination: {
        total: result.total,
        page,
        perPage,
        totalPages: Math.ceil(result.total / perPage),
      },
    });
  },
};
