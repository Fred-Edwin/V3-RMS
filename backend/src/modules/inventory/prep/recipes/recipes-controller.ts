import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../../utils/errors';
import { recipesService } from './recipes-service';
import { recipeInputSchema, recipeItemParamSchema, recipesQuerySchema } from './recipes-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const recipesController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const data = await recipesService.list(requireActor(req), recipesQuerySchema.parse(req.query));
    res.status(200).json({ success: true, data });
  },

  get: async (req: Request, res: Response): Promise<void> => {
    const { itemId } = recipeItemParamSchema.parse(req.params);
    const data = await recipesService.get(requireActor(req), itemId);
    res.status(200).json({ success: true, data });
  },

  save: async (req: Request, res: Response): Promise<void> => {
    const { itemId } = recipeItemParamSchema.parse(req.params);
    const input = recipeInputSchema.parse(req.body);
    const data = await recipesService.save(requireActor(req), itemId, input);
    res.status(200).json({ success: true, data });
  },
};
