import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { setupService } from './setup-service';
import {
  addItemsInputSchema,
  addItemsQuerySchema,
  addSectionInputSchema,
  itemIdParamSchema,
  layoutInputSchema,
  moveIdParamSchema,
  moveItemInputSchema,
  sectionIdParamSchema,
} from './setup-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const setupController = {
  view: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await setupService.view(requireActor(req)) });
  },

  sectionItems: async (req: Request, res: Response): Promise<void> => {
    const { id } = sectionIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await setupService.sectionItems(requireActor(req), id) });
  },

  addSection: async (req: Request, res: Response): Promise<void> => {
    const data = await setupService.addSection(requireActor(req), addSectionInputSchema.parse(req.body));
    res.status(201).json({ success: true, data, message: 'Section added' });
  },

  saveLayout: async (req: Request, res: Response): Promise<void> => {
    const data = await setupService.saveLayout(requireActor(req), layoutInputSchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Order saved' });
  },

  addableItems: async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, data: await setupService.addableItems(requireActor(req), addItemsQuerySchema.parse(req.query)) });
  },

  addItems: async (req: Request, res: Response): Promise<void> => {
    const { id } = sectionIdParamSchema.parse(req.params);
    const data = await setupService.addItems(requireActor(req), id, addItemsInputSchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Items added' });
  },

  moveItem: async (req: Request, res: Response): Promise<void> => {
    const { itemId } = itemIdParamSchema.parse(req.params);
    const data = await setupService.moveItem(requireActor(req), itemId, moveItemInputSchema.parse(req.body));
    res.status(200).json({ success: true, data, message: 'Item moved' });
  },

  undoMove: async (req: Request, res: Response): Promise<void> => {
    const { id } = moveIdParamSchema.parse(req.params);
    res.status(200).json({ success: true, data: await setupService.undoMove(requireActor(req), id), message: 'Move undone' });
  },
};
