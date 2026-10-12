import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../utils/errors';
import { departmentsService } from './departments-service';
import { addDepartmentInputSchema, departmentParamsSchema, listDepartmentsQuerySchema, renameDepartmentInputSchema } from './departments-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const departmentsController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const data = await departmentsService.list(requireActor(req), listDepartmentsQuerySchema.parse(req.query));
    res.status(200).json({ success: true, data });
  },

  add: async (req: Request, res: Response): Promise<void> => {
    const data = await departmentsService.add(requireActor(req), addDepartmentInputSchema.parse(req.body));
    res.status(201).json({ success: true, data, message: 'Department added' });
  },

  rename: async (req: Request, res: Response): Promise<void> => {
    const { id } = departmentParamsSchema.parse(req.params);
    const data = await departmentsService.rename(requireActor(req), id, renameDepartmentInputSchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Department renamed' });
  },

  retire: async (req: Request, res: Response): Promise<void> => {
    const { id } = departmentParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await departmentsService.retire(requireActor(req), id), message: 'Department retired' });
  },

  restore: async (req: Request, res: Response): Promise<void> => {
    const { id } = departmentParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await departmentsService.restore(requireActor(req), id), message: 'Department restored' });
  },
};
