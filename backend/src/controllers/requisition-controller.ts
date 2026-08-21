import type { Request, Response } from 'express';
import { requisitionService } from '../services/requisition-service';
import {
  requisitionIdParamSchema,
  raiseRequisitionSchema,
  approveRequisitionSchema,
  rejectRequisitionSchema,
  listRequisitionsQuerySchema,
} from '../validators/requisition-schemas';
import { UnauthorizedError } from '../utils/errors';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const requisitionController = {
  listOrderableItems: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const items = await requisitionService.listOrderableItems(actor);
    res.status(200).json({ success: true, data: { items } });
  },

  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { status } = listRequisitionsQuerySchema.parse(req.query);
    const requisitions = await requisitionService.list(actor, status);
    res.status(200).json({ success: true, data: { requisitions } });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = requisitionIdParamSchema.parse(req.params);
    const requisition = await requisitionService.getById(actor, id);
    res.status(200).json({ success: true, data: { requisition } });
  },

  raise: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = raiseRequisitionSchema.parse(req.body);
    const requisition = await requisitionService.raise(actor, input);
    res.status(201).json({ success: true, data: { requisition }, message: 'Requisition submitted for approval' });
  },

  approve: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = requisitionIdParamSchema.parse(req.params);
    const input = approveRequisitionSchema.parse(req.body);
    const requisition = await requisitionService.approve(actor, id, input);
    res.status(200).json({ success: true, data: { requisition }, message: 'Requisition approved' });
  },

  reject: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = requisitionIdParamSchema.parse(req.params);
    const { reason } = rejectRequisitionSchema.parse(req.body);
    const requisition = await requisitionService.reject(actor, id, reason);
    res.status(200).json({ success: true, data: { requisition }, message: 'Requisition rejected' });
  },

  cancel: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = requisitionIdParamSchema.parse(req.params);
    const requisition = await requisitionService.cancel(actor, id);
    res.status(200).json({ success: true, data: { requisition }, message: 'Requisition cancelled' });
  },

  editAndResubmit: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = requisitionIdParamSchema.parse(req.params);
    const input = raiseRequisitionSchema.parse(req.body);
    const requisition = await requisitionService.editAndResubmit(actor, id, input);
    res.status(200).json({ success: true, data: { requisition }, message: 'Requisition resubmitted for approval' });
  },
};
