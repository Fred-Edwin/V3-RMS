import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { requisitionService } from './requisitions-service';
import {
  ListRequisitionsQuerySchema,
  OpenRequisitionSchema,
  RequisitionSectionParamsSchema,
  UpsertRequisitionLinesSchema,
} from './requisitions-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const requisitionsController = {
  openRequisition: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = OpenRequisitionSchema.parse(req.body);
    const data = await requisitionService.openRequisition(actor, input);
    res.status(201).json({ success: true, data, message: 'Requisition opened' });
  },

  listRequisitions: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListRequisitionsQuerySchema.parse(req.query);
    const data = await requisitionService.listRequisitions(actor, query);
    res.status(200).json({ success: true, data });
  },

  getSection: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, departmentTag } = RequisitionSectionParamsSchema.parse(req.params);
    const data = await requisitionService.getSection(actor, id, departmentTag);
    res.status(200).json({ success: true, data });
  },

  upsertLines: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, departmentTag } = RequisitionSectionParamsSchema.parse(req.params);
    const input = UpsertRequisitionLinesSchema.parse(req.body);
    const data = await requisitionService.upsertLines(actor, id, departmentTag, input);
    res.status(200).json({ success: true, data, message: 'Saved' });
  },

  submitSection: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, departmentTag } = RequisitionSectionParamsSchema.parse(req.params);
    const data = await requisitionService.submitSection(actor, id, departmentTag);
    res.status(200).json({ success: true, data, message: 'Section submitted' });
  },

  recallSection: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, departmentTag } = RequisitionSectionParamsSchema.parse(req.params);
    const data = await requisitionService.recallSection(actor, id, departmentTag);
    res.status(200).json({ success: true, data, message: 'Section recalled' });
  },
};
