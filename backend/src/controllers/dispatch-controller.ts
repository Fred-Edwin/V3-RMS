import type { Request, Response } from 'express';
import { dispatchService } from '../services/dispatch-service';
import {
  dispatchIdParamSchema,
  requisitionIdParamSchema,
  fulfilRequisitionSchema,
  rejectFulfilmentSchema,
  unsolicitedDispatchSchema,
  receiveDispatchSchema,
  listDispatchesQuerySchema,
} from '../validators/dispatch-schemas';
import { UnauthorizedError } from '../utils/errors';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const dispatchController = {
  queue: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const requisitions = await dispatchService.queue(actor);
    res.status(200).json({ success: true, data: { requisitions } });
  },

  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { status } = listDispatchesQuerySchema.parse(req.query);
    const dispatches = await dispatchService.list(actor, status);
    res.status(200).json({ success: true, data: { dispatches } });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = dispatchIdParamSchema.parse(req.params);
    const dispatch = await dispatchService.getById(actor, id);
    res.status(200).json({ success: true, data: { dispatch } });
  },

  fulfilRequisition: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { requisitionId } = requisitionIdParamSchema.parse(req.params);
    const input = fulfilRequisitionSchema.parse(req.body);
    const dispatch = await dispatchService.createFromRequisition(actor, requisitionId, input);
    res.status(201).json({ success: true, data: { dispatch }, message: 'Dispatch created' });
  },

  rejectFulfilment: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { requisitionId } = requisitionIdParamSchema.parse(req.params);
    const { reason } = rejectFulfilmentSchema.parse(req.body);
    await dispatchService.rejectFulfilment(actor, requisitionId, reason);
    res.status(200).json({ success: true, message: 'Requisition rejected by store' });
  },

  createUnsolicited: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = unsolicitedDispatchSchema.parse(req.body);
    const dispatch = await dispatchService.createUnsolicited(actor, input);
    res.status(201).json({ success: true, data: { dispatch }, message: 'Dispatch created' });
  },

  confirmDispatch: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = dispatchIdParamSchema.parse(req.params);
    const dispatch = await dispatchService.confirmDispatch(actor, id);
    res.status(200).json({ success: true, data: { dispatch }, message: 'Dispatch confirmed and in transit' });
  },

  receive: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = dispatchIdParamSchema.parse(req.params);
    const input = receiveDispatchSchema.parse(req.body);
    const dispatch = await dispatchService.receive(actor, id, input);
    res.status(200).json({ success: true, data: { dispatch }, message: 'Delivery received' });
  },
};
