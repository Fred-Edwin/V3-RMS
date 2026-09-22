import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { requisitionService } from './requisitions-service';
import {
  ApproveRequisitionSchema,
  ListNeedsApprovalQuerySchema,
  ListRequisitionHistoryQuerySchema,
  ListRequisitionsQuerySchema,
  OpenRequisitionSchema,
  RequisitionSectionParamsSchema,
  ReturnSectionSchema,
  UpsertApprovalLinesSchema,
  UpsertRequisitionLinesSchema,
} from './requisitions-validators';
import { z } from 'zod';

const RequisitionIdParamSchema = z.object({ id: z.string().uuid() });

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

  // ── Session B — Branch Manager approval ──────────────────────────────────

  listForManagerApproval: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListNeedsApprovalQuerySchema.parse(req.query);
    const data = await requisitionService.listForManagerApproval(actor, query);
    res.status(200).json({ success: true, data });
  },

  listHistory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListRequisitionHistoryQuerySchema.parse(req.query);
    const data = await requisitionService.listHistory(actor, query);
    res.status(200).json({ success: true, data });
  },

  getRequisitionForApproval: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = RequisitionIdParamSchema.parse(req.params);
    const data = await requisitionService.getRequisitionForApproval(actor, id);
    res.status(200).json({ success: true, data });
  },

  approveRequisition: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = RequisitionIdParamSchema.parse(req.params);
    const input = ApproveRequisitionSchema.parse(req.body);
    const data = await requisitionService.approveRequisition(actor, id, input);
    res.status(200).json({ success: true, data, message: 'Requisition approved' });
  },

  upsertApprovalLines: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, departmentTag } = RequisitionSectionParamsSchema.parse(req.params);
    const input = UpsertApprovalLinesSchema.parse(req.body);
    const data = await requisitionService.upsertApprovalLines(actor, id, departmentTag, input);
    res.status(200).json({ success: true, data, message: 'Saved' });
  },

  returnSection: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, departmentTag } = RequisitionSectionParamsSchema.parse(req.params);
    const input = ReturnSectionSchema.parse(req.body);
    const data = await requisitionService.returnSection(actor, id, departmentTag, input);
    res.status(200).json({ success: true, data, message: 'Section returned' });
  },

  nudgeHead: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id, departmentTag } = RequisitionSectionParamsSchema.parse(req.params);
    await requisitionService.nudgeHead(actor, id, departmentTag);
    res.status(200).json({ success: true, message: 'Nudge sent' });
  },
};
