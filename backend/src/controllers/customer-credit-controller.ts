import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { customerCreditService } from '../services/customer-credit-service';
import {
  CreateCustomerCreditSchema,
  CustomerCreditIdParamSchema,
  RecordCustomerCreditSettlementSchema,
  UpdateCustomerCreditSchema,
} from '../validators/customer-credit-schemas';
import { z } from 'zod';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const customerCreditController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
    const accounts = await customerCreditService.list(actor, branchId);
    res.status(200).json({ success: true, data: accounts });
  },

  createAccount: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreateCustomerCreditSchema.parse(req.body);
    const account = await customerCreditService.createAccount(actor, data);
    res.status(201).json({
      success: true,
      data: account,
      message: 'Customer credit account created successfully',
    });
  },

  updateAccount: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = CustomerCreditIdParamSchema.parse(req.params);
    const data = UpdateCustomerCreditSchema.parse(req.body);
    const account = await customerCreditService.updateAccount(actor, id, data);
    res.status(200).json({
      success: true,
      data: account,
      message: 'Customer credit account updated successfully',
    });
  },

  recordSettlement: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = CustomerCreditIdParamSchema.parse(req.params);
    const data = RecordCustomerCreditSettlementSchema.parse(req.body);
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
    await customerCreditService.recordSettlement(actor, id, data, branchId);
    res.status(200).json({
      success: true,
      message: 'Settlement recorded successfully',
    });
  },

  getOrderHistory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = CustomerCreditIdParamSchema.parse(req.params);
    const { page, perPage } = paginationSchema.parse(req.query);
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
    const result = await customerCreditService.getOrderHistory(actor, id, page, perPage, branchId);
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
