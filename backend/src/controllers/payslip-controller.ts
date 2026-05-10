import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { payslipService } from '../services/payslip-service';
import {
  bulkUpsertSchema,
  payslipBranchIdParamSchema,
  payslipBranchQuerySchema,
  payslipIdParamSchema,
  payslipListQuerySchema,
  payslipMineQuerySchema,
  publishSchema,
  revertSchema,
} from '../validators/payslip-schemas';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  return req.user;
};

export const payslipController = {
  bulkUpsert: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = bulkUpsertSchema.parse(req.body);
    const result = await payslipService.bulkUpsert(actor, input);

    res.status(200).json({
      success: true,
      data: result,
      message: `Saved ${result.saved.length} payslip(s). Skipped ${result.skipped.length} locked row(s).`,
    });
  },

  publish: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = publishSchema.parse(req.body);
    const result = await payslipService.publish(actor, input);

    res.status(200).json({
      success: true,
      data: result,
      message: `Published payroll for ${input.payPeriod}. ${result.count} payslip(s) finalised.`,
    });
  },

  revert: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = revertSchema.parse(req.body);
    const result = await payslipService.revert(actor, input);

    res.status(200).json({
      success: true,
      data: result,
      message: `Reverted ${input.payPeriod} to draft. ${result.count} payslip(s) unlocked.`,
    });
  },

  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = payslipListQuerySchema.parse(req.query);
    const result = await payslipService.list(actor, query);

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        perPage: result.perPage,
        totalPages: Math.ceil(result.total / result.perPage),
      },
    });
  },

  listMine: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = payslipMineQuerySchema.parse(req.query);
    const result = await payslipService.listMine(actor, query);

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        perPage: result.perPage,
        totalPages: Math.ceil(result.total / result.perPage),
      },
    });
  },

  listByBranch: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { branchId } = payslipBranchIdParamSchema.parse(req.params);
    const query = payslipBranchQuerySchema.parse(req.query);
    const result = await payslipService.listByBranch(actor, branchId, query);

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        perPage: result.perPage,
        totalPages: Math.ceil(result.total / result.perPage),
      },
    });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = payslipIdParamSchema.parse(req.params);
    const payslip = await payslipService.getById(actor, id);

    res.status(200).json({
      success: true,
      data: { payslip },
    });
  },
};
