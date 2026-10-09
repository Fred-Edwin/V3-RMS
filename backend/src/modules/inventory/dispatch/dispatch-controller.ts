import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../utils/errors';
import { carriersService } from './carriers-service';
import { dispatchService } from './dispatch-service';
import {
  addCarrierInputSchema,
  cancelDispatchInputSchema,
  carrierParamsSchema,
  dispatchMineQuerySchema,
  dispatchParamsSchema,
  listCarriersQuerySchema,
  packDepartmentParamsSchema,
  printDispatchQuerySchema,
  requisitionParamsSchema,
  savePackLinesInputSchema,
  signDispatchInputSchema,
  updateCarrierInputSchema,
} from './dispatch-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

/** 200 for a repeated key (the first result), the given status otherwise. */
const signed = (res: Response, data: { replayed: boolean }, status = 200): void => {
  res.status(data.replayed ? 200 : status).json({ success: true, data });
};

export const dispatchController = {
  queue: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await dispatchService.queue(requireActor(req)) });
  },

  getDepartment: async (req: Request, res: Response): Promise<void> => {
    const { requisitionId, departmentId } = packDepartmentParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await dispatchService.getDepartment(requireActor(req), requisitionId, departmentId) });
  },

  saveLines: async (req: Request, res: Response): Promise<void> => {
    const { requisitionId, departmentId } = packDepartmentParamsSchema.parse(req.params);
    const input = savePackLinesInputSchema.parse(req.body);
    res.status(200).json({ success: true, data: await dispatchService.saveLines(requireActor(req), requisitionId, departmentId, input) });
  },

  review: async (req: Request, res: Response): Promise<void> => {
    const { requisitionId } = requisitionParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await dispatchService.review(requireActor(req), requisitionId) });
  },

  sign: async (req: Request, res: Response): Promise<void> => {
    const { requisitionId } = requisitionParamsSchema.parse(req.params);
    const input = signDispatchInputSchema.parse(req.body);
    signed(res, await dispatchService.sign(requireActor(req), requisitionId, input), 201);
  },

  getFile: async (req: Request, res: Response): Promise<void> => {
    const { id } = dispatchParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await dispatchService.getFile(requireActor(req), id) });
  },

  print: async (req: Request, res: Response): Promise<void> => {
    const { id } = dispatchParamsSchema.parse(req.params);
    const { copy } = printDispatchQuerySchema.parse(req.query);
    res.status(200).json({ success: true, data: await dispatchService.print(requireActor(req), id, copy) });
  },

  cancel: async (req: Request, res: Response): Promise<void> => {
    const { id } = dispatchParamsSchema.parse(req.params);
    const input = cancelDispatchInputSchema.parse(req.body);
    signed(res, await dispatchService.cancel(requireActor(req), id, input));
  },

  mine: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await dispatchService.mine(requireActor(req), dispatchMineQuerySchema.parse(req.query)) });
  },

  // --- Carriers (P10) ----------------------------------------------------------------------------------------------------------
  listCarriers: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await carriersService.list(requireActor(req), listCarriersQuerySchema.parse(req.query)) });
  },

  addCarrier: async (req: Request, res: Response): Promise<void> => {
    res.status(201).json({ success: true, data: await carriersService.add(requireActor(req), addCarrierInputSchema.parse(req.body)) });
  },

  updateCarrier: async (req: Request, res: Response): Promise<void> => {
    const { id } = carrierParamsSchema.parse(req.params);
    res.status(200).json({ success: true, data: await carriersService.update(requireActor(req), id, updateCarrierInputSchema.parse(req.body)) });
  },
};
