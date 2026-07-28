import type { Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { prepRecordService } from '../services/prep-record-service';
import {
  CreatePrepRecordSchema,
  PrepRecordIdParamSchema,
  PrepRecordListQuerySchema,
  PromotePrepRecipeSchema,
  RollingAverageQuerySchema,
} from '../validators/prep-record-schemas';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const prepRecordController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { outputItemId, locationId } = PrepRecordListQuerySchema.parse(req.query);
    const records = await prepRecordService.list(actor, { outputItemId, locationId });
    res.status(200).json({ success: true, data: records });
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = PrepRecordIdParamSchema.parse(req.params);
    const record = await prepRecordService.getById(actor, id);
    res.status(200).json({ success: true, data: record });
  },

  create: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = CreatePrepRecordSchema.parse(req.body);
    const record = await prepRecordService.create(actor, data);
    res.status(201).json({ success: true, data: record, message: 'Prep record logged successfully' });
  },

  getRollingAverage: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { outputItemId } = RollingAverageQuerySchema.parse(req.query);
    const average = await prepRecordService.getRollingAverage(actor, outputItemId);
    res.status(200).json({ success: true, data: average });
  },

  listRecipes: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const recipes = await prepRecordService.listRecipes(actor);
    res.status(200).json({ success: true, data: recipes });
  },

  getRecipeById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = PrepRecordIdParamSchema.parse(req.params);
    const recipe = await prepRecordService.getRecipeById(actor, id);
    res.status(200).json({ success: true, data: recipe });
  },

  promoteToRecipe: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = PrepRecordIdParamSchema.parse(req.params);
    const data = PromotePrepRecipeSchema.parse(req.body);
    const recipe = await prepRecordService.promoteRecord(actor, id, data);
    res.status(201).json({ success: true, data: recipe, message: 'Prep recipe saved successfully' });
  },
};
