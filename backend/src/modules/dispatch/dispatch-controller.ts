import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { dispatchService } from './dispatch-service';
import {
  DispatchDepartmentParamsSchema,
  DispatchIdParamSchema,
  DispatchRequisitionParamsSchema,
  FulfilDepartmentSchema,
  ListDispatchQueueQuerySchema,
} from './dispatch-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const dispatchController = {
  listQueue: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListDispatchQueueQuerySchema.parse(req.query);
    const data = await dispatchService.listQueue(actor, query);
    res.status(200).json({ success: true, data });
  },

  getFulfilDetail: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { requisitionId } = DispatchRequisitionParamsSchema.parse(req.params);
    const data = await dispatchService.getFulfilDetail(actor, requisitionId);
    res.status(200).json({ success: true, data });
  },

  fulfilDepartment: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { requisitionId, departmentTag } = DispatchDepartmentParamsSchema.parse(req.params);
    const input = FulfilDepartmentSchema.parse(req.body);
    const data = await dispatchService.fulfilDepartment(actor, requisitionId, departmentTag, input);
    res.status(201).json({ success: true, data, message: 'Dispatched' });
  },

  getDeliveryNote: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = DispatchIdParamSchema.parse(req.params);
    const data = await dispatchService.getDeliveryNoteForHub(actor, id);
    res.status(200).json({ success: true, data });
  },
};
