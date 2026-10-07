import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../utils/errors';
import { dispatchService } from './dispatch-service';
import { discrepancyService } from './discrepancy-service';
import {
  ConfirmDeliverySchema,
  DiscrepancyIdParamSchema,
  DispatchDepartmentParamsSchema,
  DispatchIdParamSchema,
  DispatchRequisitionParamsSchema,
  FulfilDepartmentSchema,
  ListDeliveriesQuerySchema,
  ListDiscrepanciesQuerySchema,
  ListDispatchQueueQuerySchema,
  ResolveDiscrepancySchema,
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

  // ── Milestone Five, Session B — branch-side receiving ─────────────────────

  listDeliveries: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListDeliveriesQuerySchema.parse(req.query);
    const data = await dispatchService.listDeliveries(actor, query);
    res.status(200).json({ success: true, data });
  },

  getDeliveryDetail: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = DispatchIdParamSchema.parse(req.params);
    const data = await dispatchService.getDeliveryDetail(actor, id);
    res.status(200).json({ success: true, data });
  },

  getDeliveryNoteForBranch: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = DispatchIdParamSchema.parse(req.params);
    const data = await dispatchService.getDeliveryNoteForBranch(actor, id);
    res.status(200).json({ success: true, data });
  },

  confirmDelivery: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = DispatchIdParamSchema.parse(req.params);
    const input = ConfirmDeliverySchema.parse(req.body);
    const data = await dispatchService.confirmDelivery(actor, id, input);
    res.status(200).json({ success: true, data, message: 'Delivery confirmed' });
  },

  confirmDeliveryOnBehalf: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = DispatchIdParamSchema.parse(req.params);
    const input = ConfirmDeliverySchema.parse(req.body);
    const data = await dispatchService.confirmDeliveryOnBehalf(actor, id, input);
    res.status(200).json({ success: true, data, message: 'Delivery confirmed on behalf' });
  },

  listDiscrepancies: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListDiscrepanciesQuerySchema.parse(req.query);
    const { rows, pagination } = await discrepancyService.listDiscrepancyPage(actor, query);
    res.status(200).json({ success: true, data: rows, pagination });
  },

  getDiscrepancy: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = DiscrepancyIdParamSchema.parse(req.params);
    const data = await discrepancyService.getDiscrepancy(actor, id);
    res.status(200).json({ success: true, data });
  },

  resolveDiscrepancy: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = DiscrepancyIdParamSchema.parse(req.params);
    const input = ResolveDiscrepancySchema.parse(req.body);
    const data = await discrepancyService.resolveDiscrepancy(actor, id, input);
    res.status(200).json({ success: true, data, message: 'Discrepancy resolved' });
  },
};
