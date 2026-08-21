import type { Request, Response } from 'express';
import { departmentService } from '../services/department-service';
import {
  branchOrgParamSchema,
  departmentParamSchema,
  assignHeadSchema,
} from '../validators/department-schemas';
import { UnauthorizedError } from '../utils/errors';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const departmentController = {
  listDepartments: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { orgId } = branchOrgParamSchema.parse(req.params);
    const departments = await departmentService.listDepartments(actor, orgId);
    res.status(200).json({ success: true, data: { departments } });
  },

  listEligibleStaff: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { orgId, tag } = departmentParamSchema.parse(req.params);
    const staff = await departmentService.listEligibleStaff(actor, orgId, tag);
    res.status(200).json({ success: true, data: { staff } });
  },

  assignHead: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { orgId, tag } = departmentParamSchema.parse(req.params);
    const { userId } = assignHeadSchema.parse(req.body);
    const head = await departmentService.assignHead(actor, orgId, tag, userId);
    res.status(200).json({ success: true, data: { head }, message: 'Department head assigned' });
  },

  unassignHead: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { orgId, tag } = departmentParamSchema.parse(req.params);
    const previous = await departmentService.unassignHead(actor, orgId, tag);
    res.status(200).json({ success: true, data: { previous }, message: 'Department head unassigned' });
  },
};
