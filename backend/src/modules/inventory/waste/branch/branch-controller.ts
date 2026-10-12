import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { branchWasteService } from './branch-service';
import {
  allBranchesWasteQuerySchema,
  branchWasteIdParamSchema,
  branchWasteItemsQuerySchema,
  branchWasteListQuerySchema,
  logBranchWasteInputSchema,
  myBranchWasteQuerySchema,
  reverseBranchWasteInputSchema,
} from './branch-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const branchWasteController = {
  /** BW1 */
  listItems: async (req: Request, res: Response): Promise<void> => {
    const data = await branchWasteService.listItems(requireActor(req), branchWasteItemsQuerySchema.parse(req.query));
    res.status(200).json({ success: true, data });
  },

  /** BW2: 201 for a new batch, 200 when the same key was sent before. */
  log: async (req: Request, res: Response): Promise<void> => {
    const { result, replayed } = await branchWasteService.log(requireActor(req), logBranchWasteInputSchema.parse(req.body));
    res.status(replayed ? 200 : 201).json({ success: true, data: result, ...(replayed ? {} : { message: 'Waste logged' }) });
  },

  /** BW3 */
  listMine: async (req: Request, res: Response): Promise<void> => {
    const data = await branchWasteService.listMine(requireActor(req), myBranchWasteQuerySchema.parse(req.query));
    res.status(200).json({ success: true, data });
  },

  /** BW4 */
  listBranch: async (req: Request, res: Response): Promise<void> => {
    const data = await branchWasteService.listBranch(requireActor(req), branchWasteListQuerySchema.parse(req.query));
    res.status(200).json({ success: true, data });
  },

  /** BW5 */
  listBranches: async (req: Request, res: Response): Promise<void> => {
    const data = await branchWasteService.listBranches(requireActor(req), allBranchesWasteQuerySchema.parse(req.query));
    res.status(200).json({ success: true, data });
  },

  /** BW6 */
  detail: async (req: Request, res: Response): Promise<void> => {
    const { id } = branchWasteIdParamSchema.parse(req.params);
    const data = await branchWasteService.detail(requireActor(req), id);
    res.status(200).json({ success: true, data });
  },

  /** BW7 */
  reverse: async (req: Request, res: Response): Promise<void> => {
    const { id } = branchWasteIdParamSchema.parse(req.params);
    const data = await branchWasteService.reverse(requireActor(req), id, reverseBranchWasteInputSchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Waste entry reversed' });
  },
};
