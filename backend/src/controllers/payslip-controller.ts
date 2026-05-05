import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { payslipService } from '../services/payslip-service';
import {
  createPayslipSchema,
  payslipBranchIdParamSchema,
  payslipBranchQuerySchema,
  payslipIdParamSchema,
  payslipListQuerySchema,
  payslipMineQuerySchema,
  updatePayslipSchema,
} from '../validators/payslip-schemas';

const requireActor = (req: Request) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  return req.user;
};

export const payslipController = {
  create: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = createPayslipSchema.parse(req.body);
    const payslip = await payslipService.create(actor, input);

    res.status(201).json({
      success: true,
      data: { payslip },
      message: 'Payslip created successfully',
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

  update: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = payslipIdParamSchema.parse(req.params);
    const input = updatePayslipSchema.parse(req.body);
    const payslip = await payslipService.update(actor, id, input);

    res.status(200).json({
      success: true,
      data: { payslip },
      message: 'Payslip updated successfully',
    });
  },

  lock: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = payslipIdParamSchema.parse(req.params);
    const payslip = await payslipService.lock(actor, id);

    res.status(200).json({
      success: true,
      data: { payslip },
      message: 'Payslip locked successfully',
    });
  },
};
