import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../utils/errors';
import { branchCodeInputSchema, branchCodeService, branchParamsSchema } from './requisitions-branch-code';
import { requisitionsListService } from './requisitions-list-service';
import { requisitionsService } from './requisitions-service';
import {
  addAdditionInputSchema,
  additionParamsSchema,
  approveAdditionInputSchema,
  approveInputSchema,
  cancelInputSchema,
  changeQuantityInputSchema,
  historyMineQuerySchema,
  lineParamsSchema,
  listRequisitionsQuerySchema,
  skipSectionsInputSchema,
  readIdempotencyKey,
  requisitionParamsSchema,
  saveLinesInputSchema,
  sectionParamsSchema,
  sendSectionInputSchema,
  setUrgentInputSchema,
  startRequisitionInputSchema,
} from './requisitions-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

/** 200 for a repeated key (the first result), the given status otherwise. */
const created = (res: Response, data: { replayed: boolean }, status = 201): void => {
  res.status(data.replayed ? 200 : status).json({ success: true, data });
};

export const requisitionsController = {
  // Lists, badges, home, history, activity, documents, print (back end B)
  list: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await requisitionsListService.list(requireActor(req), listRequisitionsQuerySchema.parse(req.query)) });
  },

  badges: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await requisitionsListService.badges(requireActor(req)) });
  },

  home: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await requisitionsListService.home(requireActor(req)) });
  },

  historyMine: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await requisitionsListService.history(requireActor(req), historyMineQuerySchema.parse(req.query)) });
  },

  activity: async (req: Request, res: Response): Promise<void> => {
    const { id } = requisitionParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await requisitionsListService.activity(requireActor(req), id) });
  },

  documents: async (req: Request, res: Response): Promise<void> => {
    const { id } = requisitionParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await requisitionsListService.documents(requireActor(req), id) });
  },

  print: async (req: Request, res: Response): Promise<void> => {
    const { id } = requisitionParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await requisitionsService.getPrintData(requireActor(req), id) });
  },

  setBranchCode: async (req: Request, res: Response): Promise<void> => {
    const { branchId } = branchParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await branchCodeService.set(requireActor(req), branchId, branchCodeInputSchema.parse(req.body)) });
  },

  // Reads owned by back end A
  getFile: async (req: Request, res: Response): Promise<void> => {
    const { id } = requisitionParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await requisitionsService.getFile(requireActor(req), id) });
  },

  getSection: async (req: Request, res: Response): Promise<void> => {
    const { id, departmentId } = sectionParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await requisitionsService.getSection(requireActor(req), id, departmentId) });
  },

  getApproveSummary: async (req: Request, res: Response): Promise<void> => {
    const { id } = requisitionParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await requisitionsService.getApproveSummary(requireActor(req), id) });
  },

  // Writes
  start: async (req: Request, res: Response): Promise<void> => {
    created(res, await requisitionsService.start(requireActor(req), startRequisitionInputSchema.parse(req.body)));
  },

  saveLines: async (req: Request, res: Response): Promise<void> => {
    const { id, departmentId } = sectionParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await requisitionsService.saveLines(requireActor(req), id, departmentId, saveLinesInputSchema.parse(req.body)) });
  },

  sendSection: async (req: Request, res: Response): Promise<void> => {
    const { id, departmentId } = sectionParamsSchema.parse(req.params);
    const { pin } = sendSectionInputSchema.parse(req.body);
    const data = await requisitionsService.sendSection(requireActor(req), id, departmentId, pin, readIdempotencyKey(req.headers));
    res.status(200).json({ success: true, data });
  },

  recallSection: async (req: Request, res: Response): Promise<void> => {
    const { id, departmentId } = sectionParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await requisitionsService.recallSection(requireActor(req), id, departmentId) });
  },

  setUrgent: async (req: Request, res: Response): Promise<void> => {
    const { id } = requisitionParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await requisitionsService.setUrgent(requireActor(req), id, setUrgentInputSchema.parse(req.body)) });
  },

  changeQuantity: async (req: Request, res: Response): Promise<void> => {
    const { id, lineId } = lineParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await requisitionsService.changeQuantity(requireActor(req), id, lineId, changeQuantityInputSchema.parse(req.body)) });
  },

  nudge: async (req: Request, res: Response): Promise<void> => {
    const { id, departmentId } = sectionParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await requisitionsService.nudge(requireActor(req), id, departmentId) });
  },

  skip: async (req: Request, res: Response): Promise<void> => {
    const { id } = requisitionParamsSchema.parse(req.params);
    const { departmentIds } = skipSectionsInputSchema.parse(req.body);
    res.status(200).json({ success: true, data: await requisitionsService.skip(requireActor(req), id, departmentIds) });
  },

  approve: async (req: Request, res: Response): Promise<void> => {
    const { id } = requisitionParamsSchema.parse(req.params);
    const data = await requisitionsService.approve(requireActor(req), id, approveInputSchema.parse(req.body), readIdempotencyKey(req.headers));
    res.status(200).json({ success: true, data });
  },

  cancel: async (req: Request, res: Response): Promise<void> => {
    const { id } = requisitionParamsSchema.parse(req.params);
    const data = await requisitionsService.cancel(requireActor(req), id, cancelInputSchema.parse(req.body), readIdempotencyKey(req.headers));
    res.status(200).json({ success: true, data });
  },

  addAddition: async (req: Request, res: Response): Promise<void> => {
    const { id } = requisitionParamsSchema.parse(req.params);
    created(res, await requisitionsService.addAddition(requireActor(req), id, addAdditionInputSchema.parse(req.body), readIdempotencyKey(req.headers)));
  },

  approveAddition: async (req: Request, res: Response): Promise<void> => {
    const { id, additionId } = additionParamsSchema.parse(req.params);
    const data = await requisitionsService.approveAddition(requireActor(req), id, additionId, approveAdditionInputSchema.parse(req.body), readIdempotencyKey(req.headers));
    res.status(200).json({ success: true, data });
  },
};
